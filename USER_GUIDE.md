# Shorts Studio — the complete guide

You do not need to know how to code to use this. If you can copy and paste, you can run it.

This guide covers everything: what the tool is, how to start it, how to make a video, how to keep
your work safe with Git, and how to run the same tool on a second computer.

---

## Contents

1. [What this tool actually is](#1-what-this-tool-actually-is)
2. [Setting up, once](#2-setting-up-once)
3. [Starting it, every time](#3-starting-it-every-time)
4. [Making a video — the seven steps](#4-making-a-video--the-seven-steps)
5. [Git — your undo button](#5-git--your-undo-button)
6. [GitHub — your backup and your bridge](#6-github--your-backup-and-your-bridge)
7. [Running it on another computer](#7-running-it-on-another-computer)
8. [What it costs](#8-what-it-costs)
9. [When something goes wrong](#9-when-something-goes-wrong)
10. [Where things are saved](#10-where-things-are-saved)
11. [Questions people ask](#11-questions-people-ask)
12. [A checklist for good videos](#12-a-checklist-for-good-videos)

---

## 1. What this tool actually is

You pick a subject, press a button, and about three minutes later you have a finished video with a
real human-sounding voiceover, ready to upload.

Four services do the work, and they all run from one page in your browser:

| | What it does | Needed? |
|---|---|---|
| **Google Gemini** | Writes the question, the four options, the explanation and the exact words the narrator says. Also writes your title, tags and description at the end. | Required |
| **ElevenLabs** | Turns that script into speech. | Required |
| **DeepSeek** | Solves the question independently and says whether it agrees with Gemini. | Optional |
| **Pexels + NASA** | Free photos to sit behind the text. NASA needs no key. | Optional |

The video itself is drawn on your own computer by **Remotion**, which is why rendering costs nothing.

### Two kinds of video

- **Curiosity STEM** — counter-intuitive science and maths questions for a general audience.
- **Electrical exam prep** — questions in the style of a real paper, aimed at a specific exam:
  GATE EE, ESE/IES, SSC JE, RRB JE, State AE/JE, PSU (UPPCL/DMRC/NTPC/BHEL), or ITI/Wireman.

### Two shapes

- **Portrait 9:16** — Shorts, Reels, TikTok. 30 to 90 seconds.
- **Landscape 16:9** — a proper explainer for YouTube. 2 to 5 minutes.

**How long does one video take?** Roughly 3–4 minutes of your attention, most of it waiting. The very
first video takes longer, because the tool downloads its rendering engine once.

---

## 2. Setting up, once

### Node.js

This is the program that runs everything. Check whether you already have it — press the **Windows
key**, type `powershell`, press **Enter**, then type:

```bash
node -v
```

A reply like `v20.11.0` or higher means you are fine. An error means you need it: go to
[nodejs.org](https://nodejs.org), download the big green **LTS** button, click Next through the
installer, then **close and reopen PowerShell**.

### Your API keys

An "API key" is a long password that lets this tool use an online service on your behalf.

**Gemini** (required — writes the questions)

1. Go to <https://aistudio.google.com/app/apikey>
2. Sign in with any Google account → **Create API key** → copy it.
3. It looks like `AIzaSyD…`

**ElevenLabs** (required — does the voice)

1. Go to <https://elevenlabs.io> and make a free account.
2. Go to <https://elevenlabs.io/app/settings/api-keys> → **Create API key** → copy it.
3. It looks like `sk_1a2b3c…`

**DeepSeek** (optional — double-checks the answer)

1. Go to <https://platform.deepseek.com/api_keys> → **Create new API key** → copy it.
2. It looks like `sk-1a2b3c…`

Worth adding. Gemini writes the question *and* marks its own answer, so nothing catches a
confidently wrong one. A check costs a fraction of a cent.

**Pexels** (optional — backdrop photos)

1. Go to <https://www.pexels.com/api/> → sign up free → **Get Started** → copy the key.

Without it you still get NASA's public-domain library, which is excellent for space and physics but
thin for chemistry and biology.

> **Keep these private.** Anybody holding your key can spend your credits. Never put one in a
> screenshot, a video, or a message. They are stored only in your browser, never in a file — which is
> also why they are never uploaded to GitHub.

### Install the packages

Open PowerShell and go to the project:

```bash
cd C:\Projects\shorts-studio
```

Then:

```bash
npm install
```

This takes one to three minutes. Yellow warnings are normal — only a red `ERR!` means trouble.

> ### If you see "running scripts is disabled on this system"
>
> This is a Windows security default, not a fault in the tool. Two ways past it.
>
> **The easy way, changing nothing** — add `.cmd`:
>
> ```bash
> npm.cmd install
> ```
>
> Use `npm.cmd` everywhere this guide says `npm`. That is the whole fix.
>
> **The permanent way** — run this once and press `Y`:
>
> ```bash
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```
>
> `RemoteSigned` lets scripts written on your own computer run, while anything downloaded from the
> internet must still be signed. It applies to your account only, and it is what Microsoft recommends
> for people who develop on Windows.

---

## 3. Starting it, every time

```bash
cd C:\Projects\shorts-studio
```

```bash
npm start
```

Wait about five seconds and your browser opens by itself. If it does not, look in PowerShell for a
line reading `Local: http://localhost:5173/` — the number may differ — and click it.

**Leave the PowerShell window open the whole time.** That black window *is* the engine. Closing it
stops the tool. When you are finished for the day, click it and press `Ctrl + C`.

---

## 4. Making a video — the seven steps

Seven numbered buttons run across the top. You move left to right. Steps you have not earned yet stay
greyed out on purpose, so you cannot get lost.

### Step 1 — Keys

Paste your keys and press **Test my keys**. You want green ticks. It also reports how many
ElevenLabs voice credits you have left this month.

You do this once, ever. If a key is rejected, the cause is almost always a stray space — clear the
box and paste again.

### Step 2 — Topic

Where you decide what the video is about.

| Setting | What it does |
|---|---|
| **What kind of video** | **Curiosity STEM** for a general audience, or **Electrical exam prep** for candidates revising. |
| **Exam** *(exam prep only)* | Sets the depth. GATE and ESE want derivation and analysis; SSC and RRB want standard formulas at speed; ITI wants practical wiring and safety with no calculus. |
| **Format** | Portrait or landscape. **Pick this first** — it changes how much script is written and how the frame is laid out. |
| **Subject / topic** | Leave the topic empty and Gemini picks something interesting for you. |
| **Who is watching** | Sets vocabulary and assumed background. |
| **Difficulty** | *Very easy* through *Brutal*. |
| **Question style** | *Mathematical* = the viewer must calculate. *Theoretical* = they must reason. *Real-world* = anchored in daily life. |
| **Narration language** | The language spoken *and* shown. Kannada, Hindi, Tamil and Telugu render in their own script — pair with a matching voice in step 4 and the Multilingual v2 model. |
| **Curiosity factor** | The most important dial. **8 or 9** is the sweet spot: counter-intuitive enough to make people comment. |
| **Target length** | 40–50s performs best for Shorts. 180–240s is the sweet spot for explainers. |
| **Gemini model** | Flash is fast and cheap. Pro is worth it for hard maths. The list is built from your own key, so it only offers models you can actually use. |

**Your intro (optional).** Type a greeting — *"Hi, it's Hemanth here. Ready for today's question?"* —
and it becomes the first thing the video says. There are one-click presets. **Gemini never rewrites
this**: whatever you type is spoken and shown word for word.

Press **Generate the question**. Five to twenty seconds.

### Step 3 — Script

You check Gemini's homework. **This is the most important step and the one people skip.**

> **Only the spoken words appear on screen.** The narration *is* the on-screen text — shown a few
> words at a time, each word lighting up as it is said. There is no separate headline to keep in
> step, and no labels, step counters or subject chips cluttering the frame.

Every line is editable. **Read the question and satisfy yourself the marked answer is right** — AI is
confidently wrong sometimes, and ten seconds here saves publishing something embarrassing.

**The second opinion.** With a DeepSeek key you get a **Check the answer** button:

| Badge | Meaning |
|---|---|
| ✅ **DeepSeek agrees** | Both models got the same answer. |
| ⚠️ **Reservations** | The answer stands, but something needs a look. |
| ❌ **DeepSeek disagrees** | They got **different answers**. One is wrong. |

On a disagreement you get a one-click button to switch the marked answer — but read the reasoning
first. DeepSeek is not automatically right either; the value is knowing to look. Pick **Reasoner** for
hard maths.

Edit the question afterwards and the badge is replaced by *"the check is out of date"* — a stale tick
is never left pretending the new version was verified.

**Watch the length.** The heading says how many seconds of speech the script contains. If it came out
well under your target you get a warning — regenerate now, while it is still free.

### Step 4 — Voice

Pick a voice from your own ElevenLabs account and press **Hear this voice** to sample it. If the list
is empty, add any voice from the [Voice Library](https://elevenlabs.io/app/voice-library) and reload.

The cost is shown before you spend anything. Press **Make the voiceover**.

> **This is where sync happens.** Every clip is decoded in your browser and measured for real — exact
> length, where sound starts, where it stops. Each scene is then made exactly as long as its own clip,
> always rounding *up*, so a line can never be cut off. The subtitles are nudged by the few
> milliseconds of silence every MP3 carries at its start, which lands the highlight on the right
> syllable.

**The options light up as they are read**, because the narration reads them in order.

Open **Show the sync report** to see the numbers per scene. If a line ever sounds clipped, turn off
**Trim trailing silence** in step 5.

### Step 5 — Look

Everything here is instant, free, and never touches the voiceover.

- **Dark or light**, and four layouts: **Simple** (clean), **Elegant** (serif, documentary),
  **Nerdy** (terminal green on graph paper), **Flashy** (loud, best in a feed).
- **Highlight colour**, **thinking time** (3–5s), **breathing room**.
- **Show the spoken words** — the read-along text. Leave it on; most people watch on mute.
- **Draw the diagrams** — only on explanation and outro scenes, never before the answer, because
  anything shown earlier gives it away. As well as static ones (a formula box, comparison bars, a
  side-by-side panel, an icon) Gemini can choose a **live animation** from a fixed library of ten:
  wave interference, a travelling wave, orbits, a projectile arc, a pendulum, a vector field,
  spreading particles, a graph being drawn, an atom, and light refracting.
- **Drift topic symbols** — faint themed emoji behind everything.
- **Backdrop photos** — press **Find backdrop photos** and it searches Pexels and NASA per scene,
  using a search term Gemini wrote for that scene. **Nothing is applied for you**: a photo library
  will cheerfully return a beach for "gravity". Click the ones that fit, skip the rest.
- **Sound** — three built-in music beds (calm, tense, upbeat), or load your own file. The music
  **ducks automatically** under the narration. Effects: a countdown tick, an option whoosh, an answer
  chime, and a sweep between scenes.

Play the phone preview before rendering. Fixing something here takes a second; after a render it
takes minutes.

### Step 6 — Export

Choose a quality (**Normal** is right almost always) and press **Render the video**.

> **The first render is the slow one.** The very first time, the tool downloads a rendering browser
> of about 150 MB. It can look like nothing is happening for several minutes. It only ever happens
> once per computer.

A 45-second video takes one to three minutes. You get a player, a download button, and the file is
saved into the `out` folder automatically.

### Step 7 — Publish

Gemini writes your upload kit from the finished video: **several title options** to choose from, a
description, tags, hashtags, suggested thumbnail text, and a pinned comment. Each has a copy button.

For exam-prep videos the title and first line of the description lead with the exam name, subject and
topic, because that is what people actually type into search.

---

## 5. Git — your undo button

Git takes **snapshots** of your project. It is the reason a mistake can never cost you more than a
few minutes.

Three ideas, and that is genuinely all you need:

- **A commit** is a labelled snapshot. "Here is what everything looked like at 4pm."
- **Your history** is the list of those snapshots.
- **You can always go back** to any of them.

Git deliberately ignores three things: `node_modules` (hundreds of megabytes, rebuilt by
`npm install`), your finished videos, and generated audio. Everything that matters is tracked.

### The only commands you need

See what you have changed:

```bash
git status
```

Stage everything you changed:

```bash
git add -A
```

Save the snapshot:

```bash
git commit -m "describe what you changed"
```

The message is for future-you. "Made the countdown longer" beats "update".

See your history:

```bash
git log --oneline
```

### Undoing things

Throw away changes to one file you have messed up:

```bash
git restore path/to/file
```

Throw away **all** uncommitted changes and go back to your last snapshot:

```bash
git restore .
```

> ⚠️ That last one is not itself undoable. It discards everything you have changed since your last
> commit. Commit often and it is never frightening.

---

## 6. GitHub — your backup and your bridge

**GitHub is a website that stores a copy of your project in the cloud.** It does two jobs: it is a
backup if your laptop dies, and it is how the same project reaches a second computer.

Your project lives at **github.com/HHHkumar/shorts-studio**, and it is **private** — only you can see
it.

Send your latest snapshots up:

```bash
git push
```

Bring down changes made on another machine:

```bash
git pull
```

### The rhythm that keeps it painless

**Pull before you start. Push before you stop.**

A full session looks like this:

```bash
git pull
```

…do your work, then…

```bash
git add -A
```

```bash
git commit -m "what you changed"
```

```bash
git push
```

If you forget and edit the same file on both machines, Git will ask you to reconcile the two
versions. Irritating, but nothing is ever lost.

> **If a push fails with "Permission denied to \<some other name\>"**, Windows has a different GitHub
> account saved. That is exactly why your project's address includes your username:
> `https://HHHkumar@github.com/HHHkumar/shorts-studio.git`. It tells Git which account to use.

---

## 7. Running it on another computer

Everything you need is on GitHub, so this is four commands.

**1.** Open PowerShell where you want the project to live, then:

```bash
git clone https://HHHkumar@github.com/HHHkumar/shorts-studio.git
```

**2.** Go into it:

```bash
cd shorts-studio
```

**3.** Install the packages (this is why `node_modules` is not in the repo — it is rebuilt here):

```bash
npm install
```

**4.** Start it:

```bash
npm start
```

### Three things that do not travel, by design

- **Your API keys.** They live in your browser, never in a file. Paste them into step 1 again.
- **The rendering browser.** The first render on the new machine downloads it again (~150 MB, once).
- **Your finished videos.** They are too big for a repo. They stay on the machine that made them.

After that, both computers are equal. Pull before you start, push before you stop, and they stay in
step.

---

## 8. What it costs

| Service | Free allowance | One video uses |
|---|---|---|
| **Gemini** | A generous free tier | One or two requests. Realistically free. |
| **ElevenLabs** | 10,000 characters a month | A short uses 500–900 characters (**10–20 a month free**). A five-minute explainer uses about 4,400 (**two a month**). |
| **DeepSeek** *(optional)* | Pay as you go, no free tier | A fraction of a cent per check. |
| **Pexels / NASA** *(optional)* | Free | Nothing. |
| **Rendering** | Unlimited | Your own computer. Costs electricity. |

Changing the look, re-rendering, editing text and picking photos all cost **nothing**. Only
*Generate the question*, *Make the voiceover*, *Check the answer* and *Publish* spend anything.

To stretch ElevenLabs credits: shorter targets, and the **Flash** voice model.

---

## 9. When something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| *"running scripts is disabled on this system"* | Windows blocks npm's launcher by default. | Use `npm.cmd`, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. |
| Red box: *"The helper server is not running"* | The PowerShell window was closed. | Reopen it, `cd` to the folder, `npm start`, reload the page. |
| *"That … API key was rejected"* | Bad key, usually a stray space. | Re-copy it from the provider and paste again. |
| *"Your ElevenLabs character quota is used up"* | Out of voice credits this month. | Wait for the reset, shorten the video, or upgrade. |
| *"Your DeepSeek account has no credit left"* | DeepSeek has no free tier. | Top up, or clear the key to turn the check off. |
| *"Gemini rate limit hit"* | You generated too fast. | Wait a minute and try again. |
| *"Your key cannot use that Gemini model"* | The model is not available to your key. | Reload the page — the dropdown rebuilds from your own key. |
| No voices in the dropdown | Your ElevenLabs account has no voices saved. | Add one from the Voice Library, reload. |
| Render stuck at 0% the first time | It is downloading the rendering browser. | Wait. It happens once per computer. |
| *"The output file is locked"* | A video player still has the last render open. | Close it and render again. |
| A spoken line sounds clipped | Trailing silence trimmed too aggressively. | Step 5 → turn off **Trim trailing silence**. |
| A diagram shows wrong numbers | Gemini invented them. | Fix that scene in step 3, or turn off **Draw the diagrams**. |
| The script is far shorter than asked | Gemini underwrote it. | Step 3 warns you. Regenerate, or switch to a stronger model. |
| Push fails: *"Permission denied to …"* | Windows has another GitHub account saved. | Make sure the address includes `HHHkumar@`. |
| A change seems to have no effect | An old server is still running from before. | `Ctrl + C` in PowerShell, then `npm start` again. |
| Everything is confusing | — | Step 7 → **Reset everything**, then start from step 1. |

---

## 10. Where things are saved

Inside `C:\Projects\shorts-studio`:

- **`out\`** — your finished videos. **This is the folder you want.** Nothing here is ever deleted
  automatically, and nothing here goes to GitHub.
- `public\generated\` — voiceover clips and downloaded photos. Cleared automatically after a day.
- `public\audio\` — the music beds and effects, regenerated on first boot.
- `.git\` — your snapshots. Do not touch it; that is Git's business.
- Your keys and settings — in your browser, not in any file.

---

## 11. Questions people ask

**Can I use my own voice?**
Yes. Clone it on the ElevenLabs website and it appears in the step 4 dropdown.

**Can I change the fonts and colours?**
Yes. `src\lib\theme.ts` holds every visual choice, with comments. Save it and the preview updates
instantly. If you break it, `git restore src/lib/theme.ts` puts it back.

**Does it work offline?**
No. Gemini, ElevenLabs and the one-time renderer download all need the internet. Re-rendering a video
you already generated works offline.

**Is my data going anywhere?**
Your topic settings go to Google, your script to ElevenLabs, and your question to DeepSeek if you
enabled it. Nothing else leaves the computer — the helper server listens only on `127.0.0.1`, so
nothing on your network can reach it.

**Why is my project not in OneDrive any more?**
OneDrive was syncing `node_modules` — tens of thousands of files — which is slow and can lock files
mid-render. Git does the job properly, so the project moved to `C:\Projects`.

**Can I sell the videos I make?**
Check each service's terms. Note in particular that **Remotion is free for individuals and small
teams but needs a paid company licence beyond that** — see <https://remotion.dev/license>.

**Something is still wrong.**
Look at the PowerShell window. The last few red lines usually say plainly what failed.

---

## 12. A checklist for good videos

- Curiosity factor at **8 or 9**. Boring questions do not get watched.
- 40–50 seconds for Shorts; 180–240 for explainers.
- **Read the question in step 3 and verify the answer yourself.**
- Run the DeepSeek check — a disagreement between two models is the cheapest bug report you will get.
- Keep the read-along text on; most viewers are on mute.
- Only pick backdrop photos that genuinely fit. An unrelated one makes it look worse, not better.
- Thinking time of 3–5 seconds. Longer and people scroll away.
- **Commit and push when you finish.** It takes ten seconds and it is the whole safety net.
