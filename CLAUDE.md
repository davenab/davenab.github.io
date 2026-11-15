# Notes for Claude

This repo is Dave Nab's GitHub Pages portfolio (https://davenab.github.io), published from `main` (root).

- Each app is a self-contained static page in its own folder: `/<slug>/index.html`. No build step, no backend, no API keys in the code (the repo is public).
- Apps must work without sign-in on laptops and phones, keep student data on the device (localStorage at most), and support light/dark mode.
- When an app goes live, update its card in the root `index.html` (status `Live` + `Try it →` link). Card skills: listen, read, write, gram, vocab.
- Planned apps: lecture note-taking trainer, dictogloss, skim-and-scan timer, paragraph X-ray, synthesis builder, error-correction coach (coded hints), nominalisation & hedging drills, register swapper.

## Shared styles and resources
- Shared CSS: `/assets/site.css`; shared JS (theme toggle, year, filters with `data-f` / `data-cat`): `/assets/site.js`. Use root-absolute paths (`/assets/...`).
- `/resources/` is the teaching-resources hub (slides, word lists, worksheets). Each resource gets its own SEO page copied from `/resources/_template/` (remove its noindex), a card on the hub, and an entry in `/sitemap.xml`.
- Paid files must never be committed (the repo is public): link to the external store page instead. Only free files go in the repo.
