# Edit Bay

A video editor that runs in the browser, with Claude as an assistant editor.

It is plain HTML, CSS and JavaScript with no build step. Two MIT/BSD libraries are vendored in `js/vendor/`.

## Run it locally

Serve the folder over HTTP, because browsers block some features on `file://` pages:

```bash
cd editbay
python3 -m http.server 8080
```

Then open http://localhost:8080 in Chrome or Edge.

## What it does

### Create and cut
- **Create from a prompt:** Claude watches your footage (contact sheets), writes a script and scene plan, and builds a timeline with shots, transitions, a look, titles, captions, music and an end card. It uses only your media and the facts in your brief.
- **Editing:** a magnetic timeline (V1–V3, A1–A3), with a Source viewer for marking In/Out and inserting, overwriting, appending or connecting onto a chosen track.
- **Tools:** match frame, slip, roll, blade, ripple delete, freeze frame, multicam synced by audio, J/K/L including reverse, and typed frame nudges.

### Picture
- **Speed:** ramps (Montage, Hero, Bullet, Flash in/out, Jump cut) and reverse.
- **Effects:** transitions, keyframes, and titles with animation presets.
- **Colour on the GPU (WebGL):** white balance in linear light, lift/gamma/gain wheels, RGB and per-channel curves, 3D `.cube` LUTs, looks, scopes and a before/after split.

### Sound
- **Edits:** J/L split edits (limited to available handles) and equal-power crossfades.
- **Mixing:** per-track EQ and compressor, ducking, and audio scrubbing.
- **Loudness:** a live K-weighted meter and integrated measurement to ITU-R BS.1770.

### Text
- **Transcripts:** import `.srt`, `.vtt`, or word-level JSON (Whisper, AssemblyAI, Deepgram).
- **Editing by text:** cut by deleting words or lines, and remove filler words.
- **Claude can cut by what people say,** using the transcript.

### Delivery
- **Frame-accurate export:** WebCodecs H.264, with our own Rec.709 conversion so colours match on every browser.
- **Audio:** AAC, or Opus where the browser has no AAC encoder.
- **Loudness:** normalised to −14, −16 or −23 LUFS, with a −1 dB look-ahead peak limiter.
- **Interchange:** FCPXML (Final Cut Pro, DaVinci Resolve), EDL (CMX 3600), `.editbay` project files, versions, and still frames.

### Media
- **Device storage:** originals are kept in IndexedDB, so file size is limited only by disk space.
- **Playback proxies:** an optional constant-frame-rate playback proxy for heavy footage. Exports still use the original.
- **Cloud proxies** for syncing.

## Where it runs

| | On claude.ai (as an Artifact) | Self-hosted |
|---|---|---|
| Editing, colour, audio, export, interchange | Yes | Yes |
| Projects and media | Your account (projects, files up to 20 MB) plus this device | This device (IndexedDB) |
| Claude: Create, Assist, Review, Smart Auto Cut | Yes | Needs a backend (see below) |
| Saving files | claude.ai download prompt | Normal browser downloads |

The app asks for platform features with `window.claude.use(name)`. When that returns nothing, it falls back to `LDB` (IndexedDB database), `LBLOB` (device media) and `LDOWN` (downloads) in `js/store.js`.

### Adding Claude to a self-hosted copy

The AI features call `sample.json(prompt, {images})` and expect a JSON reply (see `runAssist` in `js/pro.js`, `claudePick` in `js/auto.js` and `runCreate` in `js/director.js`). To enable them, provide a `window.claude.use("sample")` shim that forwards those calls to your own server. That server calls the Anthropic Messages API with your API key. Never put an API key in the browser.

## Files

| File | What it does |
|---|---|
| `js/icons.js`, `js/store.js` | Icons; device storage (IndexedDB database, media, downloads) |
| `js/app.js` | Projects, inspector tabs, history, live data |
| `js/editor.js` | Timeline model, compositor, trimming tools, clip inspector, export dialog |
| `js/pro.js` | Pages, scopes, mixer, captions, beats, Claude Assist |
| `js/auto.js` | Multicam, Auto Cut, Remove Pauses |
| `js/frames.js` | MP4/MOV demux and sequential WebCodecs decoding (forward and reverse) |
| `js/render.js` | Offline export, audio mix, loudness, encoders, transcodes and proxies |
| `js/audio.js` | Split edits, crossfades, track EQ/compressor, scrubbing, loudness meter |
| `js/source.js` | Source viewer, three-point editing, match frame, transcript editing |
| `js/gl.js` | WebGL grading: wheels, curves, LUTs |
| `js/director.js` | Create from a prompt |
| `js/polish.js` | Reverse playback, typed nudges, resizable panels |
| `js/suite.js` | File menu, project files, versions, EDL/FCPXML/still export, storage, welcome, About |
| `js/vendor/mp4-muxer.js` | mp4-muxer 5.1.3 (MIT, Vanilagy) |
| `js/vendor/mp4box.all.min.js` | mp4box.js 0.5.2 (BSD-3-Clause, GPAC) |

## Limits to know

- **Formats:** only codecs the browser can decode open. ProRes, BRAW, R3D and MXF don't. HEVC depends on the operating system and hardware.
- **Export output:** 8-bit H.264, with no ProRes, DNx or HDR.
- **Export speed:** depends on the machine. Grading and encoding run on the GPU and hardware encoder where available.
- **Not built yet:** nested or compound clips, custom keyboard shortcuts, and live multi-user conflict resolution (the last save wins).
- **FCPXML:** speed changes, ramps, reverse and freeze frames are flagged in comments, not carried over.
- **Transcripts:** they are imported, not generated in the page.

## Beta testing

- **Privacy:** the owner works in the shared database. Every other signed-in person who can save works in a private space (`data/users/<id>/ws/…`) that nobody else can read, the owner included. View-only visitors and signed-out visitors work on their own device. Access rules keep the shared data readable only by the owner and editors.
- **Feedback:** the Feedback button and File › Send Feedback store reports in `feedback/<id>`. Each tester can write only their own entry, and only the owner and editors can read them all. Crashes are reported automatically, with no media. The owner reads everything in File › Feedback Inbox. People who can't save (view-only links) can copy their feedback from Help instead.
- **First run:** a short tour runs on first use, and the page warns about browsers without WebCodecs or storage and about small screens.
- **Claude:** the Claude tab keeps a per-project conversation. A version is saved before every AI edit, so each reply has Undo and Try again. The Scenes tab shows the storyline as editable scene cards.

## Before selling it

- **Legal review:** have the app and its About text reviewed. That covers terms of use, a privacy policy, and disclosure of the AI features: Claude receives a description of the timeline and, for Create, Review and Smart Auto Cut, small preview frames.
- **Fonts:** they are from Google Fonts (SIL Open Font License). Self-host them to work offline.
- **Media rights:** users are responsible for having the rights to the media and music they edit.
