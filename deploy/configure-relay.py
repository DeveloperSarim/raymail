#!/usr/bin/env python3
"""Point Stalwart's outbound delivery at the smarthost defined in .env.

Outbound :25 is blocked by the host provider, so remote mail cannot go direct
to MX. This creates a Relay route and makes it the default outbound path.

Idempotent: re-running updates the existing route rather than adding another.
"""
import sys
from _stalwart import load_env, client

ROUTE_NAME = "raymail-relay"

env = load_env()
missing = [k for k in ("RELAY_HOST", "RELAY_USERNAME", "RELAY_PASSWORD") if not env.get(k)]
if missing:
    sys.exit(f"Set {', '.join(missing)} in /root/raymail/.env first — nothing changed.")

call = client(env)

route = {
    "@type": "Relay",
    "name": ROUTE_NAME,
    "description": "Outbound smarthost (direct :25 egress is blocked)",
    "address": env["RELAY_HOST"],
    "port": int(env.get("RELAY_PORT", 587)),
    "protocol": "smtp",
    "allowInvalidCerts": False,
    # 587 is STARTTLS, so implicit TLS stays off. Set true only for port 465.
    "implicitTls": int(env.get("RELAY_PORT", 587)) == 465,
    "authUsername": env["RELAY_USERNAME"],
    # authSecret uses the SecretKeyOptional union: the variant is "Value"
    # (not "Text", which is what x:DkimSignature/x:Certificate use).
    "authSecret": {"@type": "Value", "secret": env["RELAY_PASSWORD"]},
}

existing = next(
    (r for r in call("x:MtaRoute/get", {"ids": None}).get("list", [])
     if r.get("name") == ROUTE_NAME),
    None,
)

if existing:
    res = call("x:MtaRoute/set", {"update": {existing["id"]: route}})
    if res.get("notUpdated"):
        sys.exit(f"Route update rejected: {res['notUpdated']}")
    print(f"updated relay route -> {env['RELAY_HOST']}:{env.get('RELAY_PORT', 587)}")
else:
    res = call("x:MtaRoute/set", {"create": {"r": route}})
    if res.get("notCreated"):
        sys.exit(f"Route create rejected: {res['notCreated']}")
    print(f"created relay route -> {env['RELAY_HOST']}:{env.get('RELAY_PORT', 587)}")

# The outbound strategy is a singleton. Values are Stalwart *expressions*, so
# a literal route name has to be single-quoted.
#
# The local branch is not optional: without it every message — including
# locally-addressed mail and the DSNs Stalwart generates for its own bounces —
# is pushed at the smarthost, which rejects them and double-bounces.
res = call("x:MtaOutboundStrategy/set", {"update": {"singleton": {"route": {
    "match": {"0": {"if": "is_local_domain(rcpt_domain)", "then": "'local'"}},
    "else": f"'{ROUTE_NAME}'",
}}}})
if res.get("notUpdated"):
    sys.exit(f"Outbound strategy rejected: {res['notUpdated']}")

print("outbound strategy now routes all remote mail through the relay")
print("restart to apply:  docker restart raymail-stalwart")
