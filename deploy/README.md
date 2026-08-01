# Deploy — bagtech.az

Server: 76.13.120.8 · static site, nginx. Everything below is **additive**:
its own directory (`/var/www/bagtech.az`) and its own nginx file. Existing
projects on the server are not touched.

## First-time setup (run on the server)

```bash
# 1. get the site
sudo git clone https://github.com/ibraachh/bagtech-web.git /var/www/bagtech.az

# 2. nginx site (separate file; nothing shared is modified)
sudo cp /var/www/bagtech.az/deploy/nginx/bagtech.az.conf /etc/nginx/sites-available/bagtech.az
sudo ln -sf /etc/nginx/sites-available/bagtech.az /etc/nginx/sites-enabled/bagtech.az
#   (if the server uses conf.d instead of sites-*: copy to /etc/nginx/conf.d/bagtech.az.conf)

# 3. validate BEFORE reload — protects every other site on the box
sudo nginx -t && sudo systemctl reload nginx

# 4. HTTPS (after http://bagtech.az answers)
sudo certbot --nginx -d bagtech.az -d www.bagtech.az
```

## Updating to the latest version

```bash
sudo /var/www/bagtech.az/deploy/deploy.sh
```

That's it — the script pulls `origin/main` and prints the deployed commit.
