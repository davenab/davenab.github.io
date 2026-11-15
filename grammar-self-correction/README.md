# Grammar Self-Correction Trainer

A practice app for EAP students at about CEFR B2. The app shows where an error is and what type it is (with a correction code). The student does the fixing. Hints step up only when the student asks for one.

Live address (after the pull request is merged): https://davenab.com/grammar-self-correction/

Plain HTML, CSS and JavaScript. No framework, no build step, no server, no sign-in, no tracking. Progress is kept only in the student's browser (localStorage). The app still works if the browser blocks storage; progress just isn't saved.

## Files

| File | What it is | Edit it? |
|---|---|---|
| `index.html` | The page | Rarely |
| `style.css` | All styling. Colours and fonts are tokens at the top (`:root`) | Yes, to restyle |
| `app.js` | How the app works | Only if you are changing behaviour |
| `config.js` | Settings, including the Mode 2 on/off switch | Yes |
| `ai.js` | Mode 2 connector (`requestFeedback`) and the preview's sample data | When you connect an AI service |
| `data/codes.json` | The correction codes: name, meaning, examples, rule | Yes |
| `data/links.json` | Study links for each code | Yes |
| `texts/index.json` | The list of practice text files | Yes, when you add a text |
| `texts/p01.json` … `p22.json` | One practice paragraph per file (p01–p18 B2, p19–p22 C1) | Yes |
| `data/warmup.json` | Sentences for the two-minute warm-up (one error each) | Yes |
| `vendor/jspdf.umd.min.js` | jsPDF 4.2.1 (MIT licence, see `vendor/jspdf-LICENSE.txt`), used only to make the teacher pack PDF on the device | No |

Pages inside the app: start page `#/`, practice `#/setup`, two-minute warm-up `#/warmup`, profile `#/profile`, code key `#/codes`, about `#/about`.

## Features

- **Practice texts:** 22 paragraphs (18 B2, 4 C1). Students choose a focus (one or two codes, or mixed), a level (B2, C1 or any) and how much help they want:
  - **Guide me:** the errors are marked from the start.
  - **Show me the sentence:** the sentences with errors are marked, with the number of errors. The student taps the wrong words, then sees what they found and missed.
  - **Let me hunt:** nothing is marked. The student taps the words they think are wrong.
- **Two-minute warm-up:** 5 single sentences, one error each, on the student's weakest code (or a code they choose, or mixed). The error and its code are shown. Hints: the rule, then the answer. When time is up, the student finishes the sentence they are on, then sees a summary. Results count in the profile; help is counted from the code, because the code is already shown.
- **Error profile:** the codes that needed most help, the top three to work on, saved rules and study links, plus **progress over time**: a chart of average help per error for the last 12 sessions (with a table view), and "earlier → recent" for each code with 4 or more errors.
- **Teacher pack (PDF):** the student types their name and downloads a one-to-two page PDF: overview, top areas, help by code with trends, recent sessions and their rules. It is made on the device; nothing is uploaded. The PDF font covers English and Western European letters only, so other characters (e.g. Chinese in a saved rule) show as "?". Teacher-only pages that students don't see linked: `#/teacher` (checks the texts) and `?preview=1#/mine` (Mode 2 demo).

## How to verify each practice text (and set "verified": true)

All 22 texts start as `"verified": false`, which shows a small **Draft content** label to students.

1. Open https://davenab.com/grammar-self-correction/#/teacher (or the same address on your preview).
2. For each text, the page shows: the paragraph with each error numbered and coded, the corrected paragraph, and a table of accepted answers, rule reminders and explanations. A red **Problems** line appears if a position, code or word count is wrong.
3. Check that:
   - the **corrected** paragraph is fully correct (read it twice);
   - each planted error is a real error, at one place, with one clear problem;
   - the code matches your college's meaning of that code;
   - the accepted answers include every correct fix a student might type (add more if needed);
   - the rule reminder and explanation are right and easy to read.
4. At the end of the page, check the warm-up sentences in the same way (each has one error and its accepted answers). Warm-up sentences have no verified flag.
5. To mark a text as checked: on GitHub, open `grammar-self-correction/texts/p01.json`, click the pencil icon (Edit), change `"verified": false` to `"verified": true`, and click **Commit changes**. The Draft content label disappears for that text.

## How to add a practice text

You don't need to be a programmer. You only edit text files on GitHub.

