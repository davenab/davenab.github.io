/* Grammar Self-Correction Trainer: settings.
   aiEnabled: keep false. While it is false, students never see "My own writing".
   Teachers can still preview that mode with sample data by adding ?preview=1 to the address.
   aiProxyUrl: the address of YOUR small server-side proxy (see README, "Mode 2").
   Never put an API key in this file or anywhere in this repository. */
window.GSC_CONFIG = {
  aiEnabled: false,
  aiProxyUrl: "",
  maxWords: 150,
  storageKey: "gsc-v1"
};
