# davenab.com app style guide (prompt to reuse)

Paste this into any chat where you build a new learning app for davenab.com, together with what the app should do.

---

Build this app so it looks and behaves like the rest of davenab.com. Follow every rule below.

## 1. Where it lives and how it's built
- Repo: `davenab/davenab.github.io` (public, GitHub Pages, custom domain https://davenab.com).
- The app goes in its own folder: `/<app-slug>/index.html`, plus `style.css`, `app.js` and `data/*.json` as needed. Plain HTML, CSS and JavaScript only: no framework, no build step, no server, no sign-in.
- **No API keys or secrets anywhere** (the repo is public). If AI feedback is needed later, it goes behind a separate server-side proxy, switched off by default in `config.js`.
- **Privacy:** student work and progress stay on the device (localStorage only), with a "Clear my data" button. No tracking or analytics inside apps. (One approved exception: the Grammar and Vocabulary Hubs can share anonymous before/after scores, opt-in only, through the davenab-api Worker; see `_tools/cloudflare/SETUP.md`.) The app must still work if storage is blocked; it just doesn't save.
- Must work on phones (from 360 px wide) and laptops, with no horizontal scrolling.
- Australian/British spelling. Plain, short instructions for B1–C1 students.

## 2. Load the shared site pieces (required)
In `index.html`, before the app's own script:
```html
<script src="/assets/appbar.js"></script>
```
- This adds the slim dark bar at the top ("DN Dave Nab · All apps · Resources"). Don't build your own site navigation.
- On the app's **finish screen** (end of a session), add the "What next?" box:
  ```js
  html += (window.DNNext ? DNNext.html("<app-id>") : "");
  ```
  Then add the new app to `APPS` and `NEXT` in `/assets/appbar.js`, with 2–3 sensible next steps (another app, a resource page or a lesson kit), and add it to the other apps' `NEXT` lists where it fits.
- Footer link back: `<a href="/apps/">More apps by Dave Nab</a>`.
- In `<head>`, add the share image and a description:
  ```html
  <meta name="description" content="Free [skill] practice for EAP students. … No sign-in. Your work stays on your device.">
  <meta property="og:image" content="https://davenab.com/assets/og/davenab-share.png">
  <meta name="twitter:card" content="summary_large_image">
  ```
- Theme: read and write the same localStorage key as the website, `theme` (`"light"` / `"dark"`), set as `data-theme` on `<html>`. Add this in `<head>` so the page doesn't flash:
  ```html
  <script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>
  ```

## 3. Colours (CSS tokens on `:root`)
Define these exact tokens, with the dark values under both `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` and `:root[data-theme="dark"] {…}`. The body background always comes from `--bg`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#faf8f4` | `#0f1319` | Page background |
| `--surface` | `#ffffff` | `#1a2029` | Cards |
| `--surface-2` | `#f2efe8` | `#222a35` | Quiet panels, chips |
| `--text` | `#1b2330` | `#e8ebf0` | Main text |
| `--muted` | `#5f6672` | `#a2a9b5` | Secondary text |
| `--border` | `#e5e0d6` | `#2c3542` | Borders |
| `--ink` | `#1f3a5f` | `#9cc0ee` | Primary buttons, links, headings accents |
| `--accent` | `#d9822b` | `#f4b860` | Small accents (not small text on light backgrounds: use `#a65e14` there) |
| `--sun` | `#FFFF00` | `#FFFF00` | Signature yellow (rules below) |

Skill colours (text on tinted background): Listening `#2f6fb0`/`#e5effa` · Reading `#2e7d5b`/`#e3f2ea` · Writing `#8a4fb5`/`#f1e8f8` · Grammar `#b4553a`/`#f9e6df` · Vocabulary `#9a7400`/`#fbf1d4`. Dark-mode versions: `#8dbbf0`/`#1c2b3d`, `#7fd1aa`/`#1a3128`, `#c9a1ec`/`#2c2238`, `#f0a58e`/`#3a241d`, `#ead07a`/`#352d14`.
Green (Reading) also means correct; red-brown (Grammar) means wrong or needs work.

**Yellow `#FFFF00` is only for:** the DN logo square, a highlighter swipe behind one key phrase in a heading, the small dot before eyebrow labels, progress-bar fills, and "selected" markers. Never for text, large backgrounds or buttons.

## 4. Type
- Fonts (Google Fonts): **Inter** 400/500/600/700/800 for everything; **Fraunces** italic 500 for one accent word in a heading only. Fallbacks: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` and `Georgia, serif`.
- Headings: bold, tight letter-spacing (about -0.035em), `text-wrap: balance`. Keep them moderate in size; Dave doesn't want them too large. Page title about `clamp(2rem, 4.5vw, 3.2rem)`, section titles about 1.4–1.8rem.
- Body 16–17 px, line-height about 1.6, lines no wider than about 65 characters.
- Eyebrow above the main heading: uppercase, 12–13 px, bold, letter-spaced, in the accent colour, with a small yellow dot before it.

## 5. Layout and components
- Centred content column, max about 1100–1180 px; side padding `max(16px, env(safe-area-inset-left))`.
- **Cards:** `--surface` background, 1 px `--border`, radius about 18–22 px, a soft shadow in light mode only.
- **Buttons:** pill-shaped (radius 999 px), 600 weight. Primary = `--ink` background with `--bg` text; secondary = `--surface` with a border. Hover: lift 2 px. Every button says exactly what it does ("Start practising", "Check my answer", "See my results").
- **Chips/tags:** small pills in the skill colours.
- **Feedback:** give hints, codes and comparisons rather than the answer straight away; let the student do the thinking. Reveal answers only when asked.
- **Progress:** a simple bar or "3 of 10" counter; a summary at the end; a "My progress" page; "Copy summary" and "Print".
- **Structure for students:** a short start screen (what it is, how long it takes, one main button) → practice → finish screen with results, a goal or reflection, "Practise again" and the **What next?** box.
- Hash-based pages inside the app are fine (`#/practice`, `#/progress`, `#/about`).
- An **About** page that explains what is stored, where, and how to clear it.

## 6. Motion
- Subtle only: fade/slide-up on new screens (about 0.4–0.6 s, ease `cubic-bezier(.16,1,.3,1)`), 2 px hover lifts.
- Respect `prefers-reduced-motion: reduce` (turn animation off).

## 7. Accessibility (must pass)
- Text contrast at least 4.5:1 in **both** themes (check small amber or coloured text on light backgrounds).
- Visible focus style (3 px outline, accent colour). Everything works with the keyboard.
- Tap targets at least 40 px high on phones.
- Real `<button>`s and `<label>`s; `aria-live` for feedback messages; `alt` text on images.
- Use the `hidden` attribute with `[hidden]{display:none!important}` so CSS can't override it.

## 8. Content and integrity
- Write all practice texts yourself (or Dave supplies them); no copyrighted articles. External media (TED, news) is linked or embedded with attribution, not copied.
- Mark unchecked practice texts with `"verified": false` and show a small "Draft content" label until Dave checks them; include a teacher-only check page.
- Don't claim alignment with, or endorsement by, any university or by IELTS. Say "IELTS-style".

## 9. When the app is ready (website listing)
- In `_tools/build.py`: add the app to `APPS` (live apps first) and to `LIVE` (title → folder), then run `python3 _tools/build.py .`.
- Add the app's URL to `/sitemap.xml`.
- Add it to `APPS`/`NEXT` in `/assets/appbar.js`, and to `STUDENT_FREE` on the student resources page if it suits.
- Test on a phone-sized screen in light and dark mode, check there are no console errors, then commit.

---
