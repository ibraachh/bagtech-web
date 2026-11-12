#!/usr/bin/env python3
"""BagTech static site generator.

    python3 _build/build.py

Reads   _build/templates/home.html      AZ homepage body (text inline, data-i18n keys)
        _build/i18n/{en,ru}.json        homepage + shared strings for EN / RU
        _build/i18n/ui.json             strings used by the generated templates
        _build/content/services.*.json  service pages (az / en / ru)
        _build/content/blog/*.html      articles (front matter + HTML body + FAQ)
        _build/site.json                company data, analytics ids, verification
Writes  every public page for three languages (AZ at /, EN at /en/, RU at /ru/),
        sitemap.xml, robots.txt, RSS feeds, llms.txt, 404.html.

Every page is plain static HTML in its own language: nothing is translated in
the browser, so search engines and AI crawlers read the real content.
"""
import datetime
import hashlib
import html
import json
import os
import re
import shutil

B = os.path.dirname(os.path.abspath(__file__)) + "/"
ROOT = os.path.dirname(B.rstrip("/")) + "/"
LANGS = ["az", "en", "ru"]
PREFIX = {"az": "", "en": "/en", "ru": "/ru"}
LOCALE = {"az": "az_AZ", "en": "en_US", "ru": "ru_RU"}
TODAY = datetime.date.today().isoformat()
e = html.escape


def load(path):
    with open(B + path, encoding="utf-8") as f:
        return json.load(f)


SITE_CFG = load("site.json")
SITE = SITE_CFG["site"]
UI = load("i18n/ui.json")
SMETA = load("content/services.meta.json")
SVC = {l: load(f"content/services.{l}.json") for l in LANGS}
BMETA = load("content/blog.meta.json")
ORDER = SMETA["order"]


def U(key, lang):
    return UI[key][lang]


# --------------------------------------------------------------------------
# i18n pre-rendering: replace the inner HTML of every [data-i18n] element
# --------------------------------------------------------------------------
TAG_RE = re.compile(r'<([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*?\sdata-i18n="([^"]+)"[^<>]*>')


def fill(src, d=None, collect=None):
    out, pos = [], 0
    while True:
        m = TAG_RE.search(src, pos)
        if not m:
            break
        tag, key = m.group(1), m.group(2)
        pat = re.compile(r"<(/?)%s\b[^>]*>" % re.escape(tag), re.I)
        depth, i = 1, m.end()
        while depth:
            mm = pat.search(src, i)
            depth += -1 if mm.group(1) else 1
            i = mm.end()
        inner = src[m.end():mm.start()]
        if collect is not None:
            collect[key] = inner.strip()
        out.append(src[pos:m.end()])
        out.append(d[key] if d and key in d else inner)
        pos = mm.start()
    out.append(src[pos:])
    return "".join(out)


TEMPLATE = open(B + "templates/home.html", encoding="utf-8").read()
HOME = {"az": {}}
fill(TEMPLATE, collect=HOME["az"])
HOME["en"] = load("i18n/en.json")
HOME["ru"] = load("i18n/ru.json")
for _l in ("en", "ru"):
    _missing = sorted(set(HOME["az"]) - set(HOME[_l]))
    assert not _missing, f"{_l}.json is missing keys: {_missing}"

# --------------------------------------------------------------------------
# blog content
# --------------------------------------------------------------------------
def read_post(key, lang):
    raw = open(B + f"content/blog/{key}.{lang}.html", encoding="utf-8").read()
    m = re.match(r"\s*<!--(.*?)-->", raw, re.S)
    fm = json.loads(m.group(1))
    rest = raw[m.end():]
    body, _, faq_src = rest.partition("<!--faq-->")
    faq = [(q.strip(), a.strip()) for q, a in re.findall(r"<h3>(.*?)</h3>\s*(.*?)(?=<h3>|\Z)", faq_src, re.S)]
    fm.update(body=body.strip(), faq=faq)
    return fm


POSTS = {l: {k: read_post(k, l) for k in BMETA["order"]} for l in LANGS}

# --------------------------------------------------------------------------
# routes
# --------------------------------------------------------------------------
ROUTES = {"home": {l: PREFIX[l] + "/" for l in LANGS},
          "hub": {l: "/" + SMETA["base"][l] + "/" for l in LANGS},
          "blog": {l: "/" + BMETA["base"][l] + "/" for l in LANGS}}
for k in ORDER:
    ROUTES["svc:" + k] = {l: f"/{SMETA['base'][l]}/{SMETA['slug'][k][l]}/" for l in LANGS}
for k in BMETA["order"]:
    ROUTES["post:" + k] = {l: f"/{BMETA['base'][l]}/{BMETA['slug'][k][l]}/" for l in LANGS}
AZ_PATH = {r["az"]: pid for pid, r in ROUTES.items()}


def url(pid, lang):
    return ROUTES[pid][lang]


def localize(src, lang):
    """Internal links are written with AZ paths; point them at this language."""
    def sub(m):
        pid = AZ_PATH.get(m.group(1))
        return f'href="{ROUTES[pid][lang]}{m.group(2) or ""}"' if pid else m.group(0)
    src = src.replace('aria-label="Menyu"', 'aria-label="%s"' % {"az": "Menyu", "en": "Menu", "ru": "Меню"}[lang])
    return re.sub(r'href="(/[^"#?]*)([#?][^"]*)?"', sub, src)


