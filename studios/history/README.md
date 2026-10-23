# History Studio

Long-form illustrated history explainers in 16:9, like *How Ancient Egyptians Beat 50°C Heat Without Electricity*:
one illustrated picture per scene with a slow camera move, narration, phrase-at-a-time captions, and a little
moving atmosphere (heat haze, dust, embers…). A sister app to Shorts Studio, rebuilt for 5–15 minute videos.

## Start

History Studio is now part of Shorts Studio: one program, one helper, one set of keys. Start Shorts
Studio as usual (`npm start` in the shorts-studio folder) and press **History & news →** under the
name, or open <http://localhost:5173/history.html>. **Quiz shorts →** goes back.

How it is joined on:

| | Where |
|---|---|
| Its code | `studios/history/src` (the page) and `studios/history/server` (mounted by `server/index.mjs` through `mountHistory()`) |
| Its routes | `/api/history/...` on the Shorts Studio helper |
| Its projects | `studios/history/projects/` (not committed, as before) |
| Its pictures and clips | `studios/history/media/` (not committed), served at `/projects/`; the fonts and sounds come from the shared `public/` folder, where they were already identical |
| Its finished videos | `studios/history/out/`, served at `/history/out/` |
| Its tests | part of `npm test` in shorts-studio |
| API keys | the same ones Shorts Studio stores: a key typed in either studio works in both |

The old standalone copy in `C:\Users\user\history-studio` still runs on its own ports (5180 / 3040) and was
left untouched; its projects were copied here, not moved.

## Making a video

| Step | What happens |
|---|---|
| **1 Keys** | Gemini, Claude, ElevenLabs — all optional. Kept in the browser only. |
| **2 Story** | *AI writes it* from a topic, length, tone and language — **or** paste her own script. A pasted script is split into scenes at blank lines (long paragraphs at sentence ends). AI can then plan the pictures without touching her words. |
| **3 Scenes & pictures** | Edit narration and "picture shows" per scene. **Draw** with Gemini (every picture is matched to a style-reference picture ★ so the cast stays consistent), or **Copy prompt** → any image tool → **Upload** / drag-drop / "Upload many" (`scene-7.png` → scene 7, `scene-7b.png` → its second shot). Per scene: atmosphere, and how it arrives (transition). **✨ AI: suggest callouts & chapters** fills in both for the whole video. |
| **🎬 Animate** (per scene) | **Shots**: extra pictures that cut in on a word she clicks. **Camera**: 11 moves (zoom, pan, tilt, push-and-turn, handheld drift, rack focus, shake, whip) heading for a 🎯 focus point she clicks on the picture. **Character layer**: a character drawn on green, cut out in the browser, standing in front of the picture and moving with depth (breathe, bob, sway, walk in, rise). **AI clip**: Veo turns the picture into a 4–8 s animated clip. **Callouts**: label, arrow, circle, date stamp, counter, thermometer, map pin, map route, timeline — placed by clicking the picture, timed by clicking a word. **Chapter title**: a chapter card, and a YouTube chapter. |
| **4 Voice** | *ElevenLabs*: pick a voice, voice every scene (neighbouring lines are sent for a continuous read). *Record my own*: teleprompter, **Space** to start/stop, auto-advances, re-take anything. Silence is trimmed and levels evened out. With an ElevenLabs key, recordings get exact word timings for captions; otherwise they are estimated. |
| **5 Look** | Captions, camera amount, default transition and its length, grain, vignette, colour grade, title card, pause between scenes, chapter hold. Sound: music bed or her own track (ducked under the voice), sound effects (whoosh, pop, hit), ambience (wind, fire, rain) matched to each scene's atmosphere. |
| **6 Render** | 720p draft or 1080p final → `out/`. **Short**: pick a run of scenes, a hook and an end card → vertical 1080×1920, each picture cropped around its focus point. **Thumbnail**: big words with one in colour, the chosen picture, the shot's character big on the side → 1280×720 PNG. Plus title ideas, description (with **YouTube chapters** added in one click), tags, and claims worth double-checking. |

Everything inside a scene is pinned to **words**, not seconds: re-record a line faster or slower and the cuts
and callouts move with it.

### News explainers

On the Story step, switch **📜 History → 📰 News explainer**:

1. **The story.** Type it, or press **🔥 Suggest trending stories**: a live search for the region (default India +
   global) and the categories you tick (politics, international, science, tech, policy, business, health, climate).
2. **🔎 Research & write.** Two steps, because Gemini can't combine live search with strict JSON. First a
   live-searched research brief, via Gemini's Google Search grounding or Claude's web search, that cross-checks
   claims, keeps dates, and sets out every side. Then the writer turns the brief into scenes using only what the brief
   says, attributing claims, keeping quotes verbatim, and listing what is disputed or still developing.
   `server/news.mjs` does the research; `server/news-writer.mjs` writes. No key? The chatbot route asks a browsing
   chatbot to research and write in one go.
