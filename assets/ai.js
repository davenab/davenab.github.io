/* davenab.com shared AI feedback helper (assets/ai.js).
   One place for every app that asks Dave's Cloudflare Worker (https://api.davenab.com) for feedback.
   - No API key here or anywhere in the repo: the Worker holds the AI binding.
   - Sends only what the app passes in. The Worker does not store or log student text.
   - Light limit per device (default 10 requests per hour per app), plus the Worker's own limits.
   Usage:  DNAI.post("/notes", { ... }, { app: "notes", timeout: 20000 }).then(json).catch(err => err.message)
   Set window.DNAI_OFF = true before this script to switch AI off for a page. */
(function () {
  var BASE = "https://api.davenab.com";
  var PER_HOUR = 10;
  function now() { return Date.now(); }
  function key(app) { return "dnai-" + app; }
  function recent(app) {
    try { var a = JSON.parse(localStorage.getItem(key(app)) || "[]"); return a.filter(function (t) { return now() - t < 3600000; }); }
    catch (e) { return []; }
  }
  function note(app) { try { var a = recent(app); a.push(now()); localStorage.setItem(key(app), JSON.stringify(a)); } catch (e) {} }
  function err(code, msg) { var e = new Error(msg); e.code = code; return e; }

  var MESSAGES = {
    "device-limit": "You have asked for AI feedback many times in the last hour. Take a short break, check your work yourself, and try again later.",
    "slow-down": "Too many requests in a short time. Wait a minute, then try again.",
    "daily-limit": "AI feedback has reached today’s limit for the whole site. Please check your work yourself today, and try again tomorrow.",
    "timeout": "AI feedback took too long to answer. Please check your work yourself, or try again later.",
    "network": "Couldn’t connect to AI feedback. Check your internet connection, then try again.",
    "too-long": "Your text is too long for AI feedback. Please shorten it.",
    "too-short": "Write a little more first, then ask for feedback.",
    "off": "AI feedback is switched off on this page.",
    "server": "AI feedback isn’t available right now. Please check your work yourself, or try again later."
  };

  window.DNAI = {
    base: BASE,
    available: function () { return !window.DNAI_OFF; },
    left: function (app, perHour) { return Math.max(0, (perHour || PER_HOUR) - recent(app || "app").length); },
    message: function (code) { return MESSAGES[code] || MESSAGES.server; },
    post: function (route, payload, opts) {
      opts = opts || {};
      var app = opts.app || "app", limit = opts.perHour || PER_HOUR;
      if (window.DNAI_OFF) return Promise.reject(err("off", MESSAGES.off));
      if (recent(app).length >= limit) return Promise.reject(err("device-limit", MESSAGES["device-limit"]));
      note(app);
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, opts.timeout || 20000);
      return fetch(BASE + route, {
        method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload),
        credentials: "omit", cache: "no-store", signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (j) {
          clearTimeout(timer);
          if (!r.ok) { var c = (j && j.error) || "server"; throw err(c, MESSAGES[c] || MESSAGES.server); }
          if (!j) throw err("server", MESSAGES.server);
          return j;
        });
      }, function (e) {
        clearTimeout(timer);
        throw (e && e.name === "AbortError") ? err("timeout", MESSAGES.timeout) : err("network", MESSAGES.network);
      });
    }
  };
})();
