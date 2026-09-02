#!/usr/bin/env bash
#
#  RayMail installer
#  ─────────────────
#  curl -fsSL https://raw.githubusercontent.com/DeveloperSarim/raymail/main/install.sh | bash
#
#  Brings up a working mail stack on a fresh VPS or a local machine:
#  audits ports, writes configuration, starts the containers, completes the
#  Stalwart setup handshake, and prints the DNS records you still have to add.
#
#  Safe by design: it binds only ports it has verified are free, never touches
#  an existing web server, and refuses to overwrite an installation it finds.
#
set -euo pipefail

REPO="https://github.com/DeveloperSarim/raymail.git"
DIR="${RAYMAIL_DIR:-$PWD/raymail}"
IMAGE_UID_STALWART=2000     # the stalwart image runs unprivileged as 2000
IMAGE_UID_WEB=1001          # the web image runs unprivileged as 1001

# ── output ───────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  B=$'\033[1m'; DIM=$'\033[2m'; R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; C=$'\033[36m'; N=$'\033[0m'
else
  B=""; DIM=""; R=""; G=""; Y=""; C=""; N=""
fi
step() { printf '\n%s==>%s %s%s%s\n' "$C" "$N" "$B" "$*" "$N"; }
ok()   { printf '   %s✓%s %s\n' "$G" "$N" "$*"; }
warn() { printf '   %s!%s %s\n' "$Y" "$N" "$*"; }
die()  { printf '\n   %s✗ %s%s\n\n' "$R" "$*" "$N" >&2; exit 1; }

banner() {
cat <<'ART'
   ___                  __  __       _ _
  | _ \__ _ _  _  ___  |  \/  |__ _ (_) |
  |   / _` | || |(_-<  | |\/| / _` || | |
  |_|_\__,_|\_, |/__/  |_|  |_\__,_||_|_|
            |__/   self-hosted mail, telemetry included
ART
}

# ── prerequisites ────────────────────────────────────────────────────────────
need_docker() {
  command -v docker >/dev/null 2>&1 || die "Docker is not installed. See https://docs.docker.com/engine/install/"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (docker compose version)."
  docker info >/dev/null 2>&1 || die "Cannot talk to the Docker daemon. Is it running, and are you in the docker group?"
  ok "docker $(docker --version | awk '{print $3}' | tr -d ,) with compose v2"
}

port_free() {
  # Returns 0 when nothing is listening on $1.
  if command -v ss >/dev/null 2>&1; then
    ! ss -tlnH "sport = :$1" 2>/dev/null | grep -q .
  elif command -v lsof >/dev/null 2>&1; then
    ! lsof -iTCP:"$1" -sTCP:LISTEN -n -P >/dev/null 2>&1
  else
    return 0   # cannot check; assume free and let docker fail loudly
  fi
}

# ── main ─────────────────────────────────────────────────────────────────────
banner

step "Checking prerequisites"
need_docker
for t in curl openssl; do
  command -v "$t" >/dev/null 2>&1 || die "$t is required but not installed."
done
ok "curl and openssl present"

step "Auditing ports"
BLOCKED=""
for p in 25 465 587 993; do
  if port_free "$p"; then ok "port $p free"
  else warn "port $p is already in use"; BLOCKED="$BLOCKED $p"; fi
done
[ -n "$BLOCKED" ] && die "Ports in use:$BLOCKED — stop whatever owns them, or run RayMail on another host."

WEB_PORT=3880; ADMIN_PORT=3881
while ! port_free "$WEB_PORT"; do WEB_PORT=$((WEB_PORT+1)); done
while ! port_free "$ADMIN_PORT"; do ADMIN_PORT=$((ADMIN_PORT+1)); done
ok "webmail will bind 127.0.0.1:$WEB_PORT, admin 127.0.0.1:$ADMIN_PORT"

step "Testing outbound SMTP"
# Many providers (Hostinger, DigitalOcean, Oracle, Azure…) block outbound 25.
# If they do, direct MX delivery is impossible and a relay is mandatory — far
# better to learn that now than after mail silently queues for a day.
RELAY_REQUIRED=no
if timeout 8 bash -c 'exec 3<>/dev/tcp/gmail-smtp-in.l.google.com/25' 2>/dev/null; then
  ok "outbound port 25 is open — direct delivery to MX is possible"
else
  RELAY_REQUIRED=yes
  warn "outbound port 25 is BLOCKED by your provider"
  warn "outbound mail must go through a relay (Resend, SendGrid, Postmark, SES…)"
fi

# ── collect settings ─────────────────────────────────────────────────────────
step "Configuration"
if [ -t 0 ]; then
  read -rp "   Mail domain (e.g. mail.example.com): " MAIL_DOMAIN
