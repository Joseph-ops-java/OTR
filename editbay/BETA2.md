# Beta 2 checklist

Beta 1 was tested on claude.ai by people who had the link. For Beta 2, anyone with the hosted link can test it, on more browsers and with real footage.

## Done in this round
- [x] **Hosted build:** runs on any static host (GitHub Pages) with no Claude account. Projects and media stay in the tester's browser.
- [x] **Feedback from hosted testers:** opens a prefilled GitHub issue labelled `beta-feedback` (set in `config.js`). A copy is also saved on the device.
- [x] **Optional Claude for hosted copies:** a proxy you run (`server/`) keeps the API key off the page.
- [x] **First-visit notice:** says what the build is and where data goes.

## Must have before Beta 2 goes out
- [ ] **Turn on GitHub Pages** for the repository (Settings → Pages → deploy from `main`, folder `/root`). The editor is then at `https://joseph-ops-java.github.io/OTR/editbay/`. Open it once and run a full edit and export.
- [ ] **Create the `beta-feedback` label** in GitHub Issues, so reports are easy to filter.
- [ ] **Browser matrix:** Chrome and Edge are the targets. Firefox and Safari have gaps in WebCodecs (Safari has no AAC encoder in some versions; Firefox lacks some codecs). Test them, and keep the in-app warning accurate.
- [ ] **Real footage:**
  - **Phone video:** iPhone HEVC and Android video, both often variable frame rate.
  - **Long or large files:** 4K and anything over 10 minutes.
  - **Unusual audio:** mono, and audio-only files.
- [ ] **Sample project:** a "Try it with sample media" button, so testers without footage can test at once. Use real OTR assets (the Dark Out flyer and the DJ Samszy photo) where licensing allows.
- [ ] **Privacy page and terms:** needed for a public link (see "Before selling it" in the README). State that media never leaves the browser, except preview frames sent to Claude when the proxy is on.
- [ ] **Version label:** change `BETA` in `js/beta.js` to "Beta 2" so reports say which build they came from.

## Should have
- [ ] **Captions without files:** in-browser speech-to-text (Whisper on WebGPU), so captions don't need an `.srt` file.
- [ ] **Opt-in usage counts** (which tools people open, where they give up). No media, no personal data.
- [ ] **Storage warnings:** warn before the browser's storage quota fills, with a one-click "export project file + media".
- [ ] **Narrow screens:** a usable layout for tablets. Phones stay view-only.
- [ ] **Keyframe curves:** ease-in and ease-out editing, beyond the linear and hold keyframes.

## Later
- **Clips:** compound or nested clips.
- **Collaboration:** multi-user editing with conflict handling.
- **Output:** ProRes, DNx and HDR export (needs a server or native app).
