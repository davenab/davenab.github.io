# DAVE Cite: APA 7th In-Text Citation Trainer

Short drills (10 questions, about 5 to 8 minutes) for EAP pathway students at about CEFR B2. Students build, fix and choose APA 7th in-text citations themselves, and see the rule in one line after every answer.

- **Track A: Citation formats.** Stages: 1 Spot the correct one, 2 Build it, 3 Fix it, 4 Choose the form.
- **Track B: Secondary citation.** Stages: 1 Who did I read?, 2 Build it, 3 Fix it, 4 Reference list check, 5 Do I need it?
- **Track C: Reporting verbs.** Stages: 1 Sort by strength, 2 Match the verb to the source, 3 Grammar patterns, 4 Tense and agreement, 5 Replace “says”.
- **Track D: Variety in citing.** Stages: 1 Name the pattern, 2 Same idea, new pattern, 3 Combine sources, 4 Vary the paragraph.
- **Mixed** takes questions from all four tracks, each at the student's current stage.

There are also a **Quick guide** (every rule on one page, with one example each), a **Reporting verb bank**, a **My progress** page and an **About** page.

It is a plain static page: no framework, no build step, no server, no AI calls, no sign-in, no analytics. Progress is kept in the student's browser (localStorage) and nothing leaves the device.

Live address (once merged into `main`): https://davenab.com/apa-citation-trainer/

## Files

| File | What it is |
|---|---|
| `index.html` | The page shell. |
| `style.css` | **All** the styling. Change colours and fonts in the `:root` block at the top (and the two dark-mode blocks under it). |
| `config.js` | **House rules** (see below). The only settings file. |
| `app.js` | How the app works. You should not need to edit this. |
| `data/track-a.json` … `data/track-d.json` | The practice items, grouped by track and stage. |
| `data/guide.json` | The Quick guide page. Each rule has an `id` that items use in their `topic` field. |
| `data/verbs.json` | The Reporting verb bank page. |
| `data/links.json` | Study links (one or two per track), shown on the progress page and in the Quick guide. |

## House rules (`config.js`)

Open `config.js`, change the word between the quotation marks, and commit. Use only the values listed.

**`reportingVerbTense`**: which tense students should use for reporting verbs (Lee (2020) *argues* / *argued*).
- `"either"` (the default): present simple **or** past / present perfect are both marked right.
- `"present"`: only the present simple is right (*argues*). If a student chooses *argued*, the app says the grammar is fine but it is not your course's tense.
- `"past"`: only the past or present perfect is right (*argued*, *has argued*). This is APA's own preference.

This setting changes the Track C “Tense and agreement” questions, the verb forms shown in sentences, model answers and the verb bank. With `"either"`, sentences and models show the past form, and the verb bank shows both.

**`pageNumbersForParaphrase`**: whether a paraphrase (not a quotation) needs a page number.
- `"optional"` (the APA default): a paraphrase citation with or without a page number is right.
- `"required"`: when the source card has a page, the student must include it, e.g. (Larsen, 2017, p. 31). If they leave it out, the app says your course asks for a page number.

Direct quotations always need a page (or paragraph) number, whatever the setting.

## How to add or edit an item

You can do all of this on the GitHub website. You do not need to install anything.

1. Open the file for the track, for example `data/track-a.json`.
2. Click the pencil icon (**Edit this file**).
3. Find the stage you want. Each stage looks like this: `"stage": 2, "title": "Build it", "items": [ ... ]`.
4. **To edit an item**, change the text between the quotation marks. Keep the quotation marks, commas and brackets around the text as they are.
5. **To add an item**, copy a whole item **of the same type** from the same stage, from its opening `{` to its closing `}`. Paste it after another item and put a comma between the two items (`},` then `{`). Then:
   - give it a new `id` that no other item uses (for example `A2-14`);
   - change the text;
   - leave `"verified": false` until you have checked it.
6. Click **Commit changes**. The live site updates within a few minutes.
7. Open the app, go to **About**, and look at **Content check**. It says “All item files loaded with no problems”, or lists any item it skipped and why (for example, “this accepted answer cannot be built from the tiles”). Fix the item and commit again.
8. On the teacher page (**About → For teachers: check every item**), find your item and press **Try this item** to see it as a student would.

Small rules that prevent most mistakes:
- Text goes inside straight double quotes: `"like this"`. Inside the text, use curly quotation marks: “like this”.
- Every item, and every line inside an item, is followed by a comma, **except the last one** in its list.
- Extra spaces in students' typed answers are ignored, so you do not need to list them. Hyphens and dashes in page ranges (12-13, 12–13) are treated the same. Capital letters and punctuation are **not** ignored: they are what the app teaches.
- Reporting verbs in sentences can follow the tense setting: write `{argues|argued}` (present form first, then past). Use the singular or plural form that matches the author(s).

### What each field means

