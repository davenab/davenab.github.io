// Dave Nab — site behaviour (v2): theme, nav, menu, scroll effects, carousel, lightbox, filters.
(function () {
  var root = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Footer year
  var yr = document.getElementById("yr"); if (yr) yr.textContent = new Date().getFullYear();

  // Theme toggle (remembered on this device)
  document.querySelectorAll(".theme").forEach(function (b) {
    b.addEventListener("click", function () {
      var dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    });
  });

  // Nav: glass on scroll + reading progress
  var nav = document.querySelector(".site-nav");
  var bar = document.querySelector(".progress span");
  var ticking = false;
  function onScroll() {
    var y = scrollY;
    if (nav) nav.classList.toggle("scrolled", y > 8);
    if (bar) {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, y / h) : 0) + ")";
    }
    fillWords();
    parallax();
    ticking = false;
  }
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);

  // Desktop dropdown: click/keyboard support (hover handled in CSS)
  document.querySelectorAll(".has-sub > .drop").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var li = btn.parentElement, open = !li.classList.contains("open");
      document.querySelectorAll(".has-sub.open").forEach(function (x) { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded", "false"); });
      li.classList.toggle("open", open); btn.setAttribute("aria-expanded", open);
    });
  });
  document.addEventListener("click", function () { document.querySelectorAll(".has-sub.open").forEach(function (x) { x.classList.remove("open"); }); });

  // Mobile sheet
  var sheet = document.getElementById("sheet");
  function setSheet(open) {
    if (!sheet) return;
    sheet.classList.toggle("open", open);
    document.body.classList.toggle("locked", open);
    sheet.setAttribute("aria-hidden", !open);
    document.querySelectorAll(".burger").forEach(function (b) { b.setAttribute("aria-expanded", open); });
    if (open) { var f = sheet.querySelector("a,button"); if (f) f.focus(); }
  }
  document.querySelectorAll(".burger").forEach(function (b) { b.addEventListener("click", function () { setSheet(true); }); });
  document.querySelectorAll(".sheet-close").forEach(function (b) { b.addEventListener("click", function () { setSheet(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setSheet(false); });

  // Reveal on scroll
  var revealEls = document.querySelectorAll(".reveal,.reveal-scale,.hl");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add(en.target.classList.contains("hl") ? "on" : "in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in", "on"); });
  }

  // Statement: words light up as the section scrolls through the viewport
  var stmts = [].slice.call(document.querySelectorAll(".statement p[data-fill]"));
  stmts.forEach(function (p) {
    p.innerHTML = p.textContent.trim().split(/\s+/).map(function (w) { return '<span class="wd">' + w + "</span>"; }).join(" ");
  });
  function fillWords() {
    stmts.forEach(function (p) {
      var r = p.getBoundingClientRect();
      var start = innerHeight * 0.85, end = innerHeight * 0.35;
      var t = (start - r.top) / (start - end + r.height * 0.6);
      t = reduce ? 1 : Math.max(0, Math.min(1, t));
      var words = p.children, n = Math.round(t * words.length);
      for (var i = 0; i < words.length; i++) words[i].classList.toggle("on", i < n);
    });
  }

  // Gentle parallax on decorative blobs
  var blobs = document.querySelectorAll("[data-parallax]");
  function parallax() {
    if (reduce) return;
    blobs.forEach(function (el) {
      var r = el.parentElement.getBoundingClientRect();
      var v = Math.max(-40, Math.min(40, (r.top - innerHeight / 2) * -0.08));
      el.style.setProperty("--py", v.toFixed(1) + "px");
    });
  }

  // Count-up numbers
  var counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window && !reduce) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, to = +el.dataset.count, suf = el.dataset.suffix || "", t0 = null;
        function step(ts) { if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / 1400); k = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * k) + suf; if (k < 1) requestAnimationFrame(step); }
        requestAnimationFrame(step); co.unobserve(el);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { co.observe(c); });
  }

  // Carousel arrows
  document.querySelectorAll("[data-carousel]").forEach(function (wrap) {
    var track = wrap.querySelector(".quotes"), prev = wrap.querySelector("[data-prev]"), next = wrap.querySelector("[data-next]");
    if (!track || !prev || !next) return;
    function step() { var c = track.querySelector(".quote"); return c ? c.getBoundingClientRect().width + 20 : 300; }
    function upd() { prev.disabled = track.scrollLeft < 4; next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 4; }
    prev.addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: reduce ? "auto" : "smooth" }); });
    next.addEventListener("click", function () { track.scrollBy({ left: step(), behavior: reduce ? "auto" : "smooth" }); });
    track.addEventListener("scroll", upd, { passive: true }); addEventListener("resize", upd); upd();
  });

  // Gallery lightbox
  var lb = document.getElementById("lightbox");
  if (lb && lb.showModal) {
    var lbImg = lb.querySelector("img"), lbCap = lb.querySelector("p");
    document.querySelectorAll(".gallery figure").forEach(function (f) {
      f.tabIndex = 0;
      function open() { var i = f.querySelector("img"); lbImg.src = i.currentSrc || i.src; lbImg.alt = i.alt; lbCap.textContent = f.querySelector("figcaption").textContent; lb.showModal(); }
      f.addEventListener("click", open);
      f.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("x")) lb.close(); });
  }

  // Filters: <div class="filters"><button data-f="all|x"> + items with data-cat="x"
  document.querySelectorAll(".filters").forEach(function (group) {
    var btns = group.querySelectorAll("button");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        var f = b.dataset.f;
        document.querySelectorAll("[data-cat]").forEach(function (c) { c.style.display = (f === "all" || c.dataset.cat === f) ? "" : "none"; });
      });
    });
  });

  onScroll();
})();
