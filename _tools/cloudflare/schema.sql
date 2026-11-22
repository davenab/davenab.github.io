-- D1 schema for davenab-api. Run once (dashboard: D1 > davenab-db > Console, or
--   npx wrangler d1 execute davenab-db --remote --file=_tools/cloudflare/schema.sql).
-- Nothing here can identify a person: no IP, no ID, no names, no free text, month only.

CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  month  TEXT NOT NULL,              -- e.g. 2026-11 (set by the server)
  hub    TEXT NOT NULL,              -- grammar | vocab
  unit   TEXT NOT NULL,              -- e.g. present-perfect
  level  TEXT NOT NULL,              -- A2 | B1 | B2 | C1
  kind   TEXT NOT NULL,              -- pre (finished the first test) | post (finished the second test)
  pre    INTEGER NOT NULL,           -- first test score, 0-100
  post   INTEGER                     -- second test score, 0-100 (only for kind = post)
);
CREATE INDEX IF NOT EXISTS events_unit ON events (hub, unit, kind);

CREATE TABLE IF NOT EXISTS ai_usage (
  day   TEXT PRIMARY KEY,            -- e.g. 2026-11-22
  count INTEGER NOT NULL DEFAULT 0   -- AI feedback requests that day (whole site)
);
