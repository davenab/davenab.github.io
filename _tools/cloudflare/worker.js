/* davenab-api: a small Cloudflare Worker for davenab.com.
   It does three things and stores NO personal data:

   POST /e         Anonymous score summaries from the Grammar and Vocabulary hubs (only if the
                   student said yes). Stored in D1: month, hub, unit, level, kind, pre, post.
                   No IP address, no user agent, no ID, no free text.
   GET  /stats     Averages per unit, for Dave's impact report. Groups with fewer than 5
                   results are hidden so no one can be singled out.
   POST /feedback  AI feedback on a few sentences a student wrote, using Cloudflare Workers AI.
                   The text is sent to the model and then forgotten: it is never logged or stored.
                   Protected by a per-minute rate limit and a daily cap (to stay inside the free tier).

   Bindings (set in wrangler.toml or the dashboard):
     DB               D1 database (schema in schema.sql)
     AI               Workers AI
     FEEDBACK_LIMITER optional rate-limit binding (10 requests per minute per visitor)
   Variables:
     ALLOWED_ORIGINS  comma-separated, e.g. "https://davenab.com,https://www.davenab.com"
     DAILY_AI_CAP     max AI feedback requests per day for the whole site (default 150)
     AI_MODEL         Workers AI model id (default below)
*/

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const SLUG = /^[a-z0-9-]{1,40}$/;
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const HUBS = ["grammar", "vocab"];
const KINDS = ["pre", "post"];
const MAX_TEXT = 900; // characters of student writing sent to the AI

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/" && req.method === "GET") return text("davenab-api is running.", 200, cors);

    // Browser requests from other websites are refused.
    if (origin && !cors["Access-Control-Allow-Origin"]) return json({ error: "origin" }, 403, cors);

    try {
      if (url.pathname === "/e" && req.method === "POST") return await logEvent(req, env, cors);
      if (url.pathname === "/stats" && req.method === "GET") return await stats(url, env, cors);
      if (url.pathname === "/feedback" && req.method === "POST") return await feedback(req, env, cors);
    } catch (e) {
      return json({ error: "server" }, 500, cors);
    }
    return json({ error: "not-found" }, 404, cors);
  }
};

