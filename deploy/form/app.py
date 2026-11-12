#!/usr/bin/env python3
"""Contact form endpoint for bagtech.az — POST /api/contact (JSON) -> e-mail.

Standard library only. Listens on 127.0.0.1; nginx proxies /api/contact to it.
Settings come from the environment (systemd EnvironmentFile=/etc/bagtech-form.env):

  SMTP_HOST, SMTP_PORT (587, STARTTLS), SMTP_USER, SMTP_PASS,
  MAIL_FROM (defaults to SMTP_USER), MAIL_TO (comma-separated), LISTEN_PORT
"""
import json
import os
import re
import smtplib
import ssl
import sys
import threading
import time
from collections import defaultdict, deque
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ENV = os.environ
SMTP_HOST = ENV["SMTP_HOST"]
SMTP_PORT = int(ENV.get("SMTP_PORT", "587"))
SMTP_USER = ENV["SMTP_USER"]
SMTP_PASS = ENV["SMTP_PASS"]
MAIL_FROM = ENV.get("MAIL_FROM", SMTP_USER)
MAIL_TO = [a.strip() for a in ENV["MAIL_TO"].split(",") if a.strip()]
PORT = int(ENV.get("LISTEN_PORT", "8787"))

LIMITS = {"name": 100, "company": 150, "email": 200, "phone": 40, "topic": 80, "message": 5000, "lang": 5, "page": 300}
EMAIL_RE = re.compile(r"^[^@\s<>\"',;]+@[^@\s<>\"',;]+\.[^@\s<>\"',;]{2,}$")
PER_IP = (5, 600)        # at most 5 messages per IP in 10 minutes
GLOBAL = (60, 3600)      # and 60 per hour in total
MIN_FILL_SECONDS = 3     # faster than this is a bot

_hits = defaultdict(deque)
_lock = threading.Lock()


def allowed(key, limit, window):
    now = time.time()
    with _lock:
        q = _hits[key]
        while q and q[0] < now - window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True


def clean(v, n):
    v = str(v or "").replace("\r", " ").replace("\x00", "").strip()
    return v[:n]


def one_line(v):
    return re.sub(r"\s+", " ", v)


def send(d, ip, ua):
    subject = f"Saytdan müraciət — {one_line(d['name'])}" + (f" ({one_line(d['company'])})" if d["company"] else "")
    body = "\n".join([
        "bagtech.az saytındakı formadan yeni müraciət.",
        "",
        f"Ad:       {d['name']}",
        f"Şirkət:   {d['company'] or '—'}",
        f"E-poçt:   {d['email'] or '—'}",
        f"Telefon:  {d['phone'] or '—'}",
        f"Mövzu:    {d['topic'] or '—'}",
        f"Dil:      {d['lang'] or '—'}",
        "",
        "Mesaj:",
        d["message"] or "—",
        "",
        "—",
        f"Səhifə: {d['page'] or '—'}",
        f"IP: {ip}",
        f"Brauzer: {one_line(ua)[:200]}",
        "Cavab vermək üçün sadəcə bu məktuba cavab yazın (Reply-To müştərinin ünvanıdır)." if d["email"]
        else "Müştəri e-poçt ünvanı yazmayıb — telefonla əlaqə saxlayın.",
    ])
    m = EmailMessage()
    m["From"] = formataddr(("BagTech sayt", MAIL_FROM))
    m["To"] = ", ".join(MAIL_TO)
    if d["email"]:
        m["Reply-To"] = formataddr((one_line(d["name"]), d["email"]))
    m["Subject"] = one_line(subject)[:200]
    m["Date"] = formatdate(localtime=True)
    m["Message-ID"] = make_msgid(domain=MAIL_FROM.split("@")[-1])
    m.set_content(body)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
        s.starttls(context=ssl.create_default_context())
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(m)


class Handler(BaseHTTPRequestHandler):
    server_version = "bagtech-form"
    sys_version = ""

    def reply(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        if self.path.split("?")[0] != "/api/contact":
            return self.reply(404, {"ok": False})
        ip = self.headers.get("CF-Connecting-IP") or self.headers.get("X-Real-IP") or self.client_address[0]
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if not 0 < n <= 20000:
                return self.reply(413, {"ok": False, "error": "size"})
            raw = json.loads(self.rfile.read(n).decode("utf-8"))
            if not isinstance(raw, dict):
                raise ValueError
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, {"ok": False, "error": "format"})

        # bots: hidden field filled in, or the form was sent too fast
        if raw.get("website"):
            return self.reply(200, {"ok": True})
        try:
            if float(raw.get("elapsed", 0)) < MIN_FILL_SECONDS:
                return self.reply(200, {"ok": True})
        except (TypeError, ValueError):
            pass

        d = {k: clean(raw.get(k), n) for k, n in LIMITS.items()}
        d.update({k: one_line(d[k]) for k in d if k != "message"})
        d["phone"] = re.sub(r"[^\d+()\- ]", "", d["phone"]).strip()
        email_ok = bool(EMAIL_RE.match(d["email"]))
        phone_ok = len(re.sub(r"\D", "", d["phone"])) >= 7
        if not d["name"] or (d["email"] and not email_ok) or not (email_ok or phone_ok):
            return self.reply(422, {"ok": False, "error": "invalid"})
        if not allowed(ip, *PER_IP) or not allowed("*", *GLOBAL):
            return self.reply(429, {"ok": False, "error": "rate"})
        try:
            send(d, ip, self.headers.get("User-Agent", ""))
        except Exception as ex:                       # keep the reason in the journal, not in the reply
            print(f"send failed: {type(ex).__name__}: {ex}", file=sys.stderr, flush=True)
            return self.reply(502, {"ok": False, "error": "mail"})
        print(f"sent: lang={d['lang']} ip={ip}", flush=True)
        return self.reply(200, {"ok": True})

    def do_GET(self):
        self.reply(405, {"ok": False})

    def log_message(self, fmt, *args):
        pass                                          # no access log with personal data


if __name__ == "__main__":
    print(f"listening on 127.0.0.1:{PORT}, mail to {len(MAIL_TO)} recipient(s)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
