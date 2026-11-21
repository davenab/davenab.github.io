# APA Reference Guide

A free, searchable APA 7th referencing guide for students: https://davenab.com/apa-reference-guide/

Students search for their source type (or choose it from the "Most used" and "Also useful" lists), choose who wrote it (one author, two authors, three or more, an organisation, or no author) and, for web sources, whether there is a date. The page then shows:

- the **pattern** (with a "Copy pattern" button that keeps the italics where the browser allows),
- an **example** (all names and titles are invented),
- the **in-text citations** (in brackets and in the sentence; first time and after that for organisations),
- a **Capital letters** note (which parts use sentence case and which use title case),
- short **tips**.

There is also a **Reference list rules** page (order, hanging indent, capitals, italics) with a sample list.

It deliberately shows patterns and examples instead of filling in the student's own details, so students learn the format (it is not a citation generator).

Each source type has its own link that students can bookmark or share, e.g. `#/s/online-news/two` (online newspaper article, two authors) or `#/s/webpage/org/nd` (web page by an organisation, no date).

## Files

| File | What it is |
|---|---|
| `index.html` | The page shell. |
| `guide.css` | Extra styles for this page. Colours, fonts and buttons come from `../apa-citation-trainer/style.css`, so it always matches APA Trainer. |
| `guide.js` | How the page works. You should not need to edit it. |
| `data/sources.json` | **All the content**: source types, patterns, examples, tips and the reference list rules. |

## Where the patterns come from

UTS Library, *APA 7th referencing guide* (January 2025), plus the University of Sydney Library APA 7th guide for lecture slides. Each source type names its section in the `ref` field, and the page shows it. The Copilot example under Generative AI is the one in the UTS guide.

## How to add or edit a source type

Edit `data/sources.json` on GitHub (pencil icon), then commit. The same small rules as the APA Trainer items apply: straight double quotes around text, commas between items but not after the last one.

Inside patterns and examples:
- `*text*` shows as *italics*.
- `{A}` is replaced by the author part (Author, A. / Author, A., & Author, B. / … / Organisation.), worked out from the choice the student makes.
- `{D}` is replaced by the date (`datePattern` in the pattern, `exampleDate` in the example), or by n.d.

| Field | Meaning |
|---|---|
| `id` | A short unique name, used in the link, e.g. `online-news`. |
| `title` | The name students see. |
| `group` | `"most"` (Most used) or `"more"` (Also useful). |
| `keywords` | Words students might search for. Add the words your students actually use (e.g. "canvas", "smh"). |
| `when` | One sentence: when to use this source type. |
| `authors` | Which "Who wrote it?" choices to show: `one`, `two`, `three`, `org`, `none`. The first one is selected unless `defaultAuthor` says otherwise. |
| `role` | Replaces "Author" in the pattern (e.g. `"Editor"`, `"Speaker"`, `"Lecturer"`). |
| `suffix` / `exampleSuffix` | Extra text after the names, e.g. `{ "one": " (Ed.)", "many": " (Eds.)" }`. |
| `datePattern`, `exampleDate` | e.g. `"Year, Month Day"` and `"2024, July 18"`. |
| `ndAllowed`, `ndDefault` | Show the "Is there a date?" choice; select "No date" first. |
| `org` | The example organisation: `{ "name": "…", "abbr": "…" }`. With `abbr`, the in-text box shows the first-time and after-that forms. |
| `orgPattern`, `orgExample` | A different pattern when an organisation is the author (e.g. no website name when it is the same as the author). |
| `none` | The pattern, example and in-text forms when there is no author. |
| `tips` | Short tips (a list). |
| `case` | The Capital letters note under the pattern: each part of the reference and whether it uses `"sentence"` case, `"title"` case or `"name"` (written as the name is written), with an example. |
| `ref` | The guide section it is based on (for you; not shown on the page). |
| `inTextOnly`, `inText` | For personal communications: no reference list entry, only in-text forms. |

The reference list rules are in `layout` at the end of the file.

After editing, open the page and check the source type with each "Who wrote it?" choice.

## Privacy

No sign-in, no tracking, no analytics. The page saves nothing except the light/dark choice shared with the rest of davenab.com.