/* ---------- CORS ---------- */
function corsHeaders(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "https://davenab.com,https://www.davenab.com,https://davenab.github.io")
    .split(",").map(s => s.trim()).filter(Boolean);
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const h = { "Vary": "Origin", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" };
  if (origin && (allowed.includes(origin) || local)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
function json(obj, status, cors) { return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
function text(s, status, cors) { return new Response(s, { status, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } }); }
function month() { return new Date().toISOString().slice(0, 7); }
function day() { return new Date().toISOString().slice(0, 10); }
function pct(n) { return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null; }

async function readJson(req, maxBytes) {
  const raw = await req.text();
  if (raw.length > maxBytes) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/* ---------- POST /e : anonymous score summary ---------- */
async function logEvent(req, env, cors) {
  const b = await readJson(req, 1000);
  if (!b || b.v !== 1) return json({ error: "bad" }, 400, cors);
  const hub = HUBS.includes(b.hub) ? b.hub : null;
  const unit = typeof b.unit === "string" && SLUG.test(b.unit) ? b.unit : null;
  const level = LEVELS.includes(b.level) ? b.level : null;
  const kind = KINDS.includes(b.kind) ? b.kind : null;
  const pre = pct(b.pre);
  const post = kind === "post" ? pct(b.post) : null;
  if (!hub || !unit || !level || !kind || pre === null || (kind === "post" && post === null)) return json({ error: "bad" }, 400, cors);
  // Only these fields are stored. The month is set here, not by the browser.
  await env.DB.prepare("INSERT INTO events (month, hub, unit, level, kind, pre, post) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(month(), hub, unit, level, kind, pre, post).run();
  return new Response(null, { status: 204, headers: cors });
}

/* ---------- GET /stats : averages per unit (groups under 5 hidden) ---------- */
async function stats(url, env, cors) {
  const hub = HUBS.includes(url.searchParams.get("hub")) ? url.searchParams.get("hub") : null;
  const where = hub ? "WHERE hub = ?" : "";
  const q = `SELECT hub, unit, level,
      SUM(kind = 'pre') AS started,
      SUM(kind = 'post') AS finished,
      ROUND(AVG(CASE WHEN kind = 'post' THEN pre END), 1) AS avg_before,
      ROUND(AVG(CASE WHEN kind = 'post' THEN post END), 1) AS avg_after,
      ROUND(AVG(CASE WHEN kind = 'post' THEN post - pre END), 1) AS avg_gain,
      ROUND(100.0 * SUM(kind = 'post' AND post > pre) / NULLIF(SUM(kind = 'post'), 0), 1) AS pct_improved
    FROM events ${where} GROUP BY hub, unit, level ORDER BY hub, level, unit`;
  const stmt = hub ? env.DB.prepare(q).bind(hub) : env.DB.prepare(q);
  const { results } = await stmt.all();
  const rows = results.map(r => r.finished >= 5 ? r : { hub: r.hub, unit: r.unit, level: r.level, started: r.started >= 5 ? r.started : "fewer than 5", finished: "fewer than 5" });
  return new Response(JSON.stringify({ updated: day(), units: rows }, null, 2), { status: 200, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}

/* ---------- POST /feedback : AI feedback on a student's sentences ---------- */
async function feedback(req, env, cors) {
  if (!env.AI) return json({ error: "ai-off" }, 503, cors);

  // 1) Per-visitor rate limit (the IP is used only in memory by Cloudflare's limiter; never stored).
  if (env.FEEDBACK_LIMITER) {
    const key = req.headers.get("CF-Connecting-IP") || "anon";
    const { success } = await env.FEEDBACK_LIMITER.limit({ key });
    if (!success) return json({ error: "slow-down" }, 429, cors);
  }

  const b = await readJson(req, 4000);
  if (!b) return json({ error: "bad" }, 400, cors);
  const studentText = String(b.text || "").trim().slice(0, MAX_TEXT);
  const task = String(b.task || "").slice(0, 300);
  const target = String(b.target || "").slice(0, 200);
  const level = LEVELS.includes(b.level) ? b.level : "B2";
  const hub = b.hub === "vocab" ? "vocab" : "grammar";
  if (studentText.length < 10) return json({ error: "too-short" }, 400, cors);

  // 2) Daily cap for the whole site, so usage stays inside the free allowance.
  const cap = parseInt(env.DAILY_AI_CAP || "150", 10);
  const today = day();
  const row = await env.DB.prepare(
    "INSERT INTO ai_usage (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1 RETURNING count"
  ).bind(today).first();
  if (row && row.count > cap) return json({ error: "daily-limit" }, 429, cors);

  const focus = hub === "vocab"
    ? `the target words and collocations: ${target}`
    : `the target grammar: ${target}`;
  const system = `You are a kind, precise English teacher giving feedback to a ${level} (CEFR) learner of academic English.
The learner did this task: "${task}".
Judge ONLY ${focus}. Also mention at most one other serious error that blocks meaning.
Rules:
- Use Australian/British spelling. Use simple words suitable for a ${level} learner.
- Do NOT rewrite the whole text. Point to the problem and give a hint so the learner can fix it themselves.
- Quote the learner's exact words in "quote" (max 8 words).
- If the target is used correctly, say so and praise one specific thing.
- If the text is not an attempt at the task, or is not English, set verdict to "off_task".
Return JSON only, with this shape:
{"verdict":"great"|"almost"|"not_yet"|"off_task","summary":"one sentence","points":[{"quote":"...","hint":"..."}],"tip":"one short next step"}
Give at most 3 points.`;

  const model = env.AI_MODEL || DEFAULT_MODEL;
  const out = await env.AI.run(model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Learner's writing:\n"""${studentText}"""` }
    ],
    max_tokens: 450,
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        properties: {
          verdict: { type: "string", enum: ["great", "almost", "not_yet", "off_task"] },
          summary: { type: "string" },
          points: { type: "array", items: { type: "object", properties: { quote: { type: "string" }, hint: { type: "string" } }, required: ["hint"] } },
          tip: { type: "string" }
        },
        required: ["verdict", "summary", "points"]
      }
    }
  });

  const parsed = parseModel(out);
  if (!parsed) return json({ error: "ai-format" }, 502, cors);
  return json(parsed, 200, cors);
}

function parseModel(out) {
  let r = out && out.response !== undefined ? out.response : out;
  if (typeof r === "string") {
    const m = r.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { r = JSON.parse(m[0]); } catch (e) { return null; }
  }
  if (!r || typeof r !== "object") return null;
  const verdicts = ["great", "almost", "not_yet", "off_task"];
  const clip = (s, n) => String(s || "").slice(0, n);
  return {
    verdict: verdicts.includes(r.verdict) ? r.verdict : "almost",
    summary: clip(r.summary, 300),
    points: (Array.isArray(r.points) ? r.points : []).slice(0, 3).map(p => ({ quote: clip(p && p.quote, 80), hint: clip(p && p.hint, 300) })).filter(p => p.hint),
    tip: clip(r.tip, 200)
  };
}