else
  MAIL_DOMAIN="${MAIL_DOMAIN:-}"
fi
[ -n "${MAIL_DOMAIN:-}" ] || die "A mail domain is required. Re-run interactively, or set MAIL_DOMAIN=…"
echo "$MAIL_DOMAIN" | grep -qE '^[a-z0-9.-]+\.[a-z]{2,}$' || die "'$MAIL_DOMAIN' does not look like a domain."

PUBLIC_IP="$(curl -fsS --max-time 10 https://api.ipify.org || echo '')"
[ -n "$PUBLIC_IP" ] && ok "public IP $PUBLIC_IP" || warn "could not determine the public IP"

# ── fetch ────────────────────────────────────────────────────────────────────
step "Installing to $DIR"
if [ -d "$DIR/.git" ]; then
  ok "existing checkout found — leaving it alone"
elif [ -e "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then
  die "$DIR exists and is not empty. Move it aside or set RAYMAIL_DIR=…"
else
  command -v git >/dev/null 2>&1 || die "git is required to fetch RayMail."
  git clone --depth 1 "$REPO" "$DIR" >/dev/null 2>&1 || die "Could not clone $REPO"
  ok "cloned"
fi
cd "$DIR"

# ── environment ──────────────────────────────────────────────────────────────
step "Writing configuration"
if [ -f .env ]; then
  ok ".env already exists — keeping your settings"
else
  ADMIN_PW="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-28)"
  TELE="$(openssl rand -hex 32)"
  cat > .env <<ENV
MAIL_DOMAIN=$MAIL_DOMAIN
MAIL_HOSTNAME=$MAIL_DOMAIN
APP_URL=https://$MAIL_DOMAIN

STALWART_ADMIN_USER=admin@$MAIL_DOMAIN
STALWART_ADMIN_PASSWORD=$ADMIN_PW

# Outbound relay. Required when your provider blocks port 25.
RELAY_HOST=
RELAY_PORT=587
RELAY_USERNAME=
RELAY_PASSWORD=
RELAY_SPF_INCLUDE=

TELEMETRY_SECRET=$TELE

# Optional AI assistant (drafting, summaries, inbox overview).
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
ENV
  chmod 600 .env
  ok "generated .env with fresh secrets"
fi

# Bind ports the audit actually cleared, instead of assuming the defaults.
if [ "$WEB_PORT" != "3880" ] || [ "$ADMIN_PORT" != "3881" ]; then
  sed -i.bak -e "s|127.0.0.1:3880:3000|127.0.0.1:$WEB_PORT:3000|" \
             -e "s|127.0.0.1:3881:8080|127.0.0.1:$ADMIN_PORT:8080|" docker-compose.yml
  rm -f docker-compose.yml.bak
  ok "compose ports adjusted"
fi

step "Preparing data directories"
# Both images run unprivileged. Root-owned bind mounts are the single most
# common first-boot failure: Stalwart dies with "Permission denied" on its
# RocksDB, and the web container cannot create its SQLite file.
mkdir -p stalwart/etc stalwart/data/logs data
if [ "$(id -u)" = "0" ]; then
  chown -R "$IMAGE_UID_STALWART:$IMAGE_UID_STALWART" stalwart/etc stalwart/data
  chown -R "$IMAGE_UID_WEB:$IMAGE_UID_WEB" data
  ok "ownership set (stalwart $IMAGE_UID_STALWART, web $IMAGE_UID_WEB)"
else
  warn "not running as root — if the containers fail to start, run:"
  warn "  sudo chown -R $IMAGE_UID_STALWART:$IMAGE_UID_STALWART stalwart/etc stalwart/data"
  warn "  sudo chown -R $IMAGE_UID_WEB:$IMAGE_UID_WEB data"
fi

step "Building and starting"
docker compose build web >/dev/null 2>&1 || die "Web image build failed. Run 'docker compose build web' to see why."
ok "web image built"
docker compose up -d >/dev/null 2>&1 || die "Could not start the stack. Try 'docker compose up' to see the error."
ok "containers started"

printf '   waiting for the mail server'
for _ in $(seq 1 30); do
  curl -fsS --max-time 2 "http://127.0.0.1:$ADMIN_PORT/.well-known/jmap" >/dev/null 2>&1 && break
  printf '.'; sleep 2
done
echo

# ── first-run setup ──────────────────────────────────────────────────────────
step "Completing mail server setup"
python3 - "$ADMIN_PORT" "$MAIL_DOMAIN" <<'PY' || die "Setup handshake failed. See 'docker compose logs stalwart'."
import base64, json, os, sys, time, urllib.error, urllib.request

port, domain = sys.argv[1], sys.argv[2]
env = {}
for line in open(".env"):
    if "=" in line and not line.startswith("#"):
        k, v = line.strip().split("=", 1); env[k] = v
pw = env["STALWART_ADMIN_PASSWORD"]

def call(user, secret, method, args):
    auth = base64.b64encode(f"{user}:{secret}".encode()).decode()
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/jmap/",
        data=json.dumps({"using": ["urn:stalwart:jmap"],
                         "methodCalls": [[method, args, "0"]]}).encode(),
        headers={"Authorization": "Basic " + auth, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=90))["methodResponses"][0][1]

