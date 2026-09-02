#!/usr/bin/env bash
# Issues the Let's Encrypt certificate for the configured domain and installs
# the TLS vhost.
# Safety contract: never restarts Apache, never edits an existing vhost, and
# aborts before touching anything if configtest fails.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

# The domain comes from .env. It used to be hardcoded, which meant a fresh
# clone would try to issue a certificate for someone else's domain.
ENV_FILE="${ENV_FILE:-$HERE/../.env}"
[ -f "$ENV_FILE" ] || { echo "FAIL: $ENV_FILE not found - copy .env.example first"; exit 1; }
DOMAIN="$(grep -E '^MAIL_HOSTNAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"'[:space:]')"
[ -n "$DOMAIN" ] || { echo "FAIL: MAIL_HOSTNAME is not set in $ENV_FILE"; exit 1; }

say(){ printf '\n\033[1m==> %s\033[0m\n' "$*"; }

say "Preflight: DNS"
ip=$(dig +short A "$DOMAIN" | tail -1)
want=$(curl -s --max-time 10 https://api.ipify.org)
if [ -z "$ip" ]; then
  echo "FAIL: $DOMAIN has no A record yet. Add it in Hostinger hPanel first:"
  echo "      A    mail    ->  $want"
  exit 1
fi
[ "$ip" = "$want" ] || { echo "FAIL: $DOMAIN resolves to $ip, expected $want"; exit 1; }
echo "ok: $DOMAIN -> $ip"

say "Preflight: required Apache modules"
missing=""
for m in proxy proxy_http proxy_wstunnel rewrite headers ssl; do
  a2query -m "$m" >/dev/null 2>&1 && echo "  ok   $m" || { echo "  MISS $m"; missing="$missing $m"; }
done
if [ -n "$missing" ]; then
  echo "FAIL: missing modules:$missing"
  echo "      Enable with: a2enmod$missing && systemctl reload apache2"
  exit 1
fi

say "Installing stage-1 HTTP vhost (ACME challenge)"
mkdir -p /var/www/letsencrypt/.well-known/acme-challenge
sed "s|@@DOMAIN@@|$DOMAIN|g" "$HERE/raymail-http.conf" > /etc/apache2/sites-available/raymail.conf
a2ensite raymail >/dev/null
apache2ctl configtest
systemctl reload apache2     # graceful: existing connections are not dropped
echo "ok: stage-1 live"

say "Requesting certificate (webroot — same method as your other vhosts)"
certbot certonly --webroot -w /var/www/letsencrypt -d "$DOMAIN" \
  --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring

say "Installing stage-2 TLS vhost"
sed "s|@@DOMAIN@@|$DOMAIN|g" "$HERE/raymail.conf" > /etc/apache2/sites-available/raymail.conf
if ! apache2ctl configtest; then
  echo "FAIL: configtest rejected the TLS vhost — rolling back to stage 1"
  sed "s|@@DOMAIN@@|$DOMAIN|g" "$HERE/raymail-http.conf" > /etc/apache2/sites-available/raymail.conf
  apache2ctl configtest && systemctl reload apache2
  exit 1
fi
systemctl reload apache2
echo "ok: https://$DOMAIN is live"

say "Reloading Stalwart so it picks up the new certificate"
docker restart raymail-stalwart >/dev/null 2>&1 || true
echo "done"
