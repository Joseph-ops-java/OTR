# Edit Bay tests

Browser tests that drive the real editor in Chromium (Playwright): import, editing, export, audio, colour, transcripts, the AI features (against mocked services), hosted mode and the security policy. They run on every pull request that touches `editbay/` (see `.github/workflows/editbay-tests.yml`).

## Run them

```bash
editbay/tests/make-fixtures.sh
```

```bash
node editbay/tests/run.js
```

To run only some suites, name them: `node editbay/tests/run.js t10 t29`.

- **Server:** the runner serves `editbay/` on port 8765 itself.
- **Pass or fail:** a suite fails if it crashes, logs a page error, doesn't finish with `no errors`, or doesn't print the results listed for it in `EXPECT` in `run.js`.
- **Output:** screenshots and exported videos go to `tests/out/`.

## Suites

| Suite | Covers |
|---|---|
| `test` | Core editing: import, transitions, looks, keyframes, freeze, titles, captions, beats, export |
| `t3` | Multicam synced by audio, Remove Pauses, Auto Cut |
| `t10` | Reverse and ramped clips, frame-accurate export, playback proxies |
| `t11` | J/L cuts, track EQ and compressor, loudness normalisation, crossfades, meters |
| `t12` | Source viewer three-point edits, match frame, transcripts, filler removal |
| `t13` | GPU grading: LUTs, curves, wheels, looks |
| `t14` | Create from a prompt (Claude mocked) |
| `t15` | Typed nudges, trims, resizable layout |
| `t16` | Claude chat, Scenes, feedback, tour |
| `t17` | Accessibility labels, toasts, effect badges |
| `t20` | Rebindable keys, automatic backups |
| `t22` | Effects, transitions, chroma key, blend, crop, Effects browser, AI effect ops |
| `t24` | Grade copy, LUTs in project files, preview quality, keyframes, overlay transitions, extra tracks |
| `t25` | Command search, right-click menus, ruler labels, export presets, recent projects |
| `t27` | Hosted mode: no AI, feedback to GitHub, Claude proxy (mocked) |
| `t29` | Sample project, HEVC message, keyframe easing, captions (model mocked), browser check, offline app |
| `t31` | Claude with the tester's own key (API mocked) |
| `t34` | Gemini and OpenRouter free models (mocked) |
| `t35` | Offline command reader |
| `t36` | Security policy: unknown hosts blocked, AI services allowed, export still works |

## Not covered here

These need real downloads or real keys, so they're checked by hand:
- **Captions:** in-browser Whisper.
- **AI services:** live Gemini, OpenRouter, Groq and Claude.
- **Other browsers:** Safari and Firefox.

| Suite | Covers |
|---|---|
| `t37` | Captions on claude.ai: the built-in speech model under a policy that blocks other hosts, and the AI clean-up (mocked) |
| `t40` | Score & sound: generated music and sound design on A2/A3, and export |
| `t41` | The chat changes the music and restyles captions; all ten moods render; caption style chips |
| `t42` | Voiceover from the built-in voice model (and heard back by the speech model), the sound description the AI reads, ducking by speech, find and replace in captions, Score window controls, Finish my video |

Run `editbay/models/fetch-voice.sh` once before `t42`: the voice model (88 MB) is downloaded, not kept in git.