1. On GitHub, open the folder `grammar-self-correction/texts/`.
2. Open an existing file (for example `p01.json`), click the **copy** icon to copy everything, then go back to the folder.
3. Click **Add file → Create new file**. Name it `p13.json` (the next number). Paste.
4. Change the parts inside the quotation marks:
   - `"id"`: the same as the file name without `.json`, e.g. `"p13"`.
   - `"title"`, `"topic"`: what students see.
   - `"level"`: `"B2"` or `"C1"` (students filter by this).
   - `"verified"`: leave it as `false` until you have checked it.
   - `"text"`: the paragraph **with** the errors in it, on one line.
5. For each error, there is one block inside `"errors"`:
   ```json
   {
     "wrong": "has became",
     "code": "VF",
     "acceptedAnswers": ["has become"],
     "ruleReminder": "After has or have, use the past participle.",
     "explanation": "Become is irregular: become, became, become."
   }
   ```
   - `"wrong"` must be copied **exactly** from the paragraph (same spelling, capitals and punctuation).
   - `"start"` and `"end"` (the character positions) are optional. **You can leave them out.** The app finds the wrong words by itself, in order. If the same words appear twice in the paragraph, list the errors in the order they appear.
   - `"acceptedAnswers"`: the correct replacement for the **whole** `"wrong"` part. You can list several, separated by commas: `["a recording", "the recording"]`. Capital letters and extra spaces are ignored when checking.
   - `"code"` must be one of the codes in `data/codes.json` (for example `VT`, `Art`, `^`).
   - Separate the blocks with a comma. Don't put a comma after the last one.
6. Click **Commit changes**.
7. Open `texts/index.json`, click Edit, and add your file name to the list: `"p12.json", "p13.json"`. Commit.
8. Open `#/teacher` to check it. If the JSON has a mistake (a missing comma or quotation mark), the page tells you that the file could not be read.

Tips for good errors: 6 to 8 errors per paragraph, 80 to 120 words, one clear problem per error, no two errors in the same word, no errors that depend on style or opinion. For a missing word (`^`) or a missing article, mark the word next to the gap (e.g. wrong `"been"`, answer `"have been"`). For an unnecessary word (`X`), mark it together with its neighbour (e.g. wrong `"discuss about"`, answer `"discuss"`).

## How to add warm-up sentences

Open `data/warmup.json` and copy one block:
```json
{ "id": "w79", "code": "VT", "text": "Last week I go to the library.", "wrong": "go", "acceptedAnswers": ["went"], "explanation": "Last week is finished time, so use the past simple." }
```
`"wrong"` must appear exactly once in `"text"`. Keep at least 5 sentences for each code so a warm-up on one code has enough sentences.

## How to change the correction codes

Edit `data/codes.json` on GitHub. Each code has: `code`, `name`, `meaning` (one plain line), `wrong` and `right` (an example pair), and `rule` (a short reminder). Set `"fullHintEarly": true` for codes that aren't rule-based (WC and SS now). For those codes, hint 2 shows the code and the rule together.
If you rename a code (e.g. `Art` → `A`), also change it in the practice texts and in `data/links.json`.

## Study links

Links live in `data/links.json`. Each code can have one or two links:
```json
"VT": [ { "title": "Verb tenses (Purdue OWL)", "url": "https://..." } ]
```
They show on the Code key page and next to the student's weak codes on the profile page.

**No links are included yet.** The build environment couldn't reach any outside website, so no link could be checked. Following the brief, they were left out. Suggested pages to check and add (none of these has been checked):

| Code | Suggested page |
|---|---|
| VT | Purdue OWL, verb tenses: https://owl.purdue.edu/owl/general_writing/grammar/verb_tenses/index.html |
| VF | Purdue OWL, gerunds, participles and infinitives: https://owl.purdue.edu/owl/general_writing/grammar/gerunds_participles_and_infinitives/index.html |
| SVA | Purdue OWL, subject-verb agreement: https://owl.purdue.edu/owl/general_writing/grammar/subject_verb_agreement.html |
| Art | Purdue OWL, using articles: https://owl.purdue.edu/owl/general_writing/grammar/using_articles.html |
| Pl | Purdue OWL, count and noncount nouns: https://owl.purdue.edu/owl/general_writing/grammar/count_and_noncount_nouns/index.html |
| Prep | Purdue OWL, prepositions: https://owl.purdue.edu/owl/general_writing/grammar/prepositions/index.html |
| WF | British Council LearnEnglish, B1–B2 grammar and vocabulary pages (find the word formation page): https://learnenglish.britishcouncil.org/ |
| WC | UNC Writing Center, word choice: https://writingcenter.unc.edu/tips-and-tools/word-choice/ |
| WO | British Council LearnEnglish, word order / indirect questions pages: https://learnenglish.britishcouncil.org/ |
| P | Purdue OWL, commas: https://owl.purdue.edu/owl/general_writing/punctuation/commas/index.html |
| SS | Purdue OWL, sentence fragments and run-ons: https://owl.purdue.edu/owl/general_writing/mechanics/sentence_fragments.html |
| ^ | Same as SS or VF |
| X | Purdue OWL, conciseness: https://owl.purdue.edu/owl/general_writing/academic_writing/conciseness/index.html |

