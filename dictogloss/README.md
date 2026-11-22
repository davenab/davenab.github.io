# Dictogloss Trainer

Listening-and-writing practice for EAP students (about CEFR B2). A student hears a short academic passage twice, notes key words, rebuilds the passage in full sentences, gets hints on meaning and grammar, revises once, compares with the original, and sets a goal.

Live address: https://davenab.com/dictogloss/

- No sign-in, no tracking, no analytics. Progress stays in the student's browser.
- Feedback gives hints, not answers. The student can ask for AI feedback twice per session: once before revising, once after.

## What is in this folder

| File or folder | What it is |
|---|---|
| `index.html` | The app |
| `app.js` | The program. You don't need to change it. |
| `style.css` | All the colours, fonts and layout. Change the values at the top (`:root`) to restyle the app. |
| `data/index.json` | The list of passages on the start screen |
| `data/passages/*.json` | One file per passage |
| `audio/` | Your recordings (MP3), if you add any |
| `scripts.html` | All the scripts on one printable page, for checking and recording |

## How to check a passage and mark it as verified

1. Open `scripts.html` in the app (link at the bottom of the app page) and read the script and its key ideas.
2. On GitHub, open `dictogloss/data/passages/` and click the passage file (for example `street-trees.json`).
3. Click the pencil icon (Edit). Fix anything you want to change.
4. Change `"verified": false` to `"verified": true`.
5. Open `dictogloss/data/index.json`, find the same passage, and change its `"verified": false` to `"verified": true` too.
6. Click **Commit changes**. The "Draft content" label disappears for that passage a few minutes later.

## How to add a passage

You can do all of this on the GitHub website.

1. Open `dictogloss/data/passages/` on GitHub and open any passage. Copy all of its text.
2. Go back to the `passages` folder and click **Add file → Create new file**.
3. Name the file with a short id, using lowercase letters and hyphens, for example `city-gardens.json`.
4. Paste the text and change:
   - `id`: the same as the file name, without `.json`
   - `title`, `topic`, `level`
   - `keyTerms`: 3 or 4 words with short definitions
   - `targetGrammar`: `points` (names shown to students), `codes` (any of passive, relative, articles, ppps, comparatives, cause, contrast) and `listenFor` (one line telling students what to listen for)
   - `text`: the passage, 70–110 words, written to be spoken
   - `keyIdeas`: 5–7 ideas in plain words, each with `"type": "main"` or `"type": "detail"`
   - `verified`: keep `false` until you have checked it
   - `audioFile`: leave `""` unless you add a recording (see below)
5. Click **Commit changes**.
6. Open `dictogloss/data/index.json`, copy one entry in the list, paste it after the others (add a comma between entries), and change `id`, `title`, `topic`, `level`, `words` (the number of words in the text) and `targetGrammar`.
7. Commit. The passage appears on the start screen a few minutes later.

Rules: write passages yourself, and don't invent statistics, study names or citations.

## How to add my recording

1. Record yourself reading the script at a natural speed (`scripts.html` shows each script with the file name to use). Save it as an MP3, for example `street-trees.mp3`.
2. On GitHub, open `dictogloss/audio/`, click **Add file → Upload files**, upload the MP3, and commit.
3. Open the passage file (for example `data/passages/street-trees.json`), click Edit, and set `"audioFile": "street-trees.mp3"`. Commit.

The app then plays your recording instead of the computer voice. The "easier" speed plays it at 0.85×.

## How live feedback is connected

- The app uses the shared helper `/assets/ai.js`, which sends the request to Dave's Cloudflare Worker at `https://api.davenab.com/dictogloss` (code: `_tools/cloudflare/worker.js`, setup notes: `_tools/cloudflare/SETUP.md`).
- What is sent: the original passage, its key ideas, the target grammar, the list of correction codes, and the student's text. Nothing else: no names or identifiers.
- The Worker holds the AI connection (Cloudflare Workers AI, model Gemma 4). There is no API key in this repository or in the browser. The Worker does not store or log student text.
- The AI instructions are on the server (in `worker.js`): judge meaning against the key ideas, accept paraphrase, never rewrite the student's text, never quote the original beyond single key terms, flag only confident grammar errors (max 6), plain B1 English. The Worker also replaces any hint that repeats five or more words from the original.
- Limits: 250 words per text; 2 requests per session; 10 requests per hour per device (in the browser); 10 per minute per visitor and a daily cap for the whole site (on the server).
- If feedback fails or takes more than 20 seconds, the app switches to self-check: the student sees each key idea and taps "Got it", "Partly" or "Missed".
- Cost: Cloudflare's free plan includes 10,000 AI units ("neurons") a day. One dictogloss feedback request uses roughly 15–30 units, so a few hundred requests a day are free. On the free plan, Cloudflare stops when the allowance runs out; it never charges.
