# DAVE Notes: Lecture Note-Taking Trainer (TED edition)

Note-taking practice with real talks, for EAP students at about CEFR B2. Students watch a TED talk (in TED's official player), listen to a Breaking News English story (on their website), or use their own recording. Each session, students choose which note-taking skill to practise. They take notes, check their own notes against a teacher-checked list of key ideas, answer questions from their notes, review, and set a goal.

Live address: https://davenab.github.io/note-taking-trainer-ted/

- No sign-in, no AI while the app runs, no tracking.
- Notes and progress stay in the student's browser. Photos stay on the student's device. Nothing is uploaded.
- This replaces version 1 (computer-voice lectures). The old address `/note-taking-trainer/` now redirects here; version 1 is still in the Git history if you ever need it.

## What is in this folder

| File or folder | What it is |
|---|---|
| `index.html` | The app |
| `about.html` | The "About this app" page |
| `activities/` | One file per talk, plus `index.json` (the list) |
| `app.js`, `app.css` | The program and its design. You don't need to change these. |

## Rules for TED and Breaking News English content

**TED**
- Use TED's official embed only: `https://embed.ted.com/talks/` + the end of the talk's address. Never download, re-upload, cut or change TED audio or video.
- Never copy TED transcripts into the app. The review step links to the transcript on ted.com.
- Write key ideas, questions and model notes in your own words. Only quote a few words at a time.
- Don't use TED logos or TED-Ed videos. The app shows speaker, title, "TED" and a link to TED.com automatically.

**Breaking News English**
- Their terms allow linking to their lesson pages, but not to their MP3 files, and not copying their text or exercises into an app. So BNE activities only link to the page (`bneUrl`). Key ideas and questions must be in your own words.
- These terms are their decision, not ours. If you plan to use BNE a lot, consider emailing Sean Banville to confirm he is happy with this use.

## How to add a talk

You can do all of this on the GitHub website. You don't need to install anything.

1. Open `note-taking-trainer-ted/activities/` on GitHub.
2. Open an activity of the same kind and copy all of its text:
   - TED talk: `cutts-30-days.json`
   - Breaking News English: `bne-food-waste.json`
3. Go back to the `activities` folder and click **Add file → Create new file**.
4. Name the file with lower-case words and hyphens, ending in `.json`, for example `robinson-schools.json`.
5. Paste the text and change the content (see the table below). Keep all the quote marks `"`, commas `,` and brackets `[ ] { }` exactly as they are.
6. Click **Commit changes**.
7. Open `activities/index.json`, click the pencil (edit) button, and add your file name to the list, in quote marks, with a comma after the line before it.
8. Click **Commit changes**. After a minute or two, the new activity appears in the app.

### For a TED talk

1. Find the talk on ted.com. Check it is a TED talk (not TED-Ed) and about 3 to 6 minutes long.
2. Its address looks like `https://www.ted.com/talks/matt_cutts_try_something_new_for_30_days`. Put this in `tedUrl`.
3. For `embedUrl`, use the same ending after `https://embed.ted.com/talks/`. (You can check it on ted.com: **Share → Embed**.)
4. Open the transcript on ted.com (it has times). Use it to write the key ideas and their `approxTime`. Don't paste the transcript into the file.

### What each part means

| Part | What to write |
|---|---|
| `id` | A short name with no spaces. Use the file name without `.json`. |
| `source` | `"ted"` or `"bne"` |
| `title`, `speaker`, `topic` | Shown on the activity card |
| `tedUrl`, `embedUrl` | TED talks only (see above) |
| `bneUrl` | BNE only: the listening page (the address ending in `l.html`, e.g. `...-5l.html`) |
| `bneLessonUrl` | BNE only: the main lesson page, for the credit link |
| `audioFile` | Leave as `""` |
| `level` | For example `"B2"` |
| `lengthSeconds` | Length in seconds (3 minutes 10 seconds = `190`) |
| `verified` | `false` until you have checked it. Then `true` (no quote marks). This is your own record; students don't see it. |
| `keyTerms` | 3 to 5 words, each with a short definition |
| `predictionQuestion` | One question to help students guess what they will hear |
| `keyIdeas` | 6 to 10 ideas. `type` is `"main"` or `"detail"`. `approxTime` is where the idea is, like `"1:40"`. |
| `modelNotes` | Example notes, one line each. Start a line with `- ` (hyphen and space) to put it under the line above. |
| `questions` | 5 questions. `answer` must be **exactly the same text** as the correct option. |

**Tip:** If an activity doesn't appear, there is probably a small mistake in the file, like a missing comma or quote mark. Paste the file into a free JSON checker (search "JSON validator") to find the line. To put a double quote mark inside text, write `\"`.

## Skill focus

On the home screen students choose one of four skills: signposting language, abbreviations and symbols, main idea versus detail, or organising notes. The app marks one as "Suggested next" (it rotates through the four), but students can pick any of them. They can also change it on the skill-tip screen.

## How to check an activity and mark it as verified

All activities start as `"verified": false`. Students no longer see a label for this: `verified` is now just your own record of what you have checked.

For each activity:

1. Watch or listen to the talk yourself, with the transcript open (TED: the Transcript tab on ted.com; BNE: the text under the players).
2. **Key ideas:** is each one really in the talk, in fair words? Is it correctly labelled main idea or supporting detail? Is the `approxTime` close (within about 10 seconds)? BNE times are estimates from the text, so check them against the Medium-speed audio.
3. **Questions:** is the right answer really right, and are the wrong options clearly wrong? Do the explanations match what the speaker said?
4. **Key terms and model notes:** are they accurate and useful at B2 level?
5. **Suitability:** is the talk suitable for your students? (For example, "8 secrets of success" contains one rude word in a joke near the end.)
6. Edit the file on GitHub: change `"verified": false` to `"verified": true` and click **Commit changes**.
