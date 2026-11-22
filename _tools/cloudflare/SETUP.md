# Cloudflare setup for davenab.com (anonymous impact data + AI feedback)

What you get:
- **Cloudflare Web Analytics**: page views for the whole site, with no cookies and no personal data.
- **davenab-api Worker + D1 database**: stores anonymous before/after scores from the Grammar Hub and Vocabulary Hub (only from students who say yes), and runs **AI feedback** on the "Use it" step with Workers AI.

Nothing here costs money on the free plan. The Worker has a **daily cap** on AI requests (150 a day by default, `DAILY_AI_CAP`) and a per-visitor limit (10 a minute), so it can't run up a bill. If you ever upgrade to Workers Paid, check your Workers AI usage in the dashboard.

Files: `worker.js` (the code), `schema.sql` (database tables), `wrangler.toml` (settings).

---

## Part 1: Web Analytics (2 minutes, dashboard only)

1. Log in at dash.cloudflare.com.
2. Left menu: **Analytics & Logs → Web Analytics → Add a site**.
3. Hostname: `davenab.com`. Click **Done**.
4. Cloudflare shows a JavaScript snippet with a **token**, e.g.
   `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "abc123..."}'></script>`
5. Send Claude the token (it isn't secret: it appears in every page's source anyway). Claude adds it to every page through `_tools/build.py` and the apps.
   - If your DNS record for davenab.com is **proxied** (orange cloud), Cloudflare can add it automatically instead ("Enable automatic setup"). GitHub Pages sites are usually **DNS only** (grey cloud), so the snippet is the reliable option.

---

## Part 2: The Worker and database. Choose ONE option

**Status (22 Nov 2026): DONE.** Deployed by Claude through the Cloudflare API connector. Worker `davenab-api` runs at **https://api.davenab.com** (custom domain; the workers.dev address is switched off), with bindings DB → `davenab-db` (id `5564a46b-fdb7-48f2-b091-b24405761de3`, Oceania), AI, FEEDBACK_LIMITER (10/min), and variables ALLOWED_ORIGINS, AI_MODEL (`@cf/google/gemma-4-26b-a4b-it`), CAP_FEEDBACK 250, CAP_COACH 200, CAP_GSC 120, CAP_REWRITE 150, CAP_NOTES 80, CAP_DICTO 120 (daily request caps per route). Routes: /e, /stats, /feedback (hubs), /coach (Feedback Coach), /gsc (Grammar Self-Correction), /rewrite (Nominalisation & Hedging, APA Trainer), /notes (Notetaking Trainer), /dictogloss. Logs are off. Web Analytics: site `davenab.com` (token `618c9d602257483795361f11fc6b1a08`) — the site is DNS-only, so the beacon script is added to every page by `_tools/build.py` (`CF_BEACON`) and to every app by `assets/appbar.js`. The options below are only needed to rebuild it from scratch.

### Option A (easiest for you): let Claude deploy it
1. dash.cloudflare.com → top-right profile icon → **My Profile → API Tokens → Create Token → Create Custom Token**.
2. Name: `Claude deploy davenab-api`. Permissions:
   - Account · **Workers Scripts** · Edit
   - Account · **D1** · Edit
   - Account · **Workers AI** · Read
   - Account · **Account Settings** · Read
   - User · **User Details** · Read
   - User · **Memberships** · Read
   Account resources: your account only. TTL: you can set it to expire in a week.
3. **Create Token** and copy it.
4. In the Claude session, use the secure **credential form** for `api.cloudflare.com` and paste the token there, never in the chat. Claude never sees the value: the session's proxy adds it to requests.
5. Claude runs the deploy, creates the database and tables, tests it, and puts the Worker's address in `assets/hub/config.js`. You can delete the token afterwards.

### Option B: do it yourself in the dashboard (about 10 minutes, no command line)
1. **Create the database**: left menu **Storage & Databases → D1 SQL Database → Create database**. Name: `davenab-db`. Create.
2. Open `davenab-db` → **Console** tab → paste everything in `schema.sql` → **Execute**.
3. **Create the Worker**: **Compute (Workers) → Workers & Pages → Create → Start with Hello World** (or "Create Worker"). Name: `davenab-api` → **Deploy**.
4. Click **Edit code**, delete everything, paste all of `worker.js` → **Deploy**.
5. On the Worker page → **Settings → Bindings → Add**:
   - **D1 database**: variable name `DB`, database `davenab-db`.
   - **Workers AI**: variable name `AI`.
   - (Optional) **Rate limiting**: name `FEEDBACK_LIMITER`, limit 10, period 60 seconds. If the dashboard doesn't offer it, skip it: the daily cap still protects you.
