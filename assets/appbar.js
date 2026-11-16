/* davenab.com shared app bar + "What next?" box.
   Load in every app:  <script src="/assets/appbar.js"></script>  (before the app's own script).
   - Adds a slim bar at the top of the page: DN Dave Nab · All apps · Resources.
   - Apps call  DNNext.html("<app-id>")  on their finish screen to show 2–3 next steps.
   To add an app: add it to APPS and give it a NEXT list. */
(function () {
  var APPS = {
    notes:    { t: "DAVE Notes", d: "Practise lecture note-taking with real talks", u: "/note-taking-trainer-ted/" },
    grammar:  { t: "Grammar Self-Correction Trainer", d: "Find and fix your own grammar errors with codes and hints", u: "/grammar-self-correction/" },
    nomhedge: { t: "Nominalisation and Hedging Trainer", d: "Short practice for a more academic style", u: "/nominalisation-hedging-trainer/" }
  };
  var RES_STUDENTS = { t: "Resources for students", d: "Free Quizlet sets and self-study packs", u: "/resources/students/" };
  var HEDGING = { t: "Hedging in Academic Writing", d: "A ready-to-teach lesson for teachers", u: "/resources/hedging-in-academic-writing/" };
  var NEXT = {
    notes:    { lead: "Finished your notes? Keep going:", items: [APPS.grammar, APPS.nomhedge, RES_STUDENTS] },
    grammar:  { lead: "Fixed your errors? Try this next:", items: [APPS.nomhedge, APPS.notes, RES_STUDENTS] },
    nomhedge: { lead: "Done with nominalisation and hedging? Try this next:", items: [APPS.grammar, HEDGING, APPS.notes] }
  };

  var CSS =
    ".dn-appbar{background:#14181f;color:#e8ebf0;font:500 13px/1 Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;position:relative;z-index:60}" +
    ".dn-appbar-in{max-width:1180px;margin:0 auto;display:flex;align-items:center;gap:4px 14px;flex-wrap:wrap;min-height:36px;padding:4px max(16px,env(safe-area-inset-right,0px)) 4px max(16px,env(safe-area-inset-left,0px))}" +
    ".dn-appbar a{color:#e8ebf0;text-decoration:none;padding:6px 2px;opacity:.82}.dn-appbar a:hover,.dn-appbar a:focus-visible{opacity:1;text-decoration:underline;text-underline-offset:3px}" +
    ".dn-appbar .dn-brand{display:inline-flex;align-items:center;gap:8px;opacity:1;font-weight:700;margin-right:auto}" +
    ".dn-appbar .dn-mark{width:22px;height:22px;border-radius:6px;background:#FFFF00;color:#14181f;display:grid;place-items:center;font-size:10px;font-weight:800;letter-spacing:-.03em}" +
    ".dn-appbar a:focus-visible{outline:2px solid #FFFF00;outline-offset:2px;border-radius:4px}" +
    ".dn-next{margin:28px 0 8px;padding:22px;border-radius:18px;border:1px solid rgba(127,127,127,.28);background:rgba(127,127,127,.06);font-family:inherit}" +
    ".dn-next h2{margin:0 0 4px;font-size:1.2rem;display:flex;align-items:center;gap:8px}.dn-next h2::before{content:'';width:9px;height:9px;border-radius:50%;background:#FFFF00;box-shadow:0 0 0 1px rgba(0,0,0,.25)}" +
    ".dn-next p{margin:0 0 14px;opacity:.8}" +
    ".dn-next ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}" +
    ".dn-next a{display:block;height:100%;padding:14px 16px;border-radius:14px;border:1px solid rgba(127,127,127,.3);text-decoration:none;color:inherit;background:rgba(255,255,255,.04);transition:transform .3s cubic-bezier(.16,1,.3,1),border-color .2s}" +
    ".dn-next a:hover{transform:translateY(-2px);border-color:currentColor}.dn-next a b{display:block;margin-bottom:3px}.dn-next a span{font-size:.9em;opacity:.75}" +
    "@media print{.dn-appbar,.dn-next{display:none}}@media (prefers-reduced-motion:reduce){.dn-next a{transition:none}}";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function addStyle() {
    if (document.getElementById("dn-appbar-css")) return;
    var st = document.createElement("style"); st.id = "dn-appbar-css"; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function addBar() {
    if (document.querySelector(".dn-appbar")) return;
    var bar = document.createElement("div");
    bar.className = "dn-appbar";
    bar.setAttribute("role", "navigation");
    bar.setAttribute("aria-label", "Dave Nab website");
    bar.innerHTML = '<div class="dn-appbar-in"><a class="dn-brand" href="/"><span class="dn-mark" aria-hidden="true">DN</span>Dave Nab</a>' +
      '<a href="/apps/">All apps</a><a href="/resources/">Resources</a></div>';
    var skip = document.querySelector("body > a.skip, body > .skip");
    if (skip && skip.nextSibling) document.body.insertBefore(bar, skip.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  window.DNNext = {
    html: function (app) {
      var n = NEXT[app]; if (!n) return "";
      addStyle();
      return '<aside class="dn-next no-print" aria-labelledby="dn-next-h"><h2 id="dn-next-h">What next?</h2><p>' + esc(n.lead) + "</p><ul>" +
        n.items.map(function (it) { return '<li><a href="' + it.u + '"><b>' + esc(it.t) + "</b><span>" + esc(it.d) + "</span></a></li>"; }).join("") +
        "</ul></aside>";
    }
  };

  addStyle();
  if (document.body) addBar(); else document.addEventListener("DOMContentLoaded", addBar);
})();
