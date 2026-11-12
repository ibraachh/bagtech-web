#!/usr/bin/env python3
"""Checks every generated page.  python3 _build/check.py

title / description / single h1 / canonical / hreflang reciprocity / JSON-LD /
internal links and assets resolve / no leftover translation keys / no stray
Azerbaijani text on EN and RU pages / valid tag nesting.
"""
import glob
import html.parser
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
SITE = "https://bagtech.az"
VOID = {"img", "br", "meta", "link", "input", "path", "rect", "circle", "source", "hr"}
# proper names that legitimately contain Azerbaijani letters on every language version
NAMES = ["ADAU THİK", "OYGİB", "İnsun", "Bakı", "PAŞA", "Yığım", "ATİB", "Azərbaycan", "Əlaqə", "VÖEN", "Azərbaycanca", "Tələbə", "Həmkarlar",
         "İttifaqı", "Komitəsi", "Dövlət", "Aqrar", "Universiteti", "Türkiyə", "İş", "Adamları", "Birliyi", "Yaşam Mərkəzi", "İnsun Yaşam Mərkəzi"]


class Parser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack, self.errors, self.h1, self.links, self.assets, self.text = [], [], 0, [], [], []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "h1":
            self.h1 += 1
        if tag == "a" and a.get("href") and not a.get("hreflang"):   # language switcher links are checked via hreflang
            self.links.append(a["href"])
        for k in ("src", "href"):
            v = a.get(k, "")
            if tag in ("img", "script", "link") and v.startswith("/") and not (tag == "link" and a.get("rel") in ("canonical", "alternate")):
                self.assets.append(v)
        for k in ("placeholder", "aria-label"):      # visible / spoken text that lives in attributes
            if a.get(k):
                self.text.append(a[k])
        if tag == "img" and a.get("srcset"):
            self.assets += [p.split()[0] for p in a["srcset"].split(",")]
        if tag in ("script", "style"):
            self.skip += 1
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag in ("script", "style"):
            self.skip -= 1
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        else:
            self.errors.append(f"unexpected </{tag}> at line {self.getpos()[0]}")

    def handle_data(self, data):
        if not self.skip:
            self.text.append(data)


def exists(path):
    path = path.split("#")[0].split("?")[0]
    if not path:
        return True
    full = ROOT + path.lstrip("/")
    return os.path.isfile(full) or os.path.isfile(full.rstrip("/") + "/index.html")


pages = [p for p in glob.glob(ROOT + "**/index.html", recursive=True) if "/_build/" not in p and "/node_modules/" not in p]
problems, canon, alts = [], {}, {}
for f in sorted(pages):
    rel = "/" + os.path.relpath(f, ROOT).replace("index.html", "")
    rel = "/" if rel == "/./" else rel
    s = open(f, encoding="utf-8").read()
    if 'http-equiv="refresh"' in s:
        continue                                  # redirect stub
    p = Parser()
    p.feed(s)
    err = lambda m: problems.append(f"{rel}: {m}")
    lang = re.search(r'<html lang="(\w+)"', s).group(1)
    title = re.search(r"<title>(.*?)</title>", s, re.S)
    desc = re.search(r'<meta name="description" content="([^"]*)"', s)
    if not title or not 25 <= len(html.unescape(title.group(1))) <= 70:
        err(f"title length {len(html.unescape(title.group(1))) if title else 0}")
    if not desc or not 110 <= len(html.unescape(desc.group(1))) <= 170:
        err(f"description length {len(html.unescape(desc.group(1))) if desc else 0}")
    if p.h1 != 1:
        err(f"{p.h1} h1 elements")
    if p.stack or p.errors:
        err(f"markup: {p.stack[:3]} {p.errors[:2]}")
    if "data-i18n" in s:
        err("leftover data-i18n")
    c = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    if not c or c.group(1) != SITE + rel:
        err(f"canonical {c.group(1) if c else None}")
    canon[rel] = lang
    alts[rel] = dict(re.findall(r'<link rel="alternate" hreflang="([\w-]+)" href="([^"]+)"', s))
    if set(alts[rel]) != {"az", "en", "ru", "x-default"}:
        err(f"hreflang set {sorted(alts[rel])}")
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            json.loads(block)
        except ValueError as ex:
            err(f"JSON-LD: {ex}")
    for link in p.links:
        if link.startswith("/") and not exists(link):
            err(f"broken link {link}")
        if link.startswith("/") and lang != "az" and not link.startswith(f"/{lang}/") and not link.startswith("/assets/"):
            err(f"link leaves the {lang} version: {link}")
        if link in ("#", ""):
            err("empty link")
    for a in p.assets:
        if not exists(a):
            err(f"missing asset {a}")
    if lang != "az":
        text = " ".join(p.text)
        for n in NAMES:
            text = text.replace(n, "")
        stray = sorted(set(re.findall(r"\w*[əƏğĞıİşŞçÇöÖüÜ]\w*", text))) if lang == "en" else sorted(set(re.findall(r"\w*[əƏğĞıİşŞöÖüÜ]\w*", text)))
        if stray:
            err(f"Azerbaijani text on {lang} page: {stray[:8]}")

# hreflang must be reciprocal and point at pages of the right language
for rel, a in alts.items():
    for l in ("az", "en", "ru"):
        target = a.get(l, "").replace(SITE, "")
        if target not in canon:
            problems.append(f"{rel}: hreflang {l} -> missing page {target}")
        elif canon[target] != l:
            problems.append(f"{rel}: hreflang {l} -> page in {canon[target]}")
        elif alts[target].get(canon[rel] if canon[rel] in alts[target] else "az", "").replace(SITE, "") != rel and canon[rel] in ("az", "en", "ru"):
            if alts[target].get(canon[rel], "").replace(SITE, "") != rel:
                problems.append(f"{rel}: hreflang {l} not reciprocal")

sm = open(ROOT + "sitemap.xml").read()
locs = re.findall(r"<loc>([^<]+)</loc>", sm)
missing = [l for l in locs if l.replace(SITE, "") not in canon]
extra = [r for r in canon if SITE + r not in locs]
if missing or extra:
    problems.append(f"sitemap: not a page {missing[:3]} / page not listed {extra[:3]}")

print(f"{len(canon)} pages, {len(locs)} sitemap URLs, {len(problems)} problems")
for pr in problems[:60]:
    print(" -", pr)
sys.exit(1 if problems else 0)
