#!/usr/bin/env bash
# BagTech — issue the LE certificate, then re-run server-setup to add the 443 block.
set -euo pipefail
certbot certonly --webroot -w /var/www/bagtech.az \
    -d bagtech.az -d www.bagtech.az \
    --deploy-hook "docker exec eticksystem-nginx nginx -s reload"
bash "$(dirname "$0")/server-setup.sh"
echo '--- https check ---'
curl -sI https://bagtech.az | head -3
