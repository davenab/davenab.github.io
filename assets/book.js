// Booking form: validates, shows follow-up questions, and sends answers to Dave's Google Form.
(function () {
  var form = document.getElementById("book");
  if (!form) return;
  var done = document.getElementById("done");
  var errBox = document.getElementById("form-error");
  var send = document.getElementById("send");

  // Google Form field IDs (Student Information Form)
  var E = {
    name: "entry.2005620554", city: "entry.1166974658", phone: "entry.1065046570", email: "entry.1045781291",
    course: "entry.839337160", date: "entry.1602675884", days: "entry.1573697063", time: "entry.977660314",
    level: "entry.1798921216", taken: "entry.2121070506", score: "entry.1271947897", goal: "entry.119884832", heard: "entry.916084987"
  };
  var SERVICE = {
    "ielts-live": ["IELTS", "IELTS Live Skills Mastery Program"],
    "ielts-writing": ["IELTS", "IELTS Independent Study Program (Writing, Canvas)"],
    "speaking-mock": ["IELTS", "IELTS Speaking Mock Test ($30)"],
    "writing-mock": ["IELTS", "IELTS Writing Mock Test ($25 / $35)"],
    "speaking-fluency": ["General English", "Speaking Fluency Course"],
    "level-up": ["General English", "General English Level UP Course"]
  };

  // Preselect a service from ?service=...
  var want = new URLSearchParams(location.search).get("service");
  if (want) { var r = form.querySelector('input[name="service"][value="' + want + '"]'); if (r) r.checked = true; }

  // Show the visitor's local time for the Sydney time slots
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== "Australia/Sydney") {
      var fmt = function (h) {
        var now = new Date(), syd = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
        var diff = now - syd, d = new Date(syd); d.setHours(h, 0, 0, 0);
        return new Date(d.getTime() + diff).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      };
      document.getElementById("tz-hint").textContent = "In your time zone: mornings are " + fmt(8) + " – " + fmt(13) + ", afternoons are " + fmt(13) + " – " + fmt(18) + ".";
    }
  } catch (e) {}

  // Follow-up question: IELTS score only if they've taken the test
  var scoreWrap = document.getElementById("score-wrap");
  form.addEventListener("change", function (e) {
    if (e.target.name === "taken") scoreWrap.hidden = e.target.value !== "Yes";
    var f = e.target.closest(".field,.fs"); if (f) f.classList.remove("bad");
    progress();
  });
  form.addEventListener("input", function (e) { var f = e.target.closest(".field"); if (f) f.classList.remove("bad"); });

  // Progress dots: one per fieldset that is complete
  var sets = form.querySelectorAll(".fs"), dots = form.querySelectorAll(".steps span");
  function progress() { sets.forEach(function (fs, i) { if (dots[i]) dots[i].classList.toggle("on", i === 0 || complete(fs)); }); }
  function complete(fs) { return [].slice.call(fs.querySelectorAll("input[required],textarea[required]")).every(function (i) { return i.type === "radio" ? !!fs.querySelector('input[name="' + i.name + '"]:checked') : i.value.trim() !== ""; }); }

  function val(n) { var el = form.querySelector('[name="' + n + '"]:checked') || form.querySelector('[name="' + n + '"]:not([type=radio]):not([type=checkbox])'); return el ? el.value.trim() : ""; }

  function validate() {
    var bad = [];
    function mark(el) { var f = el.closest(".field") || el.closest(".fs"); f.classList.add("bad"); bad.push(f); }
    ["name", "city", "phone", "goal", "heard"].forEach(function (n) { var el = form.elements[n]; if (!el.value.trim()) mark(el); });
    var em = form.elements.email; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim())) mark(em);
    ["service", "time", "level", "taken"].forEach(function (n) { if (!val(n)) mark(form.querySelector('[name="' + n + '"]')); });
    if (!form.querySelector('[name="days"]:checked')) mark(form.querySelector('[name="days"]'));
    if (val("taken") === "Yes" && !val("score")) mark(form.querySelector('[name="score"]'));
    if (bad.length) { bad[0].scrollIntoView({ behavior: "smooth", block: "center" }); var i = bad[0].querySelector("input,textarea"); if (i) i.focus({ preventScroll: true }); }
    return !bad.length;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errBox.hidden = true;
    if (!validate()) return;
    var s = SERVICE[val("service")];
    var p = new URLSearchParams();
    p.append(E.name, val("name")); p.append(E.city, val("city")); p.append(E.phone, val("phone")); p.append(E.email, val("email"));
    p.append(E.course, s[0]);
    form.querySelectorAll('[name="days"]:checked').forEach(function (c) { p.append(E.days, c.value); });
    p.append(E.time, val("time")); p.append(E.level, val("level")); p.append(E.taken, val("taken"));
    if (val("taken") === "Yes") p.append(E.score, val("score"));
    var d = val("date"); if (d) { var x = d.split("-"); p.append(E.date + "_year", x[0]); p.append(E.date + "_month", +x[1]); p.append(E.date + "_day", +x[2]); }
    p.append(E.goal, "[" + s[1] + "] " + val("goal"));
    p.append(E.heard, val("heard"));

    send.disabled = true; send.firstChild.textContent = "Sending… ";
    fetch(form.action, { method: "POST", mode: "no-cors", body: p })
      .then(function () {
        document.getElementById("done-name").textContent = val("name").split(" ")[0] || "your request is in";
        done.dataset.sent = "1"; form.hidden = true; done.hidden = false; done.focus(); scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch(function () {
        errBox.textContent = "Your request couldn’t be sent. Check your internet connection and try again, or email dave.naserbakht@gmail.com.";
        errBox.hidden = false; send.disabled = false; send.firstChild.textContent = "Send booking request ";
      });
  });
  progress();

})();