3. **Graphics instead of fake photos.** Numbers, places, quotes and people become graphics the video draws itself:
   headline, big number, bar chart, line chart, world map with highlighted countries, quote card, who's who,
   timeline, two sides (`src/remotion/graphics/`). Pictures are only generic editorial illustrations, never an
   identifiable real person. Any shot can switch between picture and graphic in 🎬 Animate, where the data is
   editable.
4. **Sources.** Each scene carries the sources behind it and shows a small "Source: …" tag (switchable in Look).
   The video ends on a "Reporting as of <date>" card, and **📰 Add sources to description** lists them all.
   Graphics come in three colour themes: Night newsroom, Newspaper and Bold black.

Maps use Natural Earth's de facto borders, which differ from some official maps (India, Pakistan and China, e.g.
Kashmir). The editor warns when one of those countries is on a map; for maps of India, upload an official map as a
picture instead.

### No API credits? Use any chatbot

Every AI button has a **💬 Use any chatbot** option beside it: writing the script, planning the pictures,
callouts and chapters, Flow motion prompts, music briefs, thumbnail words and placing elements. It copies the
exact job as one message (the instructions, the script, and the answer format) for the Gemini app, ChatGPT or
Claude.ai. Paste the reply back and it goes through the same checks as an API answer (`server/tasks.mjs`). If a
chatbot stops half way, ask it to "continue" and paste both parts; the pieces are joined.

### Stock photos and videos

Real places and people often look better as real photos. Every shot has **🔎 Stock** (on its card and in the
Animate editor): search, choose photos or videos, pick the libraries, click a result. The file is downloaded into
the project, and its credit (author, library, licence, page) is kept with the shot. **🔎 Fill N empty from stock**
on the Scenes step puts the best photo in every empty shot, never the same photo twice, as a starting point to
review. The writers suggest a short stock search for each shot; a search that finds nothing is retried with fewer
words.

| Library | Photos | Videos | Key |
|---|---|---|---|
| Pexels | ✓ | ✓ | free, <https://www.pexels.com/api/> |
| Pixabay | ✓ | ✓ | free, <https://pixabay.com/api/docs/> |
| Wikimedia Commons | ✓ | | none (best for famous places, people and historical images) |
| Openverse | ✓ | | none |
| NASA | ✓ | | none |

Only licences that allow use in a monetised video, with cropping, are offered: public domain, CC0, CC BY, CC BY-SA,
and the Pexels and Pixabay licences (non-commercial and no-derivatives files are filtered out). CC BY and BY-SA
need a credit: by default a small "Photo: name / Wikimedia Commons, CC BY-SA 4.0" shows on that shot (change it in
**Look**), and **🖼 Add stock credits to description** on the Render step lists every one. Photos of real people
are fine for news and commentary, but never imply that someone endorses something.

### Keeping it moving

Nobody watches one picture for twelve seconds. **Look → Something new on screen at least every…** (Off, 4, 3 or
2 seconds; 3 by default) fills every longer stretch with no cut or callout with *beats*, landing on words:

- **Punch-ins**: a snap zoom onto a detail of the picture, then back out on the next beat. Graphics get a gentle one.
- **Key words**: a number or name from the narration ("300 MPs", "New Delhi", "Priyanka Gandhi Vadra") stamped on
  screen as it is spoken, as a comic stamp in history videos and as a clean chip in news. Never over a graphic, the
  title card or the Short's hook.

Beats cost nothing and need no pictures. More real pictures help even more: see the storyboard below.

### Storyboard: a new picture every couple of seconds

Fast cartoon explainers change the drawing on almost every phrase. **📽 Storyboard** on the Scenes step splits every
scene into beats of about 2, 3, 4 or 6 seconds, cutting at full stops and commas, or before "and", "but" or "to",
and never inside "the | Red Fort", "300 | million" or a name. **✨ AI: storyboard every beat** (or **💬 Storyboard
with any chatbot**) then writes one picture and one stock search for each beat, a few scenes at a time, varying wide
shots, close-ups and inserts and keeping the cast from the style bible. It writes a style bible when there is none.
Pictures already made stay; empty extra shots are replaced. Then **🎨 Draw missing** or **🔎 Fill empty from stock**,
or **✕ Remove empty extra shots** to undo. A graphic opening a scene is held at least 4 seconds so it can be read.
Camera moves travel less on short shots, so fast cuts don't swim.

To match the stick-figure explainers in one click, **Look → ✏️ Fast ink cartoon** sets the **Ink cartoon** picture
style, **Subtitle box** captions, hard cuts and no colour grade. On the Story step, the **Deadpan & witty** tone writes
for it: dry one-liners, a running gag and concrete phrases a picture can land on.

