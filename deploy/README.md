# Deploy — bagtech.az

The site is static HTML generated into this repository and served by the
system nginx on the server straight from a git clone.

## Change content, then publish

```bash
python3 _build/build.py     # regenerates every page in az / en / ru
python3 _build/check.py     # must print "0 problems"
git add -A && git commit -m "…" && git push
ssh root@<server> 'git -C /var/www/bagtech.az pull'
```

Nothing restarts: nginx serves the files as they are.

## Where things are

| What | Where |
|---|---|
| Homepage text (AZ) | `_build/templates/home.html` |
| Homepage text (EN / RU) | `_build/i18n/en.json`, `_build/i18n/ru.json` |
| Service pages | `_build/content/services.{az,en,ru}.json` |
| Blog articles | `_build/content/blog/<key>.{az,en,ru}.html` |
| Company data, analytics ids, search-console codes | `_build/site.json` |
| nginx vhost (copy of the one on the server) | `deploy/nginx/bagtech.conf` |

Generated — do not edit by hand: `index.html`, `en/`, `ru/`, `xidmetler/`,
`blog/`, `404.html`, `sitemap.xml`, `robots.txt`, `llms.txt`.

## Server

- Files: `/var/www/bagtech.az`
- nginx: `/etc/nginx/sites-available/bagtech.conf`, enabled as
  `sites-enabled/zz-bagtech.conf`. After changing it: `nginx -t && systemctl reload nginx`.
- The same server runs mail and other projects: touch only the files above.

## Contact form

The form on the homepage posts JSON to `/api/contact`. nginx proxies it to
`bagtech-form.service` (`deploy/form/app.py`, Python standard library only,
127.0.0.1:8787), which sends the message through the mail server from
`info@bagtech.az` with Reply-To set to the visitor.

- Unit: `/etc/systemd/system/bagtech-form.service` (copy of `deploy/form/bagtech-form.service`)
- Settings and SMTP password: `/etc/bagtech-form.env` (root, mode 600, not in git):
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_TO` (comma-separated), `LISTEN_PORT`
- Change recipients or password: edit the env file, then `systemctl restart bagtech-form`
- After `git pull` that changes `app.py`: `systemctl restart bagtech-form`
- Logs: `journalctl -u bagtech-form` (no message contents are logged)

`deploy.sh`, `server-setup.sh` and `ssl-setup.sh` were written for an earlier
docker-based server and do not apply to the current one.
