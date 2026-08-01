#!/usr/bin/env bash
# BagTech — wire bagtech.az into the dockerized nginx (eticksystem-nginx).
# Idempotent: safe to re-run. Touches ONLY:
#   - its own container  (bagtech-static)
#   - /opt/eticksystem-app/nginx/nginx.conf  (backup first; marker-delimited block;
#     in-place edit keeps the inode so the bind mount stays live)
set -euo pipefail

SITE_DIR="/var/www/bagtech.az"
CONF="/opt/eticksystem-app/nginx/nginx.conf"
PROXY_CONTAINER="eticksystem-nginx"
STATIC="bagtech-static"
BIND="172.17.0.1:8083"

# 1) static-file container (house pattern, LAN-only bind)
if ! docker ps -a --format '{{.Names}}' | grep -qx "$STATIC"; then
    docker run -d --name "$STATIC" --restart unless-stopped \
        -p ${BIND}:80 -v ${SITE_DIR}:/usr/share/nginx/html:ro nginx:alpine
else
    docker start "$STATIC" >/dev/null 2>&1 || true
fi

# 2) backup, then strip every previous bagtech block (inode-safe)
BAK="${CONF}.bak.$(date +%s)"
cp "$CONF" "$BAK"
python3 - "$CONF" <<'PY'
import sys
p = sys.argv[1]
with open(p, 'r+') as f:
    out, skip = [], False
    for line in f.read().splitlines(True):
        if '>>> bagtech.az' in line: skip = True;  continue
        if '<<< bagtech.az' in line: skip = False; continue
        if not skip: out.append(line)
    while out and out[-1].strip() == '': out.pop()
    f.seek(0); f.write(''.join(out) + '\n'); f.truncate()
PY

# 3) append fresh blocks (http always; ssl only once the cert exists)
{
echo ''
echo '# >>> bagtech.az http'
cat <<'EOF'
server {
    listen 80;
    server_name bagtech.az www.bagtech.az;

    location ~ /\.(git|gitignore) { return 404; }
    location ^~ /deploy/ { return 404; }

    location / {
        proxy_pass http://172.17.0.1:8083;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
echo '# <<< bagtech.az'
} >> "$CONF"

if [ -f /etc/letsencrypt/live/bagtech.az/fullchain.pem ]; then
{
echo ''
echo '# >>> bagtech.az ssl'
cat <<'EOF'
server {
    listen 443 ssl;
    server_name bagtech.az www.bagtech.az;

    ssl_certificate     /etc/letsencrypt/live/bagtech.az/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bagtech.az/privkey.pem;

    if ($host = www.bagtech.az) { return 301 https://bagtech.az$request_uri; }

    location ~ /\.(git|gitignore) { return 404; }
    location ^~ /deploy/ { return 404; }

    location / {
        proxy_pass http://172.17.0.1:8083;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
echo '# <<< bagtech.az'
} >> "$CONF"
fi

# 4) validate BEFORE reload; restore the backup if the test fails
if docker exec "$PROXY_CONTAINER" nginx -t; then
    docker exec "$PROXY_CONTAINER" nginx -s reload
else
    echo '!! nginx -t failed — restoring previous config'
    cat "$BAK" > "$CONF"     # cat > keeps the inode
    exit 1
fi

echo '--- diagnostics ---'
echo '[static direct]';  curl -sI "http://${BIND}" | head -3
echo '[via proxy, full headers]'; curl -sI http://127.0.0.1 -H 'Host: bagtech.az'
echo '[config block]'; grep -n 'bagtech' "$CONF" | head -6
