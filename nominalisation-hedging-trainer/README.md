# Nominalisation and Hedging Trainer

Short drills (10 questions, 5 to 8 minutes) for EAP students at about CEFR B2.

- **Track A: Nominalisation.** Stages: 1 Word families, 2 Spot it, 3 Guided rewrite, 4 Free rewrite, 5 Too much.
- **Track B: Hedging.** Stages: 1 Spot it, 2 How strong?, 3 Match the evidence, 4 Free rewrite, 5 Too much.
- **Mixed** mode takes questions from both tracks.

It is a plain static page: no framework, no build step, no server, no AI, no sign-in, no analytics. Progress is kept in the student's browser (localStorage) and nothing leaves the device.

Live address (once merged): https://davenab.com/nominalisation-hedging-trainer/

## Files

| File | What it is |
|---|---|
| `index.html` | The page shell. |
| `style.css` | **All** the styling. Change colours and fonts in the `:root` block at the top (and the two dark-mode blocks under it). |
| `app.js` | How the app works. You should not need to edit this. |
| `data/nominalisation.json` | Track A practice items, grouped by stage. |
| `data/hedging.json` | Track B practice items, grouped by stage. |
| `data/reference.json` | The "Word families" and "Hedging bank" pages. |
| `data/links.json` | Study links shown on the "My progress" page. |

## How to add or edit an item

You can do all of this on the GitHub website. You do not need to install anything.

1. Open the file for the track: `data/nominalisation.json` (Track A) or `data/hedging.json` (Track B).
2. Click the pencil icon (**Edit this file**).
3. Find the stage you want. Each stage looks like this: `"stage": 2, "title": "Spot it", "items": [ ... ]`.
4. **To edit an item**, change the text between the quotation marks. Keep the quotation marks, commas and brackets as they are.
5. **To add an item**, copy a whole item from the same stage, from its opening `{` to its closing `}`. Paste it after another item and put a comma between the two items (`},` then `{`). Then:
   - give it a new `id` that no other item uses (for example `N2-11`);
   - change the text;
   - leave `"verified": false` until you have checked it.
6. Click **Commit changes**. The live site updates within a few minutes.
7. Open the app and go to **About**. At the bottom, **Content check** says "All … items loaded with no problems", or lists any item it skipped and why (for example, "the accepted answer must be copied exactly from the options"). Fix the item and commit again.

Small rules that prevent most mistakes:
- Text goes inside straight double quotes: `"like this"`. If you need quotation marks inside the text, use curly ones: “like this”.
- Every item, and every line inside an item, is followed by a comma, **except the last one** in its list.
- Capital letters and extra spaces in students' answers are ignored, so you do not need to list them.
- Write answers in Australian spelling (analyse, behaviour, emphasise). American spellings (analyze, behavior, emphasize) are accepted automatically and the app shows the Australian form.

### What each field means

| Field | Meaning |
|---|---|
| `id` | A short unique name, e.g. `N1-03` (Track A) or `H3-07` (Track B). |
| `track` | `"nominalisation"` or `"hedging"`. |
| `stage` | A number from 1 to 5. |
| `type` | The kind of question (see the table below). |
| `prompt` | The word, sentence or evidence the student sees. |
| `frame` | Gap-fill only: the sentence with gaps written as `___` (three underscores). Otherwise `null`. |
| `options` | Choice and ordering questions: the list of options. Otherwise `null`. |
| `acceptedAnswers` | The correct answer(s). See the table below for the format. |
| `modelAnswers` | Gap-fill and free rewrites: good example sentences. Otherwise `[]`. |
| `reason` | The one-line "Why" shown after every answer. |
| `hint` | The optional hint the student can ask for before answering. |
| `pattern` | A short name for the pattern, e.g. `"-tion / -sion nouns"` or `"Stacked hedges"`. Used for "Patterns to review". Items with the same pattern are grouped. |
| `question` | (optional) Replaces the standard question for this item, e.g. "Put these in order. Start with the most often…". |
| `evidence` | (optional) A short description of the evidence, shown in a blue box (Track B rewrites and "Too much" items). |
| `optionLabels` | Match-the-evidence only: "Too strong", "About right", "Too weak", in the same order as `options`. |
| `verified` | `false` until you have checked the item; then `true`. Students never see this label. |

### Question types

| `type` | What the student does | `acceptedAnswers` format |
|---|---|---|
| `word` | Types one word. | A list of accepted words: `["growth"]` |
| `spot` | Taps words in the sentence (`prompt`). | The words to tap, exactly as they appear in the sentence: `["Some", "appear"]`. Each word should appear only once in the sentence. |
| `choose` | Taps one option. | The correct option, copied exactly from `options`: `["The manager explained why the system failed."]`. Options are shuffled on screen. |
| `evidence` | Reads the evidence (`prompt`) and taps the claim that fits. | The "About right" option, copied exactly. Also fill `optionLabels`. |
| `order` | Taps the options in order. | All the options in the correct order (strongest first). |
| `gapfill` | Fills the gaps in `frame`. | One list per gap: `[["increase", "rise"], ["prices", "costs"]]`. If a student writes something else, the app says "This is not one of the answers I expected", shows the model, and lets the student judge. |
| `rewrite` | Writes a whole sentence, then compares it with `modelAnswers` and a self-check list. | `[]` (free rewrites are never marked automatically). |

The self-check lists for free rewrites are in `app.js` (search for `SELF_CHECK`).

## How to check items and mark them as verified

1. Open the app, choose a stage on the home page ("Choose a different stage"), and work through the items. Or read them in the JSON file.
2. For each item, check: Is there one clearly best answer (or are all the accepted answers listed)? Is the reason correct and one line? Is the hint helpful? Would another teacher agree?
3. When an item is right, change `"verified": false` to `"verified": true` and commit. Nothing changes for students; it is a record for you.

## Study links

Edit `data/links.json`. Add up to two links per track, like this:

```json
"hedging": [
  { "title": "Being cautious (Academic Phrasebank, University of Manchester)", "url": "https://www.phrasebank.manchester.ac.uk/being-cautious/" }
]
```

Open each link in your browser first to check that it works. The two candidate links could not be checked when the app was built, so both lists are empty for now. They are listed under `_notCheckedYet` in the file.

## How the app decides what to show

- **Session:** up to 6 items due for review, then new items at the student's current stage (taken in turn from each track in Mixed mode), then the weakest items they have already seen. 10 items in total.
- **Review boxes:** every item starts in box 1. A right answer moves it up one box; a wrong answer (or "Mine needs work") sends it back to box 1. Box 1 comes back next session, box 2 after 2 sessions, box 3 after 4, box 4 after 8, box 5 after 16. Box 4 or 5 counts as "mastered".
- **Stages:** nothing is locked; students can choose any stage at any time. When they get at least 80% right over their last two sessions at their furthest stage (a session counts if it had at least 3 items from that stage), the app suggests the next stage.
- **Hints** are recorded and shown on the session results and the progress page.

These numbers are at the top of `app.js` if you want to change them.

## Privacy

Stored in localStorage on the student's device only: stage in each track, the review schedule, recent scores, hint use and goals. "Clear my data" on the progress page deletes it all. There are no network calls except loading the app's own files.
