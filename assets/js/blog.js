/* =========================================================
   BagTech — blog behaviour
   · index: category filter
   · article: table of contents built from the h2s, with the
     section currently being read highlighted
   ========================================================= */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- index: filter by category ---------- */
  const filter = $(".blog-filter");
  if (filter) {
    filter.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $$("button", filter).forEach((x) => x.classList.toggle("is-active", x === b));
      const cat = b.dataset.cat;
      $$(".post-grid .post-card").forEach((card) => {
        card.classList.toggle("is-hidden", cat !== "all" && card.dataset.cat !== cat);
      });
      dispatchEvent(new Event("scroll"));      // let reveal/fx re-measure
    });
  }

  /* ---------- article: contents ---------- */
  const body = $(".post-body");
  const toc = $(".toc ol");
  if (!body || !toc) return;

  const slug = (s) => s.toLowerCase()
    .replace(/[əƏ]/g, "e").replace(/[ıİ]/g, "i").replace(/[öÖ]/g, "o").replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s").replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  let heads = [];
  const build = () => {
    heads = $$("h2", body);
    toc.innerHTML = "";
    heads.forEach((h, i) => {
      h.id = `${slug(h.textContent) || "s"}-${i + 1}`;
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      li.append(a);
      toc.append(li);
    });
    paint();
  };

  const paint = () => {
    const line = innerHeight * 0.3;
    let current = 0;
    heads.forEach((h, i) => { if (h.getBoundingClientRect().top < line) current = i; });
    $$("a", toc).forEach((a, i) => a.classList.toggle("is-active", i === current));
  };

  let pending = false;
  addEventListener("scroll", () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { paint(); pending = false; });
  }, { passive: true });

  // the language switch rewrites the article body: rebuild the contents after it
  $$("#lang button").forEach((b) => b.addEventListener("click", () => setTimeout(build, 0)));
  build();
})();