def strip_keys(src):
    return re.sub(r'\sdata-i18n="[^"]*"', "", src)


# --------------------------------------------------------------------------
# assets
# --------------------------------------------------------------------------
def asset_version():
    h = hashlib.md5()
    for d in ("assets/css", "assets/js"):
        for name in sorted(os.listdir(ROOT + d)):
            if name.endswith((".css", ".js")):
                h.update(open(ROOT + d + "/" + name, "rb").read())
    return h.hexdigest()[:10]


VER = asset_version()
FONTS = load("templates/fonts.json") if os.path.exists(B + "templates/fonts.json") else None

ARROW = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
ARROW_SM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
EXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>'


# --------------------------------------------------------------------------
# structured data
# --------------------------------------------------------------------------
def org_ld(lang):
    a = SITE_CFG["address"]
    address = {"@type": "PostalAddress", "addressLocality": a["city"][lang], "addressCountry": a["country"]}
    if a["street"]:
        address["streetAddress"] = a["street"]
    if a["postal_code"]:
        address["postalCode"] = a["postal_code"]
    org = {
        "@type": "Organization", "@id": f"{SITE}/#org", "name": SITE_CFG["name"], "legalName": SITE_CFG["legal_name"],
        "url": SITE + url("home", lang), "logo": f"{SITE}/assets/img/logo-light.png", "image": f"{SITE}/assets/img/og.jpg?v=2",
        "description": U("org.desc", lang), "foundingDate": SITE_CFG["founded"], "vatID": SITE_CFG["vat_id"],
        "email": SITE_CFG["email"], "telephone": SITE_CFG["phone"], "address": address,
        "areaServed": {"@type": "Country", "name": "Azerbaijan"},
        "knowsLanguage": ["az", "en", "ru"],
        "contactPoint": {"@type": "ContactPoint", "contactType": "sales", "telephone": SITE_CFG["phone"],
                         "email": SITE_CFG["email"], "availableLanguage": ["az", "en", "ru"]},
        "hasOfferCatalog": {"@type": "OfferCatalog", "name": U("crumb.services", lang), "itemListElement": [
            {"@type": "Offer", "itemOffered": {"@type": "Service", "name": SVC[lang][k]["h1"], "url": SITE + url("svc:" + k, lang)}}
            for k in ORDER]},
    }
    same = [v for v in SITE_CFG["socials"].values() if v]
    if same:
        org["sameAs"] = same
    if a["lat"] and a["lng"]:
        org["geo"] = {"@type": "GeoCoordinates", "latitude": a["lat"], "longitude": a["lng"]}
    return org


def site_ld(lang):
    return {"@type": "WebSite", "@id": f"{SITE}/#site", "url": SITE + "/", "name": SITE_CFG["name"],
            "inLanguage": LANGS, "publisher": {"@id": f"{SITE}/#org"}}


def webpage_ld(lang, pid, title, desc, kind="WebPage"):
    return {"@type": kind, "@id": SITE + url(pid, lang) + "#page", "url": SITE + url(pid, lang), "name": title,
            "description": desc, "inLanguage": lang, "isPartOf": {"@id": f"{SITE}/#site"}, "about": {"@id": f"{SITE}/#org"}}


def crumbs_ld(lang, trail):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": name, "item": SITE + path} for i, (name, path) in enumerate(trail, 1)]}