| Field | Meaning |
|---|---|
| `id` | A short unique name, e.g. `A2-05` (track, stage, number). |
| `track` | `"A"`, `"B"`, `"C"` or `"D"`. |
| `stage` | The stage number in that track. |
| `type` | The kind of question (see the next table). |
| `topic` | Which Quick guide rule this item practises, e.g. `"two-authors"`, `"et-al"`, `"secondary-format"`. Must be an `id` from `data/guide.json`. Used for “Rules to review” and “Rules that keep causing trouble”. |
| `sourceCards` | The invented source(s) shown on the card: `authors` (written `"Surname, I."`), `year`, `title`, `type`, and optionally `where` (page or paragraph), `idea`, `quote`, `did` (what the author did, for Track C) and `read` (`true` = “You read this”, `false` = “You did not read this”). Can be `[]`. |
| `prompt` | The question the student sees. |
| `frame` | The sentence the student works with. For a gap, write `___` (three underscores). For “Fix it”, the sentence with one mistake. Otherwise `null`. |
| `tiles` | Build items: every tile, including the extra wrong ones. Sort items: the verbs to sort. Otherwise `null`. |
| `options` | Choice items: the options. Sort items: the groups. Otherwise `null`. |
| `acceptedAnswers` | The correct answer(s). See the next table for the format. |
| `modelAnswers` | Free rewrites: good example answers. Otherwise `[]`. |
| `rule` | The one-line rule shown after every answer. |
| `errorDiagnosis` | Optional special feedback for a typical wrong answer: `[{"answer": "(Kaur and Novak, 2020)", "problem": "Inside brackets, join two authors with &, not “and”."}]`. Usually `[]`: the app already names most format errors by itself. |
| `hint` | The optional hint before answering. It should help, not give the answer. |
| `verified` | `false` until you have checked the item; then `true`. Unverified items show a small “Draft content” label. |

Extra fields used by some types:

| Field | Used by | Meaning |
|---|---|---|
| `wrongCitation` | fix | The wrong citation, copied exactly from `frame`. It appears in the answer box for the student to correct. |
| `errorTokens` | fix | The word(s) the student can tap to find the mistake, copied exactly from `frame` **with their punctuation**, e.g. `"(Hosseini"` or `"2018)."`. |
| `tense` | choice (Track C4) | Which options are present and which are past, e.g. `{"argues": "present", "argued": "past", "has argued": "past"}`. Used with the `reportingVerbTense` setting. |
| `pageRule` | build | `"paraphrase"` means the item follows the `pageNumbersForParaphrase` setting. List both versions (with and without the page) in `acceptedAnswers`. |
| `selfCheck` | rewrite | The self-check list. If left out, the standard three questions are used. |
| `longAnswer` | rewrite | `true` for paragraph rewrites: the paragraph is put in the box for the student to edit. |
| `keepOrder` | choice | `true` keeps the options in the written order (otherwise they are shuffled). |
| `groupAuthor` | any | A note for you only. The app ignores it. |

### Question types

| `type` | What the student does | `acceptedAnswers` format |
|---|---|---|
| `choice` | Taps one option. | The correct option(s), copied exactly from `options`: `["(Okafor, 2021)"]`. |
| `build` | Taps tiles in order to build a citation, or taps “Type it instead”. If there is a `frame` with `___`, the citation fills the gap. | The full citation(s): `["(Kaur & Novak, 2020)"]`. Each one must be possible to build from `tiles`. The app puts spaces between tiles automatically, except after `(` `[` and before `)` `]` `,` `;`. |
| `fix` | Taps the part of `frame` with the mistake, then corrects the citation. | The corrected citation(s): `["(Hosseini, 2018)"]`. |
| `sort` | Puts each verb in a group. | One group for each verb: `{"suggest": "Tentative", "argue": "Strong"}`. |
| `rewrite` | Writes a sentence or paragraph, then compares it with `modelAnswers` and a self-check list, and taps “Mine works” or “Mine needs work”. | `[]` (free rewrites are never marked automatically). |

## How to check items and mark them as verified

1. Open the app, go to **About → For teachers: check every item** (or open `#/teacher` at the end of the address). Every item is listed with its options, accepted answers, rule and hint. Tick **Only items not yet checked** to see what is left.
2. For each item, check:
   - Is there one clearly best answer (or are all the correct answers listed)?
   - Does it follow APA 7th and your course's referencing guide?
   - Is the rule correct and one line? Does the hint help without giving the answer away?
   - Are the names, titles and ideas clearly invented (no real researchers, studies or statistics)?
   - Press **Try this item** and answer it once correctly and once wrongly. Is the feedback right?
3. When an item is right, open its file in `data/`, change `"verified": false` to `"verified": true`, and commit. The “Draft content” label disappears for that item.
4. The **About** page shows how many items are still drafts.

Tip: in the GitHub editor, press Ctrl+F (Cmd+F on a Mac) and search for the item `id` to find it quickly.

## Study links

Edit `data/links.json`. Add one or two links per track, like this:

```json
"B": [
  { "title": "Secondary sources (APA Style website)", "url": "https://apastyle.apa.org/style-grammar-guidelines/citations/secondary-sources" }
]
```

Open each link in your browser first to check that it works. None of the candidate links could be checked when the app was built (the sites were blocked from the build environment), so all lists are empty for now. The candidates are listed under `_notCheckedYet` in the file.

## How the app decides what to show

- **Session:** up to 6 questions that are due for review, then new questions at the student's current stage (taken in turn from each track in Mixed mode), then earlier unseen questions, then the weakest questions already seen. 10 questions in total.
- **Review boxes:** every question starts in box 1. A right answer moves it up one box; a wrong answer (or “Mine needs work”) sends it back to box 1. Box 1 comes back next session, box 2 after 2 sessions, box 3 after 4, box 4 after 8, box 5 after 16. Box 4 or 5 counts as “mastered”.
- **Unlocking:** the next stage opens when the student gets at least 80% right over their last two sessions at their highest stage (a session counts for a stage if it had at least 3 questions from that stage, so mostly single-track sessions count). Students can go back to any open stage at any time.
- **Hints** are recorded and shown on the results screen and the progress page.

These numbers are at the top of `app.js` if you want to change them.

## Privacy

Stored in localStorage on the student's device only: stage in each track, the review schedule, recent scores, hint use and goals. “Clear my data” (on the progress page and the About page) deletes it all. There are no network calls except loading the app's own files and the website's fonts. If the browser blocks storage, the app still works but does not save.
