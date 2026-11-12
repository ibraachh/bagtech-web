/* =========================================================
   BagTech — analytics hooks
   Events are always pushed to window.dataLayer (nothing leaves the
   browser by itself). Google Analytics 4 / Tag Manager load only when
   an id is configured in _build/site.json AND the visitor accepts.

   Events: cta_click {id, text}, contact_click {channel},
           form_submit {topic}, outbound_click {url}, lang_switch {to},
           faq_open {question}, scroll_depth {percent}
   ========================================================= */
(() => {
  "use strict";
  const me = document.currentScript;
  const GA4 = me?.dataset.ga4 || "";
  const GTM = me?.dataset.gtm || "";
  const KEY = "bt-consent";

  window.dataLayer = window.dataLayer || [];
  const track = (event, params = {}) => window.dataLayer.push({ event, page_lang: document.documentElement.lang, ...params });
  window.btTrack = track;

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a, button");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const text = (a.textContent || "").trim().slice(0, 60);
    if (href.startsWith("tel:")) return track("contact_click", { channel: "phone" });
    if (href.startsWith("mailto:")) return track("contact_click", { channel: "email" });
    if (a.closest("#lang")) return track("lang_switch", { to: a.getAttribute("hreflang") });
    if (a.dataset.track || a.matches(".btn-primary")) return track("cta_click", { id: a.dataset.track || "cta", text });
    if (/^https?:\/\//.test(href) && !href.includes(location.hostname)) track("outbound_click", { url: href });
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "form") track("form_submit", { topic: e.target.elements.topic?.value || "" });
  });
  document.addEventListener("toggle", (e) => {
    if (e.target.matches?.(".faq__item") && e.target.open) track("faq_open", { question: e.target.querySelector("summary")?.textContent.trim().slice(0, 100) });
  }, true);
  const marks = [25, 50, 75, 90];
  addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max <= 0) return;
    const pct = (scrollY / max) * 100;
    while (marks.length && pct >= marks[0]) track("scroll_depth", { percent: marks.shift() });
  }, { passive: true });

  /* ---------- loader, gated on configuration and consent ---------- */
  if (!GA4 && !GTM) return;

  const load = () => {
    const add = (src) => { const s = document.createElement("script"); s.async = true; s.src = src; document.head.append(s); };
    if (GTM) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      add("https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(GTM));
    } else {
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", GA4, { anonymize_ip: true });
      add("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4));
    }
  };

  let choice = null;
  try { choice = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (choice === "yes") return load();
  if (choice === "no") return;

  const bar = document.createElement("div");
  bar.className = "consent";
  bar.setAttribute("role", "dialog");
  const text = document.createElement("span");
  text.textContent = me.dataset.text || "";
  const actions = document.createElement("div");
  actions.className = "consent__actions";
  const button = (label, cls, value) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn " + cls;
    b.textContent = label;
    b.addEventListener("click", () => {
      try { localStorage.setItem(KEY, value); } catch { /* storage blocked */ }
      bar.remove();
      if (value === "yes") load();
    });
    return b;
  };
  actions.append(button(me.dataset.no || "Decline", "btn-ghost", "no"), button(me.dataset.yes || "Accept", "btn-primary", "yes"));
  bar.append(text, actions);
  document.body.append(bar);
})();
