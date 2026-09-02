#!/usr/bin/env python3
"""Print the exact DNS records this installation needs, using its live DKIM keys."""
import subprocess, sys
from _stalwart import load_env, client

env = load_env()
domain = env.get("MAIL_DOMAIN") or sys.exit("Set MAIL_DOMAIN in .env first.")
host = env.get("MAIL_HOSTNAME", domain)
sub = domain.split(".")[0]

ip = subprocess.run(["curl", "-s", "--max-time", "10", "https://api.ipify.org"],
                    capture_output=True, text=True).stdout.strip()

sigs = client(env)("x:DkimSignature/get", {"ids": None}).get("list", [])

print(f"\nDNS records for {domain}  (add in Hostinger hPanel -> DNS Zone)")
print(f"Server IP: {ip}\n")
print(f"{'TYPE':<6} {'NAME':<34} VALUE")
print("-" * 100)
print(f"{'A':<6} {sub:<34} {ip}")
print(f"{'MX':<6} {sub:<34} 10 {host}.   (priority 10)")

relay_spf = env.get("RELAY_SPF_INCLUDE", "")
spf = f"v=spf1 mx a:{host}" + (f" include:{relay_spf}" if relay_spf else "") + " ~all"
print(f"{'TXT':<6} {sub:<34} {spf}")

for s in sigs:
    kind = "rsa" if "Rsa" in s.get("@type", "") else "ed25519"
    name = f"{s['selector']}._domainkey.{sub}"
    key = "v=DKIM1; k=%s; p=%s" % (kind, s["publicKey"])
    print(f"{'TXT':<6} {name:<34} {key[:60]}...")
    print(f"{'':6} {'':34} (full value below)")

print(f"{'TXT':<6} {'_dmarc.' + sub:<34} "
      f"v=DMARC1; p=quarantine; rua=mailto:dmarc@{domain}; adkim=s; aspf=s; pct=100")

print("\nPTR (reverse DNS) — set on the VPS, not in the DNS zone:")
print(f"  {ip}  ->  {host}")

print("\nFull DKIM values:\n")
for s in sigs:
    kind = "rsa" if "Rsa" in s.get("@type", "") else "ed25519"
    print(f"  {s['selector']}._domainkey.{sub}")
    print(f"  v=DKIM1; k={kind}; p={s['publicKey']}\n")
