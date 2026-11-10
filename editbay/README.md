# Edit Bay

A video editor that runs in the browser, with Claude as an assistant editor.

It is plain HTML, CSS and JavaScript, with no build step and no dependencies apart from Google Fonts.

## Run it locally

Browsers block some features on `file://` pages, so serve the folder over HTTP:

```bash
cd editbay
python3 -m http.server 8080
```

Then open http://localhost:8080 in Chrome or Edge.

## Where it runs and what works there

| | On claude.ai (as an Artifact) | Self-hosted |
|---|---|---|
| Editing, colour, audio, multicam, Quick Auto Cut, exports | Yes | Yes |
| Projects and media saved | Your account (projects, media up to 20 MB) plus this device (all media) | This device (IndexedDB) |
| Claude Assist, Review, Smart Auto Cut | Yes | Needs a backend (see below) |
| Saving files (exports, EDL, project files) | Through claude.ai's download prompt | Normal browser downloads |

The app asks for its platform features with `window.claude.use(name)`. When `window.claude` is missing, it falls back as follows:

- `db` uses `LDB` in `js/store.js`, a small IndexedDB-backed database with the same calls.
- Large media is always kept in IndexedDB (`LBLOB`), so the file size is limited only by the browser's storage quota.
- `downloads` uses `LDOWN`, a normal `<a download>`.
- `sample` (Claude) is unavailable, so the AI features show a message and Auto Cut uses its on-device Quick mode.

### Adding Claude to a self-hosted copy

The AI features call `sample.json(prompt, {images})` and expect a JSON reply (see `runAssist` in `js/pro.js` and `claudePick` in `js/auto.js`). To enable them, provide a `window.claude.use("sample")` shim that forwards these calls to your own server. That server calls the Anthropic Messages API with your API key. Never put an API key in the browser.

## Files

| File | What it does |
|---|---|
| `index.html` | App shell and load order |
| `js/icons.js` | Interface icons (SVG) |
| `js/store.js` | Device storage: IndexedDB database, media blobs, file saving |
| `js/app.js` | Projects, inspector tabs, project history, live data |
| `js/editor.js` | Timeline model, playback and compositing engine, trimming tools, clip inspector, export |
| `js/pro.js` | Edit, Color, Audio and Deliver pages, scopes, mixer, captions, beat detection, Claude Assist |
| `js/auto.js` | Multicam (audio sync, angle viewer), Auto Cut, Remove Pauses |
| `js/suite.js` | File menu, project files (`.editbay`), versions, EDL and still export, storage manager, cloud proxies, welcome, About |
| `css/*.css` | Styles (single dark theme) |

## Browser support

- Chrome and Edge get full support, with MP4 (H.264/AAC) export.
- Firefox exports WebM.
- Safari plays and edits, but can't preview colour grades (canvas filters).
- Exports render in real time on the user's device.

## Before selling it

- **Legal review:** have the app and its About text reviewed for your market. That covers terms of use, a privacy policy, and disclosure of the AI features: Claude receives a description of the timeline and, for Review and Smart Auto Cut, small preview frames.
- **Fonts:** they come from Google Fonts under the SIL Open Font License. Self-host them if you need to work offline or avoid third-party requests.
- **Media rights:** users are responsible for having the rights to the media and music they edit.
