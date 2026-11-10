# Beta 2

Beta 1 was tested on claude.ai by people who had the link. For Beta 2, anyone with the hosted link can test it, can install it as an app, and can test with real footage.

## Done
- [x] **Hosted build:** runs on any static host (GitHub Pages) without a Claude account. Projects and media stay in the tester's browser.
- [x] **Installable web app:** manifest, offline service worker, app icons and an **Install app** button. Video, audio, image and `.editbay` files can be opened with Edit Bay from the desktop (Chrome and Edge).
- [x] **Free AI on the hosted site:** Help › AI Settings chooses what powers Create, the AI chat, Review and Smart Auto Cut.
  - **Free options:** Google Gemini with a free AI Studio key (recommended), any OpenAI-compatible service (OpenRouter's `:free` models, Groq, or Ollama and LM Studio on your own computer), or an open model running in the browser.
  - **Claude:** with your own key, or through the proxy in `server/`.
  - **Keys:** each one is checked when saved, stored only in the browser, and sent only to its own service.
- [x] **Feedback from hosted testers:** a prefilled GitHub issue labelled `beta-feedback`, including usage counts when the tester opted in.
- [x] **Version label:** "Beta 2" everywhere: About, feedback, crash reports and issues.
- [x] **Sample project:** **Try with sample media** opens an 11-second Dark Out teaser built from the real flyer, the DJ Samszy photo, the OTR logo and the real event facts.
- [x] **Privacy and terms:** `privacy.html` and `terms.html`, linked from the welcome screen and the Help menu. Have them reviewed before a wide launch.
- [x] **Captions in the browser:** **Auto captions** (Media panel) and **Transcribe** (Text tab).
  - Whisper runs on the device through Transformers.js. The model downloads once (77 MB, or 110 MB on GPUs with half precision) and then works offline.
  - Captions fit the frame: short lines on vertical video, and a sentence's last word stays on its line.
- [x] **Opt-in usage counts:** tool use, export success and failure, page visits. No media or text.
  - Asked once, after the tester has used the app for a while; changeable in Help.
  - The owner sees the totals in the Feedback Inbox.
- [x] **Storage:** asks the browser to protect stored data from automatic clearing. Warns at 80% full and blocks at 95% with a clear note. The existing per-file check before import stays.
- [x] **Tablet layout:**
  - Portrait tablets show the viewer and Inspector side by side, with Media in a slide-out drawer. Landscape tablets use the desktop layout.
  - Bigger touch targets on touch screens.
- [x] **Keyframe easing:** right-click a keyframe (◆) for Smooth, Linear, Ease in, Ease out or Hold.
- [x] **Real footage:** tested in Chrome with generated stand-ins for phone footage (no real phone files):
  - **Video:** variable frame rate (60 fps source), rotated portrait, 4K, and a 12-minute file.
  - **Audio-only:** AAC, MP3 and mono WAV.
  - **Result:** all import, play and export correctly, with orientation kept.
  - **HEVC and ProRes:** a browser that can't decode them now says why and what to do.
- [x] **Match the first clip:** when the first clip's shape differs from the timeline's (for example landscape footage in a vertical project), Edit Bay offers to match it.
- [x] **Browser check:** Help › Check This Browser tests export, 4K, HEVC, the audio encoder, WebGL, storage and WebGPU, and says what will and won't work.

## Still needs a person
- [ ] **Turn on GitHub Pages:** Settings → Pages → deploy from `main`, folder `/ (root)`. The app is then at `https://joseph-ops-java.github.io/OTR/editbay/`.
- [ ] **Create the `beta-feedback` label:** Issues → Labels → New label. GitHub only applies labels that already exist.
- [ ] **Try it on real machines:** a Mac and a Windows PC in Chrome or Edge, Safari on a Mac, an iPad, and Firefox. Run a Help › Check This Browser on each, plus a real iPhone (HEVC) clip and a real Android clip.
- [ ] **Legal review** of `privacy.html` and `terms.html`.

## Later
- **Clips:** compound or nested clips.
- **Collaboration:** multi-user editing with conflict handling.
- **Output:** ProRes, DNx and HDR export.
- **Keyframes:** a curve editor beyond the five easing presets.
