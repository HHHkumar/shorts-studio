# Shorts Studio

AI-generated explainer / MCQ videos in 9:16 or 16:9. Gemini writes the question and the script, DeepSeek optionally checks the answer, ElevenLabs speaks it, Remotion renders it to MP4 — all driven from one page in your browser.

**New here? Read [USER_GUIDE.md](USER_GUIDE.md) instead of this file.** It assumes no technical knowledge.

## Quick start

```bash
npm install
```

```bash
npm start
```

Your browser opens automatically. Paste a [Gemini key](https://aistudio.google.com/app/apikey) and an [ElevenLabs key](https://elevenlabs.io/app/settings/api-keys) on step 1, then follow the six steps.

Finished videos land in `out/`.

## How it fits together

```
browser (Vite + React)                    helper server (Node, 127.0.0.1:3030)
├─ step 1  keys                     ──►   POST /api/check-keys
├─ step 2  topic dials              ──►   POST /api/generate      ──►  Gemini
├─ step 3  edit the script          ──►   POST /api/validate      ──►  DeepSeek (optional)
├─ step 4  voice                    ──►   POST /api/voiceover     ──►  ElevenLabs
│                                          writes public/generated/<job>/s<n>.mp3
├─ step 5  theme + layout            ──►   POST /api/stock/*       ──►  Pexels + NASA (optional)
│                                    ──►   POST /api/image/generate ─►  ElevenLabs image models (optional)
├─ step 6  render                   ──►   POST /api/render        ──►  Remotion → out/*.mp4
└─ live <Player> preview the whole time, rendering the same component as the export
```

The helper server exists only because rendering needs headless Chrome and ffmpeg, which cannot run inside a browser tab. It binds to `127.0.0.1`, so it is not reachable from your network. API keys are held in `localStorage` and forwarded per request; they are never written to disk.

## How audio and video stay in sync

There is no manual timing anywhere:

1. Each script line is sent to ElevenLabs on its own, producing one mp3 per scene.
2. The server measures each mp3's true duration and keeps the per-character timings ElevenLabs returns.
3. `buildScenes()` in `src/lib/timeline.ts` turns those durations into frame counts, so every scene is exactly as long as its own narration plus a configurable breath.
4. In `QuizVideo.tsx` each scene's `<Audio>` lives inside that scene's `<Sequence>`, so it starts on the scene's first frame by construction.
5. The character timings are grouped into words and drive the karaoke captions.

The preview and the render consume the identical `VideoProps` object, so what you see is what you get.

## Layout

| Path | What it is |
|---|---|
| `src/lib/types.ts` | The data contract shared by every layer |
| `src/lib/theme.ts` | All colours, fonts and layout recipes — edit this to restyle |
| `src/lib/timeline.ts` | Turns audio durations into a frame-exact timeline |
| `src/remotion/` | The video itself (`QuizVideo.tsx`, `scenes/`, `ui.tsx`, `ReadAlong.tsx`, `Soundtrack.tsx`) |
| `src/remotion/sketches.ts` | The ten p5 animations, each a pure function of the frame |
| `src/remotion/P5Sketch.tsx` | Runs p5 deterministically: `noLoop()` plus a manual redraw per frame |
| `src/ui/` | The six wizard steps |
| `server/gemini.mjs` | Prompt, response schema, and repair of the model's output |
| `server/deepseek.mjs` | Independent second opinion on the answer, and report repair |
| `server/stock.mjs` | Pexels + NASA image search, and safe download to disk |
| `server/trends.mjs` | Live web search via Gemini grounding, for trending topic ideas |
| `server/sketch-catalogue.mjs` | What Gemini is told about the animation library |
| `server/gemini.test.mjs` | Regression suite for the prompt and output repair (`npm test`) |
| `server/tts.mjs` | ElevenLabs calls and word-timing extraction |
| `server/images.mjs` | ElevenLabs image generation: prompt building, create-then-poll, credits |
| `src/lib/subtopics.ts` | Sub-topic suggestions per subject, across all three content modes |
| `server/render.mjs` | Remotion bundle + render, with progress reporting |

## Animated sketches

`visual.kind: 'sketch'` runs a p5 animation behind the explanation. Remotion never calls
`requestAnimationFrame` — it seeks to a frame and screenshots it — so p5's own loop is switched off
and `redraw()` is called from a layout effect, with `randomSeed()` reset every draw. Every sketch
must therefore be a pure function of `progress` and `time`. Verified: the same frame rendered in
three separate passes hashes identically.

Gemini chooses a sketch by name from `server/sketch-catalogue.mjs` and supplies parameters; it never
writes drawing code. The catalogue and the implementations in `src/remotion/sketches.ts` must stay in
step — `verifyAgainstImplementations()` checks that.

## Content modes

`contentType` on the topic form picks which brief the writer gets. All three produce the same
`QuizContent` shape, so nothing downstream branches on it — only the prompt changes.

| Mode | Subjects | Exam list | Prompt guidance |
|---|---|---|---|
| `general` | `SUBJECTS` (16) | none — an audience level instead | curiosity-led, counter-intuitive |
| `electrical` | `ELECTRICAL_SUBJECTS` (20) | `EXAMS` | `examLines()` in `server/gemini.mjs` |
| `aptitude` | `APTITUDE_SUBJECTS` (28) | `APTITUDE_EXAMS` | `aptitudeLines()` in `server/gemini.mjs` |

The aptitude brief differs from the other two in what it optimises for: solvable against a clock,
distractors that are the mistakes candidates actually make, and an explanation that names the method
rather than just reaching the answer. In explainer mode `aptitudeBrief()` in `server/explainer.mjs`
replaces the default "pictures and analogies, not equations" framing — a method video needs the
working on screen — and steers the storyboard onto the `process`, `versus` and `recap` panels.

`server/aptitude.test.mjs` guards the cross-file drift: every entry in `APTITUDE_EXAMS` (browser)
must have a style in `APTITUDE_STYLE` (server), and `src/lib/subtopics.test.mjs` requires every
subject in all three lists to have sub-topic suggestions.

## Backdrops

Step 5 offers two sources for the photo behind each scene, and they share one picker because the
renderer cannot tell them apart — both end up in the same `stockSrc` field on the scene.

**Free stock.** Pexels (needs a free key) and NASA (needs none). Costs nothing, but both libraries
are overwhelmingly landscape, so a 9:16 short centre-crops every photo and throws away the edges.

**Drawn by ElevenLabs.** The same key that speaks the script can draw a backdrop, in the aspect
ratio you are actually rendering, in one consistent style across every scene of a video. Press
**Draw** on a scene and the server builds a prompt from that scene's `imageQuery` plus the subject
and topic, calls `POST /v1/flows/image`, polls until it is done, and saves the result under
`public/generated/ai/`. The signed link ElevenLabs returns expires within the hour, which is why the
file is on disk before the request comes back.

Two things to know before you use it:

- **It costs credits** from the same ElevenLabs balance as the voiceover, and image generation on
  the API needs a **Pro plan or above**. On a lower plan the voiceover still works and the Draw
  button returns a message saying so.
- **Nothing is generated that you did not ask for.** There is no "draw them all" button on purpose —
  one press, one scene, one image, added beside the stock candidates so you can compare before
  applying it.

Generated backdrops are credited as such in the publish kit and the caption, which is what platforms
increasingly expect for synthetic imagery.

## Other commands

```bash
npm run studio
```

Opens Remotion Studio against the demo props — useful for tweaking the visuals without burning API credits.

```bash
npm run guide:pdf
```

Re-typesets `USER_GUIDE.md` into `Shorts Studio - User Guide.pdf`. This is the one part of the
project that needs Python, and its two packages are not covered by `npm install`:

```bash
pip install -r tools/requirements.txt
```

Run it whenever you change the guide — the PDF is committed, so a stale one is a stale one for
everybody who clones.

## Licence note

Remotion is free for individuals and small teams but requires a paid company licence beyond that. See <https://remotion.dev/license>.