def faq_ld(pairs):
    strip = lambda s: re.sub(r"<[^>]+>", "", s)
    return {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": strip(q), "acceptedAnswer": {"@type": "Answer", "text": strip(a)}} for q, a in pairs]}


def graph(*nodes):
    return {"@context": "https://schema.org", "@graph": [n for n in nodes if n]}


# --------------------------------------------------------------------------
# page shell
# --------------------------------------------------------------------------
def lang_switch(pid, lang):
    links = []
    for l in LANGS:
        href = ROUTES[pid][l] if pid in ROUTES else ROUTES["home"][l]
        cur = ' class="is-active" aria-current="true"' if l == lang else ""
        links.append(f'<a href="{href}" hreflang="{l}" lang="{l}"{cur}>{l.upper()}</a>')
    return '<div class="lang" id="lang">' + "<span>/</span>".join(links) + "</div>"


def head(lang, pid, title, desc, ld, css=(), og_img=None, og_type="website", noindex=False, rss=False):
    canonical = SITE + url(pid, lang) if pid in ROUTES else None
    og_img = og_img or f"{SITE}/assets/img/og.jpg?v=2"
    h = [f'<!DOCTYPE html>\n<html lang="{lang}">\n<head>', '<meta charset="UTF-8">',
         '<meta name="viewport" content="width=device-width, initial-scale=1">',
         f"<title>{e(title)}</title>", f'<meta name="description" content="{e(desc)}">']
    if noindex:
        h.append('<meta name="robots" content="noindex, follow">')
    else:
        h.append('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">')
    if canonical:
        h.append(f'<link rel="canonical" href="{canonical}">')
        for l in LANGS:
            h.append(f'<link rel="alternate" hreflang="{l}" href="{SITE}{url(pid, l)}">')
        h.append(f'<link rel="alternate" hreflang="x-default" href="{SITE}{url(pid, "az")}">')
    h += ['<meta name="theme-color" content="#050508">',
          f'<meta property="og:type" content="{og_type}">', '<meta property="og:site_name" content="BagTech">',
          f'<meta property="og:title" content="{e(title)}">', f'<meta property="og:description" content="{e(desc)}">',
          f'<meta property="og:image" content="{og_img}">', '<meta property="og:image:width" content="1200">',
          '<meta property="og:image:height" content="630">', f'<meta property="og:locale" content="{LOCALE[lang]}">']
    h += [f'<meta property="og:locale:alternate" content="{LOCALE[l]}">' for l in LANGS if l != lang]
    if canonical:
        h.append(f'<meta property="og:url" content="{canonical}">')
    h += ['<meta name="twitter:card" content="summary_large_image">', f'<meta name="twitter:title" content="{e(title)}">',
          f'<meta name="twitter:description" content="{e(desc)}">', f'<meta name="twitter:image" content="{og_img}">']
    v = SITE_CFG["verification"]
    if v["google"]:
        h.append(f'<meta name="google-site-verification" content="{e(v["google"])}">')
    if v["bing"]:
        h.append(f'<meta name="msvalidate.01" content="{e(v["bing"])}">')
    h += ['<link rel="icon" type="image/png" sizes="512x512" href="/assets/img/favicon.png?v=1785582282">',
          '<link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png?v=1785582282">']
    if rss:
        h.append(f'<link rel="alternate" type="application/rss+xml" title="BagTech — {e(U("crumb.blog", lang))}" href="{url("blog", lang)}rss.xml">')
    if FONTS:
        h += [f'<link rel="preload" as="font" type="font/woff2" href="{f}" crossorigin>' for f in FONTS["preload"][lang]]
        h.append("<style>" + FONTS["css"] + "</style>")
    else:
        h += ['<link rel="preconnect" href="https://fonts.googleapis.com">', '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
              '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Inter:wght@400;500&family=Onest:wght@400;500;600&display=swap" rel="stylesheet">']
    for c in ("style.css",) + tuple(css):
        h.append(f'<link rel="stylesheet" href="/assets/css/{c}?v={VER}">')
    h.append('<script>document.documentElement.classList.add("js");</script>')
    h.append('<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False, separators=(",", ":")) + "</script>")
    h.append("</head>")
    return "\n".join(h)


def scripts(lang, js=()):
    an = SITE_CFG["analytics"]
    out = [f'<script src="/assets/js/{j}?v={VER}" defer></script>' for j in ("main.js",) + tuple(js)]
    out.append(f'<script src="/assets/js/analytics.js?v={VER}" defer data-ga4="{e(an["ga4_id"])}" data-gtm="{e(an["gtm_id"])}" '
               f'data-text="{e(U("consent.text", lang))}" data-yes="{e(U("consent.yes", lang))}" data-no="{e(U("consent.no", lang))}"></script>')
    return "\n".join(out)


def home_body(lang):
    """The homepage body in this language, links still AZ and <!--LANG--> in place."""
    src = fill(TEMPLATE, HOME[lang]) if lang != "az" else TEMPLATE
    return src


_PART = {}


def partials(lang):
    if lang not in _PART:
        src = home_body(lang)
        nav = src[src.index('<header class="nav" id="nav">'):src.index("</header>") + len("</header>")]
        foot = src[src.index('<footer class="x-foot">'):src.index("</footer>") + len("</footer>")]
        home = url("home", lang)
        fix = lambda s: re.sub(r'href="#(\w+)"', lambda m: f'href="{home}"' if m.group(1) == "top" else f'href="{home}#{m.group(1)}"', s)
        _PART[lang] = (fix(nav), fix(foot))
    return _PART[lang]


def write(path, content):
    full = ROOT + path.lstrip("/")
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)


PAGES = []   # (pid, lang) for the sitemap


def page(lang, pid, title, desc, main, ld, css=(), js=(), active=None, body_class="", **kw):
    nav, foot = partials(lang)
    if active:
        nav = nav.replace(f'<a href="{active}"', f'<a href="{active}" class="is-active"', 1)
    doc = "\n".join([
        head(lang, pid, title, desc, ld, css=css, **kw),
        f'<body class="{body_class}">',
        f'<a class="skip" href="#main">{U("skip", lang)}</a>',
        '<canvas class="signal" id="signal" aria-hidden="true"></canvas>',
        nav, f'<main id="main">\n{main}\n</main>', foot, scripts(lang, js), "</body>\n</html>\n"])
    doc = strip_keys(localize(doc, lang)).replace("<!--LANG-->", lang_switch(pid, lang))
    write(url(pid, lang) + "index.html", doc)
    PAGES.append((pid, lang))


# --------------------------------------------------------------------------
# shared blocks
# --------------------------------------------------------------------------
def faq_block(pairs):
    return '<div class="faq">\n' + "\n".join(
        f'<details class="faq__item"><summary><span>{q}</span><i></i></summary><div class="faq__a">{a if a.lstrip().startswith("<") else "<p>" + a + "</p>"}</div></details>'
        for q, a in pairs) + "\n</div>"


def section_head(eyebrow, title, tag="h2"):
    return (f'<div class="section-head" data-reveal-group data-reveal-step="0.1">\n'
            f'      <p class="eyebrow" data-reveal>{eyebrow}</p>\n'
            f'      <{tag} class="h-lg" data-reveal data-decode>{title}</{tag}>\n    </div>')


def cta_block(lang):
    home = url("home", "az")
    return f'''<section class="svc-sec">
  <div class="aurora" aria-hidden="true"></div>
  <div class="shell svc-cta">
    <div data-reveal>
      <h2>{U("cta.title", lang)}</h2>
      <p class="lead">{U("cta.lead", lang)}</p>
    </div>
    <div class="svc-cta__side" data-reveal>
      <a href="{home}#contact" class="btn btn-primary" data-track="cta_contact"><span>{U("cta.discuss", lang)}</span>{ARROW}</a>
      <div class="contact-list">
        <a href="tel:{SITE_CFG["phone"]}" data-track="cta_phone"><svg viewBox="0 0 24 24" stroke-width="1.6" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>+994 50 525 05 55</a>
        <a href="mailto:{SITE_CFG["email"]}" data-track="cta_email"><svg viewBox="0 0 24 24" stroke-width="1.6" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>{SITE_CFG["email"]}</a>
      </div>
    </div>
  </div>
</section>'''


def fmt_date(iso, lang):
    y, m, d = (int(x) for x in iso.split("-"))
    month = U("months", lang).split(",")[m - 1]
    return f"{month} {d}, {y}" if lang == "en" else f"{d} {month} {y}"


def reading_time(lang, body):
    words = len(re.sub(r"<[^>]+>", " ", body).split())
    return U("blog.min", lang).format(n=max(2, -(-words // {"az": 140, "ru": 150, "en": 180}[lang])))


def post_card(lang, key, fx=True):
    po, ph = POSTS[lang][key], BMETA["photo"][key]
    cat = SVC[lang][BMETA["service"][key]]["nav"]
    return f'''      <a class="post-card" href="{url("post:" + key, "az")}" data-cat="{BMETA["service"][key]}"{' data-fx="rise" data-fx-amt="30"' if fx else ''}>
        <div class="post-card__cover"><img src="/assets/img/blog/{ph["file"]}-800.webp" alt="{e(po["photo_alt"])}" width="800" height="{round(ph["h"] / 2)}" loading="lazy" decoding="async"></div>
        <div class="post-card__body">
          <p class="post-meta"><span class="post-meta__cat">{cat}</span><i></i><span>{reading_time(lang, po["body"])}</span></p>
          <h3>{po["title"]}</h3>
          <p>{po["desc"]}</p>
          <span class="post-card__go"><span>{U("blog.read", lang)}</span>{ARROW_SM}</span>
        </div>
      </a>'''


# --------------------------------------------------------------------------
# homepage
# --------------------------------------------------------------------------
def portfolio_ld():
    items = []
    for block in TEMPLATE.split('class="x-port__card')[1:]:
        name = re.search(r"<h3>([^<]+)</h3>", block)
        link = re.search(r'href="(https?://[^"]+)"', block.split("</h3>")[0] if 'href="http' in block.split("</h3>")[0] else block)
        if name and link and "is-soon" not in block[:40]:
            items.append({"@type": "ListItem", "position": len(items) + 1, "item": {"@type": "WebSite", "name": name.group(1), "url": link.group(1)}})
    return {"@type": "ItemList", "@id": f"{SITE}/#portfolio", "name": "BagTech portfolio", "itemListElement": items}


def build_home(lang):
    body = home_body(lang)
    # above-the-fold copy appears via CSS (no JS gate) so the headline is the LCP immediately
    a, b = body.index('<section class="hero"'), body.index("</section>", body.index('<section class="hero"'))
    hero = re.sub(r'\sdata-reveal(="[^"]*")?', "", body[a:b])
    hero = re.sub(r'\sstyle="transition-delay:[^"]*"', "", hero)
    body = body[:a] + hero + body[b:]
    body = body.replace('<form class="form x-cta__form" id="form"', f'<form class="form x-cta__form" id="form" ' + " ".join(f'data-{k}="{e(U("form." + k, lang))}"' for k in ("sent", "busy", "invalid", "rate", "err")))
    nav_end = body.index("</header>") + len("</header>")
    foot_start = body.index('<footer class="x-foot">')
    title, desc = U("home.title", lang), U("home.desc", lang)
    faq = [(HOME[lang][f"faq.{i}.q"], HOME[lang][f"faq.{i}.a"]) for i in range(1, 6)]
    ld = graph(org_ld(lang), site_ld(lang), webpage_ld(lang, "home", title, desc), faq_ld(faq), portfolio_ld())
    doc = "\n".join([
        head(lang, "home", title, desc, ld),
        "<body>", f'<a class="skip" href="#main">{U("skip", lang)}</a>',
        body[:nav_end], f'<main id="main">{body[nav_end:foot_start]}</main>', body[foot_start:],
        scripts(lang), "</body>\n</html>\n"])
    write(url("home", lang) + "index.html", strip_keys(localize(doc, lang)).replace("<!--LANG-->", lang_switch("home", lang)))
    PAGES.append(("home", lang))


# --------------------------------------------------------------------------
# services
# --------------------------------------------------------------------------
def build_service(lang, k):
    s = SVC[lang][k]
    no = f"{ORDER.index(k) + 1:02d}"
    pid = "svc:" + k
    home, hub = url("home", "az"), url("hub", "az")
    trail = [(U("crumb.home", lang), url("home", lang)), (U("crumb.services", lang), url("hub", lang)), (s["nav"], url(pid, lang))]
    tags = "".join(f"<span>{e(t)}</span>" for t in s["tags"])
    probs = "\n".join(f'        <div class="svc-prob" data-fx="rise" data-fx-amt="30"><h3>{t}</h3><p>{d}</p></div>' for t, d in s["problems"])
    inc = "\n".join(f'''        <article class="svc-card" data-fx="rise" data-fx-amt="36">
          <span class="svc-card__no">{i:02d}</span>
          <h3>{t}</h3>
          <p>{d}</p>
        </article>''' for i, (t, d) in enumerate(s["inc"], 1))
    out = "\n".join(f'''        <div class="svc-out__item" data-reveal>
          <b>{t}</b>
          <p>{d}</p>
        </div>''' for t, d in s["out"])
    H = HOME[lang]
    steps = "\n".join(f'''        <li data-fx="rise" data-fx-amt="30"><b>{i:02d}</b><h3>{H[f"proc.{i}.t"]}</h3><p>{H[f"proc.{i}.d"]}</p><span>{H[f"proc.{i}.m"]}</span></li>''' for i in range(1, 5))
    cases = ""
    if k in SMETA["projects"]:
        chips = "".join(f'<a href="{u}" target="_blank" rel="noopener">{e(n)}{EXT}</a>' for n, u in SMETA["projects"][k])
        cases = f'''
<section class="svc-sec">
  <div class="shell">
    {section_head(U("svc.cases.e", lang), U("svc.cases.t", lang))}
    <div class="svc-cases" data-reveal>{chips}</div>
    <a class="x-split__all" href="{home}#portfolio" data-reveal><span>{U("svc.cases.all", lang)}</span><i>{ARROW_SM}</i></a>
  </div>
</section>'''
    posts = "\n".join(post_card(lang, p) for p in SMETA["posts"].get(k, []))
    posts = f'''
<section class="svc-sec">
  <div class="shell">
    {section_head(U("svc.posts.e", lang), U("svc.posts.t", lang))}
    <div class="post-grid">
{posts}
    </div>
  </div>
</section>''' if posts else ""
    others = "\n".join(f'        <a href="{url("svc:" + o, "az")}"><em>{ORDER.index(o) + 1:02d}</em><span>{SVC[lang][o]["h1"]}</span>{ARROW_SM}</a>' for o in ORDER if o != k)
    main = f'''<section class="svc-hero" id="top">
  <div class="aurora" aria-hidden="true"></div>
  <div class="shell svc-hero__grid">
    <div class="svc-hero__copy">
      <nav class="crumbs" aria-label="breadcrumb"><a href="{home}">{U("crumb.home", lang)}</a><i></i><a href="{hub}">{U("crumb.services", lang)}</a><i></i><b>{no}</b></nav>
      <h1 class="h-xl svc-h1" data-decode>{s["h1"]}</h1>
      <p class="lead">{s["lead"]}</p>
      <div class="hero__cta">
        <a href="{home}#contact" class="btn btn-primary" data-track="cta_contact"><span>{U("cta.discuss", lang)}</span>{ARROW}</a>
        <a href="{hub}" class="btn btn-ghost"><span>{U("svc.all", lang)}</span></a>
      </div>
      <div class="svc-tags">{tags}</div>
    </div>
    <div class="svc-art" aria-hidden="true"><canvas data-art="{SMETA["art"][k]}"></canvas></div>
  </div>
</section>

<section class="svc-sec">
  <div class="shell">
    {section_head(U("svc.prob.e", lang), U("svc.prob.t", lang))}
    <div class="svc-probs">
{probs}
    </div>
  </div>
</section>

<section class="svc-sec">
  <div class="aurora" aria-hidden="true"></div>
  <div class="shell">
    {section_head(U("svc.inc.e", lang), U("svc.inc.t", lang))}
    <div class="svc-grid">
{inc}
    </div>
  </div>
</section>

<section class="svc-sec">
  <div class="shell">
    {section_head(U("svc.out.e", lang), U("svc.out.t", lang))}
    <div class="svc-out">
{out}
    </div>
  </div>
</section>

<section class="svc-sec">
  <div class="shell">
    {section_head(U("svc.proc.e", lang), U("svc.proc.t", lang))}
    <ol class="svc-steps">
{steps}
    </ol>
  </div>
</section>{cases}{posts}

<section class="svc-sec">
  <div class="shell x-faq__grid">
    {section_head(U("svc.faq.e", lang), U("svc.faq.t", lang))}
    {faq_block(s["faq"])}
  </div>
</section>

<section class="svc-sec">
  <div class="shell">
    {section_head(U("svc.other.e", lang), U("svc.other.t", lang))}
    <div class="svc-others" data-reveal>
{others}
    </div>
  </div>
</section>

{cta_block(lang)}'''
    service = {"@type": "Service", "@id": SITE + url(pid, lang) + "#service", "name": s["h1"], "serviceType": s["nav"],
               "description": s["lead"], "url": SITE + url(pid, lang), "provider": {"@id": f"{SITE}/#org"},
               "areaServed": {"@type": "Country", "name": "Azerbaijan"}, "inLanguage": lang}
    ld = graph(org_ld(lang), site_ld(lang), webpage_ld(lang, pid, s["seo_title"], s["desc"]), service, crumbs_ld(lang, trail), faq_ld(s["faq"]))
    page(lang, pid, s["seo_title"], s["desc"], main, ld, css=("service.css", "blog.css"), js=("service.js",),
         active=f'{url("home", lang)}#solutions', body_class="svc-page")


def build_hub(lang):
    hub = SVC[lang]["_hub"]
    H = HOME[lang]
    trail = [(U("crumb.home", lang), url("home", lang)), (U("crumb.services", lang), url("hub", lang))]
    cards = "\n".join(f'''      <a class="svc-card svc-card--link" href="{url("svc:" + k, "az")}" data-fx="rise" data-fx-amt="36">
        <span class="svc-card__no">{i:02d}</span>
        <h2>{SVC[lang][k]["h1"]}</h2>
        <p>{H[f"sol.{k}.d"]}</p>
        <span class="post-card__go"><span>{U("svc.more", lang)}</span>{ARROW_SM}</span>
      </a>''' for i, k in enumerate(ORDER, 1))
    main = f'''<section class="blog-hero" id="top">
  <div class="aurora" aria-hidden="true"></div>
  <div class="shell">
    <nav class="crumbs" aria-label="breadcrumb"><a href="{url("home", "az")}">{U("crumb.home", lang)}</a><i></i><b>{U("crumb.services", lang)}</b></nav>
    <h1 class="h-xl" data-decode>{hub["h1"]}</h1>
    <p class="lead">{hub["lead"]}</p>
  </div>
</section>

<section class="svc-sec" style="border-top:0;padding-top:0">
  <div class="shell">
    <div class="svc-grid">
{cards}
    </div>
  </div>
</section>

{cta_block(lang)}'''
    items = {"@type": "ItemList", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": SVC[lang][k]["h1"], "url": SITE + url("svc:" + k, lang)} for i, k in enumerate(ORDER, 1)]}
    ld = graph(org_ld(lang), site_ld(lang), webpage_ld(lang, "hub", hub["seo_title"], hub["desc"], "CollectionPage"), items, crumbs_ld(lang, trail))
    page(lang, "hub", hub["seo_title"], hub["desc"], main, ld, css=("service.css", "blog.css"),
         active=f'{url("home", lang)}#solutions', body_class="svc-page")


# --------------------------------------------------------------------------
# blog
# --------------------------------------------------------------------------
def build_blog(lang):
    title, desc = U("blog.title", lang), U("blog.desc", lang)
    trail = [(U("crumb.home", lang), url("home", lang)), (U("crumb.blog", lang), url("blog", lang))]
    cats = []
    for k in BMETA["order"]:
        c = BMETA["service"][k]
        if c not in cats:
            cats.append(c)
    filters = "".join(f'<button type="button" data-cat="{c}">{SVC[lang][c]["nav"]}</button>' for c in cats)
    main = f'''<section class="blog-hero" id="top">
  <div class="aurora" aria-hidden="true"></div>
  <div class="shell">
    <nav class="crumbs" aria-label="breadcrumb"><a href="{url("home", "az")}">{U("crumb.home", lang)}</a><i></i><b>{U("crumb.blog", lang)}</b></nav>
    <h1 class="h-xl" data-decode>{U("blog.h1", lang)}</h1>
    <p class="lead">{U("blog.lead", lang)}</p>
    <div class="blog-filter"><button type="button" class="is-active" data-cat="all">{U("blog.all", lang)}</button>{filters}</div>
  </div>
</section>

<section class="svc-sec" style="border-top:0;padding-top:0">
  <div class="shell">
    <div class="post-grid post-grid--index">
{chr(10).join(post_card(lang, k) for k in BMETA["order"])}
    </div>
  </div>
</section>'''
    blog = {"@type": "Blog", "@id": SITE + url("blog", lang) + "#blog", "name": title, "url": SITE + url("blog", lang), "inLanguage": lang,
            "publisher": {"@id": f"{SITE}/#org"},
            "blogPost": [{"@type": "BlogPosting", "headline": POSTS[lang][k]["title"], "url": SITE + url("post:" + k, lang),
                          "datePublished": BMETA["published"]} for k in BMETA["order"]]}
    ld = graph(org_ld(lang), site_ld(lang), webpage_ld(lang, "blog", title, desc, "CollectionPage"), blog, crumbs_ld(lang, trail))
    page(lang, "blog", title, desc, main, ld, css=("service.css", "blog.css"), js=("blog.js",),
         active=url("blog", lang), body_class="blog-page", rss=True)


def build_post(lang, k):
    po, ph = POSTS[lang][k], BMETA["photo"][k]
    pid = "post:" + k
    svc = BMETA["service"][k]
    cat = SVC[lang][svc]["nav"]
    f = ph["file"]
    utm = "utm_source=bagtech&utm_medium=referral"
    order = BMETA["order"]
    more = [order[(order.index(k) + n) % len(order)] for n in (1, 2, 3)]
    trail = [(U("crumb.home", lang), url("home", lang)), (U("crumb.blog", lang), url("blog", lang)), (po["title"], url(pid, lang))]
    updated = ""
    if BMETA["modified"] != BMETA["published"]:
        updated = f'<i></i><span>{U("blog.updated", lang)}: <time datetime="{BMETA["modified"]}">{fmt_date(BMETA["modified"], lang)}</time></span>'
    faq = f'\n<h2>{U("blog.faq", lang)}</h2>\n{faq_block(po["faq"])}' if po["faq"] else ""
    main = f'''<section class="post-hero" id="top">
  <div class="aurora" aria-hidden="true"></div>
  <div class="shell">
    <nav class="crumbs" aria-label="breadcrumb"><a href="{url("home", "az")}">{U("crumb.home", lang)}</a><i></i><a href="{url("blog", "az")}">{U("crumb.blog", lang)}</a><i></i><b>{cat}</b></nav>
    <h1>{po["title"]}</h1>
    <p class="post-meta"><time datetime="{BMETA["published"]}">{fmt_date(BMETA["published"], lang)}</time>{updated}<i></i><span>{reading_time(lang, po["body"])}</span><i></i><span>{U("blog.author", lang)}</span></p>
    <p class="lead">{po["lead"]}</p>
    <figure class="post-photo">
      <img src="/assets/img/blog/{f}-1600.webp" srcset="/assets/img/blog/{f}-800.webp 800w, /assets/img/blog/{f}-1600.webp 1600w" sizes="(max-width: 1400px) 100vw, 1300px" alt="{e(po["photo_alt"])}" width="{ph["w"]}" height="{ph["h"]}" fetchpriority="high" decoding="async">
      <figcaption>{U("blog.photo", lang)}: <a href="https://unsplash.com/@{ph["handle"]}?{utm}" target="_blank" rel="noopener">{e(ph["author"])}</a> / <a href="https://unsplash.com/?{utm}" target="_blank" rel="noopener">Unsplash</a></figcaption>
    </figure>
  </div>
</section>

<div class="shell post-layout">
  <aside class="toc" aria-label="{U("blog.toc", lang)}"><p class="toc__title">{U("blog.toc", lang)}</p><ol></ol></aside>
  <div class="post-main">
    <article class="post-body">
{po["body"]}{faq}
    </article>
    <div class="post-help">
      <div>
        <h3>{U("blog.help.t", lang)}</h3>
        <p>{U("blog.help.d", lang)}</p>
      </div>
      <div class="post-help__actions">
        <a href="{url("home", "az")}#contact" class="btn btn-primary" data-track="cta_contact"><span>{U("cta.discuss", lang)}</span>{ARROW}</a>
        <a href="{url("svc:" + svc, "az")}" class="btn btn-ghost"><span>{SVC[lang][svc]["h1"]}</span></a>
      </div>
    </div>
    <p class="post-author"><img src="/assets/img/logo-light.webp" alt="BagTech" width="110" height="38" loading="lazy"><span>{U("blog.author", lang)}</span><span>·</span><time datetime="{BMETA["published"]}">{fmt_date(BMETA["published"], lang)}</time></p>
  </div>
</div>

<section class="svc-sec">
  <div class="shell">
    {section_head(U("crumb.blog", lang), U("blog.more.t", lang))}
    <div class="post-grid">
{chr(10).join(post_card(lang, m) for m in more)}
    </div>
  </div>
</section>'''
    words = len(re.sub(r"<[^>]+>", " ", po["body"]).split())
    posting = {"@type": "BlogPosting", "@id": SITE + url(pid, lang) + "#post", "headline": po["title"], "description": po["desc"],
               "url": SITE + url(pid, lang), "mainEntityOfPage": SITE + url(pid, lang), "datePublished": BMETA["published"],
               "dateModified": BMETA["modified"], "inLanguage": lang, "image": f"{SITE}/assets/img/blog/{f}-og.jpg",
               "articleSection": cat, "wordCount": words,
               "author": {"@type": "Organization", "@id": f"{SITE}/#org", "name": "BagTech", "url": SITE + "/"},
               "publisher": {"@id": f"{SITE}/#org"}, "about": {"@id": SITE + url("svc:" + svc, lang) + "#service"}}
    ld = graph(org_ld(lang), site_ld(lang), posting, crumbs_ld(lang, trail), faq_ld(po["faq"]) if po["faq"] else None)
    page(lang, pid, po["seo_title"], po["desc"], main, ld, css=("service.css", "blog.css"), js=("blog.js",),
         active=url("blog", lang), body_class="blog-page", og_img=f"{SITE}/assets/img/blog/{f}-og.jpg", og_type="article", rss=True)


# --------------------------------------------------------------------------
# site files
# --------------------------------------------------------------------------
def build_404():
    lang = "az"
    links = "".join(f'<a class="btn btn-ghost" href="{url("home", l)}" hreflang="{l}"><span>{U("crumb.home", l)}</span></a>' for l in LANGS)
    main = f'''<section class="blog-hero e404" id="top">
  <div class="aurora" aria-hidden="true"></div>
  <div class="shell">
    <p class="eyebrow">404</p>
    <h1 class="h-xl">{U("e404.h1", "az")}</h1>
    <p class="lead">{U("e404.lead", "az")}<br><span lang="en">{U("e404.lead", "en")}</span><br><span lang="ru">{U("e404.lead", "ru")}</span></p>
    <div class="hero__cta">{links}<a class="btn btn-primary" href="{url("hub", "az")}"><span>{U("crumb.services", "az")}</span></a><a class="btn btn-ghost" href="{url("blog", "az")}"><span>{U("crumb.blog", "az")}</span></a></div>
  </div>
</section>'''
    nav, foot = partials(lang)
    nav = nav.replace("<!--LANG-->", lang_switch("home", lang))
    doc = "\n".join([head(lang, "404", U("e404.title", lang), U("e404.lead", lang), graph(site_ld(lang)), css=("service.css", "blog.css"), noindex=True),
                     '<body class="blog-page">', '<canvas class="signal" id="signal" aria-hidden="true"></canvas>', nav,
                     f'<main id="main">\n{main}\n</main>', foot, scripts(lang), "</body>\n</html>\n"])
    write("/404.html", strip_keys(doc))


def build_redirect_stubs():
    for old, new in SMETA["redirects"].items():
        write(old + "index.html", f'<!DOCTYPE html>\n<html lang="az"><head><meta charset="UTF-8"><title>BagTech</title>'
              f'<meta name="robots" content="noindex"><link rel="canonical" href="{SITE}{new}">'
              f'<meta http-equiv="refresh" content="0; url={new}"></head><body><a href="{new}">{new}</a></body></html>\n')


def build_sitemap():
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    prio = lambda pid: "1.0" if pid == "home" else "0.9" if pid == "hub" else "0.8" if pid.startswith("svc:") else "0.7" if pid == "blog" else "0.6"
    for pid in ROUTES:
        for lang in LANGS:
            out.append(f"  <url>\n    <loc>{SITE}{url(pid, lang)}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <priority>{prio(pid)}</priority>")
            out += [f'    <xhtml:link rel="alternate" hreflang="{l}" href="{SITE}{url(pid, l)}"/>' for l in LANGS]
            out.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}{url(pid, "az")}"/>\n  </url>')
    out.append("</urlset>\n")
    write("/sitemap.xml", "\n".join(out))


def build_robots():
    write("/robots.txt", f"""User-agent: *
Allow: /
Disallow: /_build/
Disallow: /deploy/

# AI / answer-engine crawlers are welcome
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: {SITE}/sitemap.xml
""")


def build_rss(lang):
    pub = datetime.datetime.strptime(BMETA["published"], "%Y-%m-%d").strftime("%a, %d %b %Y 09:00:00 +0400")
    items = "".join(f"""
    <item>
      <title>{e(POSTS[lang][k]["title"])}</title>
      <link>{SITE}{url("post:" + k, lang)}</link>
      <guid isPermaLink="true">{SITE}{url("post:" + k, lang)}</guid>
      <pubDate>{pub}</pubDate>
      <description>{e(POSTS[lang][k]["desc"])}</description>
    </item>""" for k in BMETA["order"])
    write(url("blog", lang) + "rss.xml", f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{e(U("blog.title", lang))}</title>
    <link>{SITE}{url("blog", lang)}</link>
    <atom:link href="{SITE}{url("blog", lang)}rss.xml" rel="self" type="application/rss+xml"/>
    <description>{e(U("blog.desc", lang))}</description>
    <language>{lang}</language>{items}
  </channel>
</rss>
""")


def build_llms():
    l = "en"
    lines = ["# BagTech", "", "> " + U("org.desc", l), "",
             f"- Legal name: {SITE_CFG['legal_name']} (VOEN {SITE_CFG['vat_id']}), founded {SITE_CFG['founded']}, Baku, Azerbaijan",
             f"- Contact: {SITE_CFG['phone']}, {SITE_CFG['email']}",
             "- Languages: Azerbaijani (default, /), English (/en/), Russian (/ru/)", "", "## Services", ""]
    lines += [f"- [{SVC[l][k]['h1']}]({SITE}{url('svc:' + k, l)}): {SVC[l][k]['desc']}" for k in ORDER]
    lines += ["", "## Articles", ""]
    lines += [f"- [{POSTS[l][k]['title']}]({SITE}{url('post:' + k, l)}): {POSTS[l][k]['desc']}" for k in BMETA["order"]]
    lines += ["", "## Other languages", "", f"- [Azərbaycanca]({SITE}/): {U('home.desc', 'az')}", f"- [Русский]({SITE}/ru/): {U('home.desc', 'ru')}",
              "", "## Optional", "", f"- [Sitemap]({SITE}/sitemap.xml)", f"- [Blog RSS]({SITE}{url('blog', l)}rss.xml)", ""]
    write("/llms.txt", "\n".join(lines))


def main():
    for d in ("xidmetler", "blog", "en", "ru"):       # generated folders only
        shutil.rmtree(ROOT + d, ignore_errors=True)
    for lang in LANGS:
        build_home(lang)
        build_hub(lang)
        for k in ORDER:
            build_service(lang, k)
        build_blog(lang)
        for k in BMETA["order"]:
            build_post(lang, k)
        build_rss(lang)
    build_404()
    build_redirect_stubs()
    build_sitemap()
    build_robots()
    build_llms()
    print(f"built {len(PAGES)} pages ({len(ROUTES)} per language), assets v={VER}")


if __name__ == "__main__":
    main()
