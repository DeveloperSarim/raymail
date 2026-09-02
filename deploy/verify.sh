#!/usr/bin/env bash
# Read-only verification of the RayMail deployment. Changes nothing.
DOMAIN=mail.sarimtools.com
b(){ printf '\n\033[1m== %s\033[0m\n' "$*"; }

b "containers"
docker compose -f /root/raymail/docker-compose.yml ps 2>/dev/null

b "listening sockets owned by RayMail"
ss -tlpnH | grep -E ':(25|465|587|993|3880|3881)\b' || echo "none bound yet"

b "host isolation check (these must be UNTOUCHED)"
printf '  apache2 : %s\n' "$(systemctl is-active apache2)"
printf '  mariadb : %s\n' "$(systemctl is-active mariadb 2>/dev/null || echo n/a)"
printf '  other containers running: %s\n' "$(docker ps -q | wc -l)"

b "SMTP submission banner (587)"
timeout 8 bash -c 'exec 3<>/dev/tcp/127.0.0.1/587; head -1 <&3' 2>/dev/null || echo "no banner"

b "IMAPS (993) TLS handshake"
timeout 10 openssl s_client -connect 127.0.0.1:993 -servername $DOMAIN -brief </dev/null 2>&1 | head -8 || true

b "webmail"
curl -s -o /dev/null -w '  127.0.0.1:3880 -> HTTP %{http_code}\n' --max-time 10 http://127.0.0.1:3880/ || true
