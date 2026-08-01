# Deploy — bagtech.az (docker topology)

Ports 80/443 are owned by the `eticksystem-nginx` container. bagtech.az is
served by its own tiny container (`bagtech-static`, bound to 172.17.0.1:8083
only) and proxied from eticksystem-nginx — same pattern as `shamil-static`.
Nothing belonging to other projects is modified; the proxy config lives in a
marker-delimited block inside the host-mounted
`/opt/eticksystem-app/nginx/nginx.conf` (backed up on every run, validated
with `nginx -t` before reload, auto-restored on failure).

## First-time / repair
```bash
sudo /var/www/bagtech.az/deploy/deploy.sh          # pull latest
sudo bash /var/www/bagtech.az/deploy/server-setup.sh
```

## HTTPS (once HTTP answers)
```bash
sudo bash /var/www/bagtech.az/deploy/ssl-setup.sh
```

## Updates (content only — nothing restarts)
```bash
sudo /var/www/bagtech.az/deploy/deploy.sh
```
