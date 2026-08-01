#!/usr/bin/env bash
# BagTech deploy: pull the latest version from GitHub.
# Touches ONLY /var/www/bagtech.az — nothing else on the server.
set -euo pipefail

REPO="https://github.com/ibraachh/bagtech-web.git"
SITE_DIR="/var/www/bagtech.az"

if [ ! -d "$SITE_DIR/.git" ]; then
    echo "→ first deploy: cloning into $SITE_DIR"
    mkdir -p "$SITE_DIR"
    git clone --depth 1 "$REPO" "$SITE_DIR"
else
    echo "→ updating $SITE_DIR"
    git -C "$SITE_DIR" fetch --depth 1 origin main
    git -C "$SITE_DIR" reset --hard origin/main
fi

# static content only — no service restarts needed
echo "→ deployed: $(git -C "$SITE_DIR" log -1 --format='%h %s (%ci)')"
