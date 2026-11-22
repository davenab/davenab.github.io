/* Grammar Hub + Vocabulary Hub settings.
   apiBase: the address of the davenab-api Cloudflare Worker (see _tools/cloudflare/SETUP.md),
            e.g. "https://davenab-api.YOUR-SUBDOMAIN.workers.dev". Leave "" to switch off
            BOTH anonymous score sharing and AI feedback (everything else still works).
   aiFeedback: true shows the "Get AI feedback" button on the "Use it" step (needs apiBase).
   Never put an API key in this file: the repository is public. */
window.DN_HUB_CONFIG = {
  apiBase: "",
  aiFeedback: true
};
