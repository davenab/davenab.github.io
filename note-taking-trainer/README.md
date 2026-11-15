# DAVE Notes: Lecture Note-Taking Trainer

A free practice tool for EAP students (about CEFR B2). Students listen to a short lecture, take notes (typed or on paper), check their own notes against a teacher-checked list of key ideas, answer questions from their notes, review the script and set a goal.

Live address: https://davenab.github.io/note-taking-trainer/

- No sign-in, no AI while the app runs, no tracking.
- Notes and progress are saved only in the student's browser. Photos are saved only on the student's device. Nothing is uploaded.
- Works on phones, tablets and laptops. Nothing to install.

## What is in this folder

| File or folder | What it is |
|---|---|
| `index.html` | The app itself |
| `about.html` | The "About this app" page |
| `scripts.html` | A printable page of all lecture scripts (for recording) |
| `lectures/` | One file per lecture, plus `index.json` (the list of lectures) |
| `audio/` | Put lecture recordings (MP3) here |
| `app.js`, `app.css` | The program and its design. You do not need to change these. |

## How to add a lecture

You can do all of this on the GitHub website. You don't need to install anything.

1. Open the `note-taking-trainer/lectures/` folder on GitHub.
2. Open an existing lecture, for example `urbanisation.json`. Copy all of its text.
3. Go back to the `lectures` folder. Click **Add file → Create new file**.
4. Name the new file with lower-case words and hyphens, ending in `.json`. For example: `climate-and-health.json`.
5. Paste the text you copied. Then change the content (see the list below). Keep all the quote marks `"`, commas `,` and brackets `[ ] { }` exactly as they are in the example.
6. Click **Commit changes**.
7. Open `lectures/index.json` and click the pencil (edit) button. Add your file name to the list, in quote marks, with a comma after the line before it:

   ```
   "water-scarcity.json",
   "climate-and-health.json"
   ```

8. Click **Commit changes**. After a minute or two, the new lecture appears in the app.

### What each part of a lecture file means

| Part | What to write |
|---|---|
| `id` | A short name with no spaces. Use the same as the file name, without `.json`. |
| `title` | The lecture title students see. |
| `topic` | The subject area, for example "Psychology". |
| `level` | For example "B2". |
| `verified` | `false` until you have checked the lecture. Then change it to `true` (no quote marks). |
| `audioFile` | Leave as `""` if there is no recording. See the next section. |
| `keyTerms` | 3 to 5 words, each with a short definition. |
| `predictionQuestion` | One question to help students guess what they will hear. |
| `segments` | The lecture, in parts. Each part is one paragraph: `{ "text": "..." }`. 6 to 8 parts works well. |
| `keyIdeas` | 10 ideas students should have in their notes. `type` is `"main"` or `"detail"`. `segment` is the number of the part where the idea is (counting from 1). |
| `signpostPhrases` | Phrases to highlight in the script. Copy each one **exactly** as it is in the text, with the same capital letters and commas. |
| `modelNotes` | Example notes, one line each. Start a line with `- ` (hyphen and space) to make it a point under the line above. |
| `questions` | 5 questions. `options` are the choices. `answer` must be **exactly the same text** as the correct option. `explanation` is shown after the student answers. |

**Tip:** If a lecture does not appear, there is probably a small mistake in the file, such as a missing comma or quote mark. Paste the whole file into a free JSON checker (search for "JSON validator") to find the line with the problem. Apostrophes like `'` are fine. If you need a double quote mark inside the text, write it as `\"`.

## How to add my own recording to a lecture

Without a recording, the app uses the device's computer voice. A real recording sounds much more like a lecture.

1. Open `scripts.html` in the app (link at the bottom of the About page) and print the scripts.
2. Record yourself reading one lecture. Save it as an **MP3** file. Use the suggested file name, for example `urbanisation.mp3`.
3. While you listen back, write down the time in **seconds** when each numbered part starts. Part 1 starts at `0`. (For example, 1 minute 5 seconds = `65`.)
4. On GitHub, open the `note-taking-trainer/audio/` folder. Click **Add file → Upload files**. Drag in your MP3 and click **Commit changes**.
5. Open the lecture file in `lectures/` (for example `urbanisation.json`) and click the pencil (edit) button.
6. Change the `audioFile` line to your file name:

   ```
   "audioFile": "urbanisation.mp3",
   ```

7. Add the start time to each part, after the text, like this:

   ```
   { "text": "Good morning, everyone. Today I'm going to ...", "audioStart": 0 },
   { "text": "So, let's start with why people move. ...", "audioStart": 31 },
   ```

   The start times let students replay one part of the lecture during the review. If you skip them, the recording still plays, but replays of single parts use the computer voice.
8. Click **Commit changes**. After a minute or two, students hear your recording.

Keep MP3 files small so they load quickly on phones: mono, 64 kbps is plenty for speech (about 1.5 MB for a 3-minute lecture). Only upload recordings you are happy to share publicly: this repository is public.

## How to check a lecture and mark it as verified

All six starter lectures were drafted with AI and are marked `"verified": false`. Students see a small **Draft content** label on them until you change this.

For each lecture:

1. Open the lecture in the app and do a full session as a student, or read the file in `lectures/`.
2. Check the **script**: is it accurate, clear, B2 level and suitable for your students? Are there any claims you are not happy with?
3. Check the **key ideas**: are there 10? Is each one really in the script? Is each one correctly labelled main idea or supporting detail? Is the `segment` number right? (In the review step, tapping a missed idea should play the part that contains it.)
4. Check the **signposts**: in the review step, are the right phrases highlighted?
5. Check the **model notes** and **questions**: is the correct answer really correct, and are the wrong options clearly wrong? Do the explanations make sense?
6. When you are happy, edit the file on GitHub and change `"verified": false` to `"verified": true`. Click **Commit changes**. The Draft content label disappears.

## Privacy

- Progress (sessions, typed notes, goals) is saved in the browser's local storage.
- Photos of paper notes are made smaller, then saved in the browser's IndexedDB storage.
- A student's own audio file is played directly from their device and is never copied or uploaded.
- "Clear my data" on the My progress page deletes all of it.
- The only outside service is Google Fonts (for the fonts).