6. **Settings → Variables and Secrets → Add** (type: Text):
   - `ALLOWED_ORIGINS` = `https://davenab.com,https://www.davenab.com,https://davenab.github.io`
   - `AI_MODEL` = `@cf/google/gemma-4-26b-a4b-it`
   - `CAP_FEEDBACK` = `300`, `CAP_COACH` = `250`, `CAP_GSC` = `150`
7. **Settings → Observability**: make sure Workers Logs are **off** (so no request details are kept).
8. Copy the Worker's address (e.g. `https://davenab-api.yourname.workers.dev`) and send it to Claude. Open it in a browser: it should say "davenab-api is running."

### Option C: ask Cloudflare's AI assistant
The dashboard's AI assistant (Cloudy) can guide you click by click, but it can't create everything for you. Paste these prompts one at a time:

> 1. "Walk me through creating a D1 database called davenab-db and running this SQL in its console:" *(then paste schema.sql)*
>
> 2. "Walk me through creating a Worker called davenab-api from Hello World, replacing the code with code I paste, and deploying it."
>
> 3. "On my Worker davenab-api, how do I add these bindings: a D1 binding named DB to the database davenab-db, a Workers AI binding named AI, and a rate limiting binding named FEEDBACK_LIMITER with limit 10 per 60 seconds?"
>
> 4. "On my Worker davenab-api, how do I add plain-text environment variables ALLOWED_ORIGINS, DAILY_AI_CAP and AI_MODEL, and turn off Workers Logs?"

Then send Claude the Worker's address (step 8 above).

### Option D: command line (if you ever use a terminal)
```bash
npx wrangler login
```
```bash
npx wrangler d1 create davenab-db
```
Put the `database_id` it prints into `_tools/cloudflare/wrangler.toml`, then:
```bash
npx wrangler d1 execute davenab-db --remote --file=_tools/cloudflare/schema.sql
```
```bash
npx wrangler deploy --config _tools/cloudflare/wrangler.toml
```

---

## Part 3: Switch it on in the hubs
In `assets/hub/config.js` set `apiBase` to the Worker's address. Then:
- students see a one-time "Help improve this hub? Share anonymously" card (nothing is sent unless they say yes);
- the "Use it" step shows **Get AI feedback**.
Leave `apiBase` empty to turn both off.

---

## Part 4: Reading your impact data
- Quick summary (anyone can open it; groups under 5 are hidden):
  `https://api.davenab.com/stats` (or `/stats?hub=grammar`)
- Full queries: D1 → `davenab-db` → **Console**:

```sql
-- Before/after per unit
SELECT hub, unit, level, COUNT(*) AS n, ROUND(AVG(pre),1) AS before, ROUND(AVG(post),1) AS after,
       ROUND(AVG(post - pre),1) AS gain, ROUND(100.0*SUM(post > pre)/COUNT(*),1) AS pct_improved
FROM events WHERE kind = 'post' GROUP BY hub, unit, level ORDER BY hub, level;

-- Completion: how many who did the first test also finished the second
SELECT hub, unit, SUM(kind='pre') AS started, SUM(kind='post') AS finished,
       ROUND(100.0*SUM(kind='post')/NULLIF(SUM(kind='pre'),0),1) AS completion_pct
FROM events GROUP BY hub, unit ORDER BY completion_pct;

-- Activity by month
SELECT month, hub, COUNT(*) AS results FROM events WHERE kind = 'post' GROUP BY month, hub ORDER BY month;

-- AI use per day and route (rows look like 2026-11-22|coach)
SELECT * FROM ai_usage ORDER BY day DESC LIMIT 30;
```

Note for research use: pre/post scores from a self-selected online group are useful evidence of impact, but not a controlled study. If you plan to publish, ask your ethics office first; non-identifiable data often qualifies for a low-risk or exempt route.

## Privacy summary (for the hub About pages and any ethics application)
- Stored: month, hub, unit, CEFR level, first-test score, second-test score. Nothing else.
- Not stored: names, emails, IP addresses, device IDs, cookies, student writing.
- AI feedback: the student's text goes to Cloudflare Workers AI to generate feedback and is not stored or logged by the Worker.
- Sharing scores is opt-in, and can be switched off on each hub's About page.