# Already configured? Then this is a re-run; leave everything alone.
try:
    if call(f"admin@{domain}", pw, "x:Domain/get", {"ids": None}).get("list"):
        print("   already configured - skipping setup"); raise SystemExit(0)
except SystemExit:
    raise
except Exception:
    pass

# Ask the server for its own defaults and patch only what differs, rather than
# hand-composing the nested store objects.
boot = call("admin", pw, "x:Bootstrap/get", {"ids": None})["list"][0]
for k in ("id",):
    boot.pop(k, None)
boot.update({
    "serverHostname": domain,
    "defaultDomain": domain,
    # ACME needs :80/:443; those usually belong to an existing web server, so
    # certificates are installed from disk instead (see setup-tls.sh).
    "requestTlsCertificate": False,
    "generateDkimKeys": True,
    "tracer": {**boot["tracer"], "path": "/var/lib/stalwart/logs/", "ansi": False},
})
boot.pop("username", None); boot.pop("secret", None)   # server-set

r = call("admin", pw, "x:Bootstrap/set", {"update": {"singleton": boot}})
if r.get("notUpdated"):
    print("   bootstrap rejected:", json.dumps(r["notUpdated"])[:300]); sys.exit(1)
creds = r["updated"]["singleton"]
print(f"   administrator: {creds['username']}")

# Persist the permanent credential the server just generated.
lines = open(".env").read().splitlines()
out = []
for l in lines:
    if l.startswith("STALWART_ADMIN_PASSWORD="): out.append("STALWART_ADMIN_PASSWORD=" + creds["secret"])
    elif l.startswith("STALWART_ADMIN_USER="):   out.append("STALWART_ADMIN_USER=" + creds["username"])
    else: out.append(l)
open(".env", "w").write("\n".join(out) + "\n")

time.sleep(3)
admin_user, admin_pw = creds["username"], creds["secret"]

# Stalwart ships smtp/465/993/995/4190 but no submission listener; Outlook and
# Apple Mail default to 587, so create it.
listeners = call(admin_user, admin_pw, "x:NetworkListener/get", {"ids": None}).get("list", [])
if not any("587" in k for l in listeners for k in l.get("bind", {})):
    base = next((l for l in listeners if l.get("name") == "smtp"), None)
    if base:
        sub = {k: v for k, v in base.items() if k != "id"}
        sub.update({"name": "submission", "bind": {"[::]:587": True}, "tlsImplicit": False})
        call(admin_user, admin_pw, "x:NetworkListener/set", {"create": {"s": sub}})
        print("   created submission listener on :587")
PY
ok "mail server configured"

docker compose restart stalwart >/dev/null 2>&1 || true
sleep 8

# ── done ─────────────────────────────────────────────────────────────────────
ADMIN_USER="$(grep '^STALWART_ADMIN_USER=' .env | cut -d= -f2-)"
ADMIN_PASS="$(grep '^STALWART_ADMIN_PASSWORD=' .env | cut -d= -f2-)"

step "Installed"
cat <<EOF

   ${B}Webmail${N}       http://127.0.0.1:$WEB_PORT   ${DIM}(put a reverse proxy in front)${N}
   ${B}Administrator${N} $ADMIN_USER
   ${B}Password${N}      $ADMIN_PASS

   ${DIM}Saved in $DIR/.env — keep it out of version control.${N}

${B}Next steps${N}

   1. DNS — print the exact records, including your live DKIM keys:
        cd $DIR && ./deploy/dns-records.py

   2. TLS + reverse proxy (Apache shown; adapt for nginx/Caddy):
        sudo ./deploy/setup-tls.sh

EOF

if [ "$RELAY_REQUIRED" = "yes" ]; then
cat <<EOF
   3. ${Y}Outbound relay is REQUIRED on this host${N} — port 25 is blocked.
      Put your provider's SMTP credentials in .env, then:
        ./deploy/configure-relay.py && docker compose restart stalwart

EOF
fi

cat <<EOF
   Health check at any time:
        ./deploy/verify.sh

EOF
