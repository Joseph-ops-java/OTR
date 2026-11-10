/* Edit Bay — settings for a self-hosted copy (GitHub Pages or any static host).
   On claude.ai these are ignored: Claude, accounts and feedback come from the platform. */
window.EDITBAY_CONFIG={
  /* Where hosted testers send feedback. A prefilled GitHub issue opens with their report. Leave "" to keep feedback on the device only. */
  feedbackUrl:"https://github.com/Joseph-ops-java/OTR/issues/new",
  /* Optional: the URL of your own Claude proxy (see server/README.md). Leave "" to run without AI features. */
  claudeProxy:"",
  /* Optional: extra servers the page may call (for example a custom OpenAI-compatible endpoint). Everything else is blocked. */
  connect:[]
};