### ElevenLabs v4 and voice directions

**Eleven v4** (the default for new videos) and **Eleven v4 Turbo** follow *audio tags*: stage directions in square
brackets written into the narration, right before the words they affect - `[amused] They asked to sell pepper.
[long pause] Then they stayed.` SSML `<break>` tags no longer work in v4; `[pause]` and `[long pause]` replace them.

- When the voice is v4, the writers (history and news) add a few tags, about one every two or three sentences, from a
  set that suits the tone (`[deadpan]`, `[dry]` for witty; `[hushed]`, `[awed]` for immersive). News only gets
  delivery and pacing tags (`[clear]`, `[measured]`), never one that sounds like an opinion.
- **Voice → 🎭 Voice directions → ✨ Add voice directions** (or any chatbot) adds tags to a script that already exists.
  A scene comes back only if every word is unchanged; otherwise it is left as it was. **✕ Remove all** takes them out.
- Tags are never shown or spoken as words: captions, word timings, cut points, the storyboard, picture prompts and
  stock searches all use the spoken words only (`src/lib/speech.ts`; the server splits words by the same rule).
  Older models get the bare words, since they would read the tags aloud. The teleprompter shows tags as stage directions.
- Pasted scripts keep tags like `[warm]` but still drop stage notes like `[MUSIC]` (capitalised ones).
- A new direction re-voices an ElevenLabs take, but not a recording you made yourself.
- v4 may not accept every setting older models took, so a voice request that is rejected is retried asking for less:
  first without the neighbouring scenes' text, then with only a stability step. It isn't simply failed.

### Living pictures

In **🎬 Animate → Living picture**, each shot can have animated elements, clicked into place on the picture:
smoke, steam, fire/torch, lamp glow, birds, clouds, sun rays, water glints, ripples, falling leaves, fireflies
and blowing sand. Each has its own size, strength and (where it travels) direction. They move with the camera
because they're drawn on the picture itself. **✨ Auto-place** has Gemini or Claude look at the picture and put
them where they belong (smoke on the chimney, glints on the river), and can also suggest a horizon and an
atmosphere. The chatbot route does the same with the picture attached. **Depth parallax** (best for open
landscapes) makes everything below a horizon line you click slide further than the sky. The **Breeze**
atmosphere makes plants and cloth sway.

### Google Flow and Flow Music

Neither has an official API (driving a subscription through an unofficial one risks the account), so the
studio hands work over and takes the results back:

- **Clips — Scenes step → 🎞 Animate in Google Flow.** Tick shots (one click ticks the opening and every chapter
  start), ✨ write motion prompts (or use the built-in template), **📦 Export Flow pack** → `out/flow-pack-…/` with
  numbered start frames, character cut-outs as Ingredients, `prompts.txt` and `HOW-TO.txt`. In Flow: *Frames to
  Video*, frame + prompt, save each clip as its number (`03b.mp4`). **⬆ Upload clips from Flow** takes them all at
  once and puts each on its shot; it plays instead of the still (optionally with Veo's own ambient sound).
  Single shots work the same way from 🎬 Animate (Copy for Flow / Save start frame / Upload clip).
- **Music — Look step → Music by chapter.** One row for the opening and one per chapter, each with a Flow Music
  brief (✨ written from the script: instruments of the era and region, mood, tempo, length, instrumental, sits
  under a voice). Upload the track on its row; it plays until the next chapter's track, crossfading, ducked
  under the narration. Rows without a track fall back to the music chosen above.

Every change is saved to `projects/<id>.json` as she works; pictures and clips live in `public/projects/<id>/`.
Editing a scene's words after voicing it marks that clip "out of date".

**Costs**: writing with Gemini is free. Drawing pictures needs billing on the Gemini key, ~4¢ each (≈$2 for a
45-scene, 9-minute video; extra shots and characters are extra pictures). Veo clips are billed per second of video
— check Google's pricing, typically $1–3 a clip, so keep them for the opening and big moments. ElevenLabs uses
about 1,350 characters per minute of video. All sound effects and ambience are synthesised locally (free, no licence).

**Render time**: roughly the length of the video for a 720p draft, about twice that for 1080p.

## How it fits together

```
browser (Vite + React, :5180)             helper (Node, 127.0.0.1:3040)
├─ Story      ── /api/story/write|direct ─► Gemini or Claude (server/writer.mjs)
│             ── /api/story/callouts ─────► callouts + chapters for a finished script
├─ Pictures   ── /api/image/draw ─────────► Gemini image models, with a style reference (server/images.mjs)
│             ── /api/image/upload ───────► public/projects/<id>/images (characters are keyed in src/lib/chroma.ts first)
│             ── /api/video/animate ──────► Veo, as a polled job (server/video.mjs)
├─ Voice      ── /api/voice/speak ────────► ElevenLabs with timestamps (server/tts.mjs)
│             ── /api/voice/upload ───────► mic WAV → ElevenLabs forced alignment if there is a key
├─ Projects   ── /api/projects/* ─────────► projects/<id>.json (server/projects.mjs)
├─ Render     ── /api/render ─────────────► Remotion → out/*.mp4, HistoryVideo or HistoryShort (server/render.mjs)
│             ── /api/thumbnail ──────────► one still of the Thumbnail composition → out/*.png
└─ live <Player> preview: the same HistoryVideo component the render uses
```

| Path | What it is |
|---|---|
| `src/lib/types.ts` | The data contract: Project → Scene → Shot / Layer / Callout, Design, VideoProps |
| `src/lib/timeline.ts` | Project → frame-exact timeline: scenes from audio, shots and callouts from word timings, chapter lead-ins, the Short, YouTube chapters |
| `src/lib/script.ts` | Splitting a pasted script; estimating word timings; finding a word |
| `src/lib/styles.ts` | Art style presets and the picture / character prompt composers (Draw and Copy send identical text) |
| `src/lib/callouts.ts` | Callout defaults, and applying the AI's suggestions to the right words |
| `src/lib/chroma.ts` | Green-screen cut-out for character layers (flood fill from the border, despill, crop to the feet) |
| `src/lib/migrate.ts` | Opens projects saved by older versions |
| `src/lib/recorder.ts` | Mic recording: trim silence, even the level, encode WAV |
| `src/lib/captions.ts` | Words → short on-screen phrases |
| `src/remotion/HistoryVideo.tsx` | The video and the Short: shots, camera, layers, clips, chapter cards, captions, hook, end card |
| `src/remotion/camera.ts` | The camera moves, as numbers (so layers can take them with parallax) |
| `src/remotion/Transitions.tsx` | Crossfade, cut, ink blot, paper tear, page, flash, whip, dip |
| `src/remotion/Callouts.tsx` | The hand-drawn callouts |
| `src/remotion/Elements.tsx` | The animated elements (smoke, birds, glints...) |
| `src/remotion/graphics/` | News graphics: `GraphicView.tsx` (headline, number, bars, line, quote, people, timeline, versus), `WorldMap.tsx`, `theme.ts` |
| `server/news.mjs` | Live research and trending stories (Gemini grounding / Claude web search), with sources |
| `server/news-writer.mjs` | The news writer: fairness rules, script shape with graphics and sources, output checks |
| `src/lib/beats.ts` | Beats: key words from the narration, punch-ins and pops placed in the long holds, hold stats |
| `src/remotion/Pops.tsx` | The key words on screen |
| `src/lib/speech.ts` | Audio tags: the spoken words of a narration, which models follow tags, tags as stage directions |
| `server/voice-direction.mjs` | The voice-direction guide the writers follow for v4, and "Add voice directions" (words never changed) |
| `src/lib/storyboard.ts` | Splitting scenes into beats at the seams of the sentence; storyboards in and out of a project |
| `server/storyboard.mjs` | The storyboard artist: one picture and stock search per beat |
| `server/stock.mjs` | Stock search (Pexels, Pixabay, Wikimedia Commons, Openverse, NASA), licence filtering, safe downloads |
| `src/ui/StockPicker.tsx` | The 🔎 Stock picker for one shot |
| `src/lib/stock.ts` | The default stock search for a shot |
| `src/ui/ChatbotHelper.tsx` | The "use any chatbot" fallback beside every AI button |
| `server/tasks.mjs` | Every AI job defined once: run through a key, or as a chatbot prompt and its reply read back |
| `src/remotion/Soundtrack.tsx` | Ducked music, ambience, sound effects |
| `src/remotion/Thumbnail.tsx` | The 1280×720 thumbnail |
| `src/ui/SceneEditor.tsx` | The 🎬 Animate editor |
| `server/` | The helper. `gemini.mjs`, `claude.mjs`, `retry.mjs` and `images.mjs` come from Shorts Studio; `audio-gen.mjs` synthesises the ambience loops on first start |

Project media is served to the preview by the helper (`/projects/…`, proxied by Vite), because Vite only knows
about public files that existed when it started.

## Checks

```bash
npm test
```

```bash
npm run typecheck
```

```bash
node --import ./tools/ts-resolve.mjs tools/stills.mjs <projectId> <outDir> 1 6 12
```

The last one renders a few frames of a saved project to PNGs, to check the look without a full render.

## Licence note

Remotion is free for individuals and small teams but requires a paid company licence beyond that. See <https://remotion.dev/license>.