Your own college's academic skills pages (e.g. a university learning centre) are also a good choice.

## Mode 2: "My own writing" (built, switched off)

Students paste a paragraph (max 150 words). An AI service marks possible errors with codes, and the same graduated hints are used. The app never shows a rewritten paragraph. A suggestion for one error appears only after the student has tried to fix it.

- **Off by default.** `config.js` → `aiEnabled: false`. While it is off, students can't see or reach this mode.
- **Teacher preview:** add `?preview=1` to the address, e.g. `https://davenab.com/grammar-self-correction/?preview=1#/mine`. It uses sample data and shows a **"Demo only, not real feedback"** banner.
- **Built-in rules:** results are labelled "AI suggestions. They can be wrong or miss errors."; the app never says a text is error-free; each mark has an "I think this is correct" button; the pasted text is kept only in memory and is gone when the student leaves the page; the page shows "Check your course rules before using AI tools on assessed work." before pasting.

### Connecting a real AI service later

Never put an API key in this repository or in the page (the repository is public).

1. Set up a small **server-side proxy** (for example a Cloudflare Worker) that holds the API key, receives the student's text, asks the AI service for codes only, and returns the format below.
2. In `config.js` set `aiProxyUrl` to the proxy's address and `aiEnabled: true`.
3. The only function that talks to the service is `GSC_AI.requestFeedback(text, codes)` in `ai.js`.

The browser sends (POST, JSON):
```json
{ "text": "the student's paragraph", "codes": ["VT","VF","SVA","Art","Pl","Prep","WF","WC","WO","P","SS","^","X"] }
```
The proxy must return:
```json
{ "errors": [
  { "start": 15, "end": 21, "code": "SVA",
    "ruleReminder": "A plural subject takes a plural verb.",
    "suggestion": "think",
    "explanation": "Students is plural." }
] }
```
- `start`/`end`: character positions in the student's text (0 = first character; `end` is just after the error), so `text.slice(start, end)` is the wrong words.
- `code`: one of the allowed codes. `ruleReminder`: short (max 200 characters).
- `suggestion` and `explanation` are optional and apply to that one span only.
- **No full rewrite.** Any other fields (e.g. a corrected paragraph) are ignored. Overlapping spans, unknown codes and positions outside the text are dropped by `GSC_AI.validate`.

## Privacy and responsible AI

- Mode 1 makes no AI calls. Apart from the app's own files, it makes no network requests (no web fonts, no analytics). Nothing leaves the device.
- Stored in the browser only: session results (codes and the help level used), saved rules. Students can delete them with **Clear my data** on the profile page.
- The About page tells students that the practice texts were drafted with AI and checked by the teacher, why the app gives hints instead of corrections, and what is stored where.

## Testing done

Automated browser tests (Chromium, Playwright) at 360 px (phone) and 1280 px (desktop):
- Guide me (focus VT + Art, phone), Let me hunt (mixed, desktop) and Show me the sentence (both widths): full flow from setup → read → hunt → found/missed → fixing with every hint path (correct answer, hint then correct, two wrong tries then "Yes, mine works", two wrong tries then "No, mine was wrong", answer revealed) → summary → rule → profile → "Practise my weak areas".
- No horizontal scrolling on any page; buttons, links and error marks are at least 44 px tall.
- Correction boxes have autocorrect, autocapitalise and spellcheck turned off.
- Mode 2 is hidden and its address redirects while off; the preview shows the banner, warning, "I think this is correct" and the locked suggestion; the pasted text is not stored.
- B2/C1 filter (18 and 4 texts). Two-minute warm-up: timer, correct answer, time-up message, "not reached" count (clock fast-forwarded in the test). Progress chart. Teacher pack PDF downloads and opens; the student's name is remembered.
- Dark mode, and storage blocked, still work. No external network requests.
- The teacher page reports no position problems in any of the 12 texts.

Not tested: real iOS Safari or Android devices, screen readers (VoiceOver, TalkBack, NVDA), printing on paper, and a real AI proxy (none exists yet).
