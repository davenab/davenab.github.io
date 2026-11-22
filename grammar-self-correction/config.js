/* Grammar Self-Correction Trainer: settings.
   aiEnabled: true shows "My own writing" (AI marks errors with codes; it never rewrites).
   Set false to hide it. Teachers can preview with sample data by adding ?preview=1 to the address.
   aiProxyUrl: Dave's Cloudflare Worker (_tools/cloudflare/worker.js, route /gsc).
   Never put an API key in this file or anywhere in this repository. */
window.GSC_CONFIG = {
  aiEnabled: true,
  aiProxyUrl: "https://api.davenab.com/gsc",
  maxWords: 150,
  storageKey: "gsc-v1"
};
