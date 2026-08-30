# Shorts Studio — the complete beginner's guide

You do not need to know how to code to use this. If you can copy and paste, you can make videos with it.

---

## 1. What this thing actually does

You pick a subject and press a button. Then:

1. **Google Gemini** invents a multiple-choice question, the four answer options, the explanation, and the exact words a narrator should say.
2. **ElevenLabs** turns those words into a real human-sounding voiceover.
3. **Remotion** draws the video — 1080 × 1920, the tall shape used by YouTube Shorts, Instagram Reels and TikTok — and glues the voiceover onto it.
4. You get an `.mp4` file you can upload anywhere.

The whole thing runs on your own computer, in your own browser. Nothing gets uploaded to anybody except Google and ElevenLabs.

**How long does one video take?** About 3–4 minutes of your time, most of which is waiting. The very first video takes longer, because the tool has to download its rendering engine once.

---

## 2. What you need before you start

### A. Node.js

This is the program that runs the tool. Check whether you already have it:

1. Press the **Windows key**, type `powershell`, press **Enter**.
2. Type this and press Enter:

```bash
node -v
```

If you see something like `v20.11.0` or higher, you are fine. If you see an error, go to [nodejs.org](https://nodejs.org), download the big green **LTS** button, run the installer, click Next until it finishes, then **close and reopen PowerShell** and try again.

### B. Two API keys

An "API key" is just a long password that lets this tool use an online service on your behalf. You need two of them. Both are free to start.

**Gemini key** (writes the questions)

1. Go to <https://aistudio.google.com/app/apikey>
2. Sign in with any Google account.
3. Click **Create API key**.
4. Click the copy icon. The key looks like `AIzaSyD…`, about 39 characters.

**ElevenLabs key** (does the voice)

1. Go to <https://elevenlabs.io> and create a free account.
2. Go to <https://elevenlabs.io/app/settings/api-keys>
3. Click **Create API key**, give it any name, click Create.
4. Copy it. It looks like `sk_1a2b3c…`

**DeepSeek key** (optional — double-checks the answer)

1. Go to <https://platform.deepseek.com/api_keys>
2. Sign in, click **Create new API key**, then copy it. It looks like `sk-1a2b3c…`

You can skip this one. If you add it, step 3 gains a **Check the answer** button that hands the
question to a completely different model, which solves it from scratch and tells you whether it
agrees with Gemini. A check costs a fraction of a cent.

**Pexels key** (optional — backdrop photos)

1. Go to <https://www.pexels.com/api/>
2. Sign up free, click **Get Started**, then copy the key.

Also optional. It lets step 5 search for a photo to sit behind each scene. NASA's public-domain
library is searched alongside it and needs no key at all, so even without a Pexels key you get good
coverage for space, physics and earth science.

> **Keep these private.** Anybody who has your key can spend your credits. Do not put them in a screenshot, a video, or a message to anyone.

Paste both somewhere safe for a minute — Notepad is fine — because you will need them in a moment.

---

## 3. One-time setup

Do this **once, ever**.

1. Open PowerShell.
2. Go into the tool's folder by typing this (including the quote marks) and pressing Enter:

```bash
cd "C:\Users\heman\OneDrive\Desktop\ncert math\shorts-studio"
```

3. Type this and press Enter, then wait 1–3 minutes:

```bash
npm install
```

You will see a lot of text scroll past. Warnings in yellow are normal. As long as it finishes without a red `ERR!`, you are done.

> ### If you get "running scripts is disabled on this system"
>
> This is a Windows security default, not a problem with the tool. Windows refuses to run npm's
> PowerShell launcher until you say otherwise. There are two ways past it.
>
> **The easy way — change nothing.** Add `.cmd` to the command:
>
> ```bash
> npm.cmd install
> ```
>
> Use `npm.cmd` everywhere this guide says `npm`, including `npm.cmd start`. That is all.
>
> **The permanent way — allow your own scripts.** Run this once:
>
> ```bash
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```
>
> Press `Y` and Enter. `RemoteSigned` lets scripts written on your own computer run, while anything
> downloaded from the internet still has to be signed. It applies to your user account only, and it is
> the setting Microsoft recommends for people who develop on Windows. After this, plain `npm` works.

---

## 4. Starting the tool (every time)

1. Open PowerShell.
2. Paste the `cd "C:\Users\..."` line from above and press Enter.
3. Type this and press Enter:

```bash
npm start
```

4. Wait about five seconds. **Your browser opens by itself.** If it does not, look in PowerShell for a line that says `Local: http://localhost:5173/` (the number might be 5174 or similar) and click it.

**Leave the PowerShell window open the whole time you are using the tool.** That black window *is* the engine. If you close it, the tool stops working. When you are completely finished, click on the PowerShell window and press `Ctrl + C` to shut it down.

---

## 5. The six steps

Across the top of the page there are six numbered buttons. You move left to right. Steps you have not earned yet are greyed out — that is deliberate, so you cannot get lost.

### Step 1 — Keys

Paste your Gemini key in the first box and your ElevenLabs key in the second.

Click **Test my keys**. You want two green ticks. It also tells you how many voice credits you have left this month.

You only ever do this once. The keys are remembered in your browser, on this computer only.

> If a key is rejected, the most common cause is an accidental space at the start or end. Delete the box's contents and paste again carefully.

Click **Continue**.

### Step 2 — Topic

This is where you decide what the video is about. Every setting has a short explanation under it. The ones worth understanding:

| Setting | What it does |
|---|---|
| **What kind of video** | **Curiosity STEM** for a general audience, or **Electrical exam prep** for candidates revising. Exam prep swaps the subject list for the electrical syllabus and asks for questions in the style of a real paper. |
| **Exam** *(exam prep only)* | GATE EE, ESE/IES, SSC JE, RRB JE, State AE/JE, PSU, or ITI/Wireman. This sets the depth: GATE and ESE want derivation and analysis, SSC and RRB want standard formulas at speed, ITI wants practical wiring and safety with no calculus. |
| **Format** | **Portrait 9:16** for Shorts, Reels and TikTok (30–90 seconds). **Landscape 16:9** for a real explainer on YouTube proper (2–5 minutes). Pick this first: it changes how much script Gemini writes and how the video is laid out. |
| **Subject** | The broad field, e.g. Physics, Biology, Computer Science. |
| **Specific topic** | Optional. Leave it empty and Gemini picks something interesting inside the subject for you. Fill it in when you want a particular thing, e.g. `photosynthesis` or `binary search`. |
| **Who is watching** | Sets the vocabulary and the assumed background knowledge. |
| **Difficulty** | How hard the question is, from *Very easy* to *Brutal*. |
| **Question style** | *Mathematical* = the viewer must calculate something. *Theoretical* = the viewer must reason, no arithmetic. *Real-world application* = anchored in everyday life. *Balanced* = a bit of both. |
| **Narration language** | The language the voice speaks *and* the language shown on screen. Kannada, Hindi, Tamil, Telugu and the rest render in their own script. Pair this with a matching ElevenLabs voice in step 4 and use the Multilingual v2 voice model. |
| **Curiosity factor** | The most important dial. Low = a plain textbook question. High = a counter-intuitive result that makes people comment. **8 or 9 is the sweet spot for social media.** |
| **Target length** | How long the finished video runs. **40–50 seconds performs best for Shorts**; below about 40 there is no room to explain anything. In landscape, 180–240 seconds is the sweet spot. |
| **Tone of voice** | How the script is written — hyped, calm, witty, patient. |
| **Gemini model** | *Flash* is fast and cheap and fine for almost everything. *Pro* is worth it for genuinely hard maths. |

#### Your intro (optional)

Type a greeting and it becomes the first thing the video says — *"Hi, it's Hemanth here. Ready for
today's question?"* or *"Welcome back to \<your channel\>."* There are one-click presets to start from.

**Gemini never rewrites this.** Whatever you type is spoken and shown word for word. Leave it empty
and the video jumps straight into the hook.

#### Longer explainers

In landscape the target runs from two to five minutes, and the script is budgeted to actually reach it.

The tool works backwards from the number you pick: 300 seconds is about 780 spoken words, so after
the question, the options and the answer are accounted for it asks for **15 explanation scenes of
about 46 words each**. Those scenes are told to follow an arc rather than restate one point — ground
the idea, the key concept, the mechanism, a worked example with real numbers, the common
misconception, then where it shows up in real life.

The answer options sit in a 2×2 grid instead of a stack, to suit the wider frame.

> **Watch the length in step 3.** It says how many seconds of speech the script actually contains. If
> it came out well under what you asked for, you get a warning — press **Write a different question**
> and try again, or switch to a stronger Gemini model. Regenerating is free; discovering it after the
> voiceover is not.

> **A five-minute video is not cheap in voice credits.** About 4,400 characters, so roughly **two
> long explainers a month** on the ElevenLabs free tier, against 10–20 shorts. Step 4 tells you the
> cost before you spend it.

Under **Advanced** you can tell Gemini what to avoid, or give it a free-text instruction like *"use an example from Indian railways"*.

Click **Generate the question**. It takes 5–20 seconds.

### Step 3 — Script

Now you check Gemini's homework. **This is the most important step, and it is the one people skip.**

You will see:

- **The question** and its four options. The green one is the correct answer. If Gemini marked the wrong one as correct, click **mark correct** next to the right one. Any text here can be edited by clicking in it.
- **The script**, split into scenes, each with one box: 🎙️ **Spoken out loud**.

> ### What you write is what appears
>
> There is only ever **one** text in the video, and it is the narration. Whatever a scene says out
> loud is also drawn on screen, a few words at a time, with each word lighting up as it is spoken.
>
> That means you never have to keep two versions of anything in step. Edit the spoken line and the
> on-screen text changes with it, automatically and exactly.
>
> Keep each line **short** — 12 to 22 words. It has to work as speech *and* as big type on a phone.

**Read the question and check the answer is genuinely right.** AI is confidently wrong sometimes. Ten seconds of checking here saves you publishing something embarrassing.

> **Only the spoken words appear on screen.** There are no labels, step counters or subject chips
> over the video, and diagrams only appear from the explanation onwards — anything shown before the
> reveal would give the answer away.

#### The second opinion (if you added a DeepSeek key)

Gemini writes the question *and* marks its own answer, so nothing catches a confidently wrong one.
Press **Check the answer** and DeepSeek solves the question independently, then reports back:

| Badge | What it means |
|---|---|
| ✅ **DeepSeek agrees** | Both models got the same answer. Good sign. |
| ⚠️ **DeepSeek has reservations** | The answer stands, but something needs a look — an ambiguous option, a wrong number in a diagram, a shaky claim in the fun fact. |
| ❌ **DeepSeek disagrees** | The two models got **different answers**. One of them is wrong. |

On a disagreement you get a one-click **Mark ⟨X⟩ correct** button — but read the reasoning first.
DeepSeek is not automatically right either; the value is that you now *know* to look.

Choose **Reasoner** as the checking model for hard maths: it is slower but far better at catching a
wrong calculation. **Chat** is fine for everything else.

The report is tied to the exact question it checked. Edit the question, the options or the marked
answer and the badge is replaced by *"The check is out of date"* — a stale tick is never left on
screen pretending the new version was verified.

If you do not like the question at all, click **Write a different question** to go back and generate a fresh one.

Meanwhile, on the right, a **live phone preview** has appeared. It is silent for now and the timings are estimates — that gets fixed in the next step.

Click **Looks good, add a voice**.

### Step 4 — Voice

Pick a voice from the dropdown. These are the voices on *your* ElevenLabs account. Click **Hear this voice** to sample it.

> **No voices in the list?** Open the [ElevenLabs Voice Library](https://elevenlabs.io/app/voice-library), click **Add** on any voice you like, then reload this page.

The **voice model** dropdown controls quality versus cost. *Multilingual v2* sounds best and is the right default. *Flash* is the cheapest if you are making a lot of videos.

Under **Fine-tune the delivery** you can adjust stability, style and speed. You can safely ignore all of it the first few times.

The blue box tells you roughly how many credits this will cost, before you spend anything.

Click **Make the voiceover**. It records one clip per scene and shows you progress like *"Recording line 3 of 7"*. A 45-second video takes about 20–40 seconds to record.

**The options light up as they are read.** Because the narration reads the four options in order,
each row on screen highlights at the exact moment the voice reaches it.

**This is where the sync happens.** After recording, the tool decodes every clip in your browser and
measures it for real — exact length, where the sound actually starts, and where it stops. Each scene
is then made exactly as long as its own clip, always rounding *up*, so a line can never be cut off.
The clip is played from that scene's first frame, so there is nothing that can drift.

It also nudges the subtitles by the few milliseconds of silence every MP3 carries at its start, which
is what puts the highlighted word on the exact syllable being spoken.

Open **Show the sync report** to see the numbers per scene: clip length, where speech ends, and the
caption nudge. If a line ever sounds clipped, turn off **Trim trailing silence** in step 5.

The preview on the right now plays with sound. Press play and watch it.

### Step 5 — Look

Change anything here as much as you like. It is instant, it is free, and it never touches the voiceover.

- **Dark or light** — dark is the safe default for social media.
- **Layout** — four presets:
  - **Simple** — clean and readable. Works for any subject.
  - **Elegant** — serif type, calm pacing, documentary feel.
  - **Nerdy** — terminal green on graph paper. Great for maths and code.
  - **Flashy** — loud colours, big bounce. Built for the scroll feed and the one that usually performs best.
- **Highlight colour** — override the layout's accent colour.
- **Thinking time** — how long the countdown timer runs before the answer. 3–5 seconds.
- **Breathing room** — extra silence after each spoken line. Raise it if the video feels rushed.
- **Show the spoken words on screen** — the read-along text. **Leave this on.** Most people watch short videos on mute.
- **Progress bar** — a thin line across the top that fills up. Helps retention.
- **Draw the diagrams** — shown only on the explanation and outro scenes, never before the answer.
  Gemini picks a small graphic where one genuinely helps. As well as the static ones (a formula box,
  comparison bars, a side-by-side panel, an icon) it can choose a **live animation** from a fixed
  library of ten: wave interference, a travelling wave, orbits, a projectile arc, a pendulum, a
  vector field, spreading particles, a graph being drawn, an atom with electron shells, and light
  refracting at a boundary. Gemini picks one by name and sets its knobs — it never writes code, so a
  bad choice simply falls back to no diagram rather than breaking the render.
  a **formula** box for a calculation step, **comparison bars** for "which is bigger", a **side-by-side**
  panel for before/after, or a single big **icon**. Scenes that do not need one simply do not get one.
- **Drift topic symbols** — faint themed emoji floating behind everything, so a text-only video does
  not look like a slide deck.
- **Trim trailing silence** — cuts the dead air the voice model leaves at the end of each line, which
  is what makes the pacing feel tight. Turn it off if any line ever sounds clipped.

#### Backdrop photos

Press **Find backdrop photos** and the tool searches **Pexels** and **NASA** for every scene, using a
search term Gemini wrote for that scene specifically. You then click the one you want, or skip the
scene entirely.

**Nothing is applied for you, on purpose.** A photo library will cheerfully return a beach for
"gravity", and an unrelated backdrop makes a science video look worse rather than better. You can
edit the search words for any scene and search again.

Chosen photos sit *behind* the text, dimmed and slightly blurred, with a slow drift so a still does
not look frozen. **How strongly the photo shows** controls the balance — around 0.45 reads as
atmosphere without fighting the words.

Both libraries are free for commercial use and neither requires credit, but the photographer and
NASA are added to the caption you copy in step 6 anyway.

#### Sound

- **Background music** — three built-in beds: *Calm pad* (soft chords, stays out of the way),
  *Tense pulse* (a low heartbeat, good for hard questions) and *Upbeat* (a light arpeggio). They are
  generated on your own computer, so there is no licensing question about using them. The music
  **ducks automatically** underneath the narration, so it never fights the voice.
- **Use my own music file** — load an MP3, WAV, M4A, AAC or OGG instead. It ducks the same way.
- **Music volume** — 0.20 to 0.25 sits nicely behind a voice. Higher starts to compete.
- **Sound effects** — a tick each countdown second, a whoosh as each option arrives, a chime when the
  answer turns green, and a sweep between scenes.

Watch the phone preview while you change things. Skim through the whole video here before you render — fixing something now takes a second, fixing it after a render takes minutes.

Click **Make the video**.

### Step 6 — Export

Choose a quality (**Normal** is right almost always) and click **Render the video**.

> **The first render is slow.** The very first time, the tool downloads a special rendering browser, roughly 150 MB. That can take a few minutes and looks like nothing is happening. It only ever happens once. Every render after that starts in seconds.

A progress bar shows *Drawing frames… 340 / 1260*. A 45-second video usually takes 1–3 minutes depending on your computer.

When it finishes you get a video player right there. Watch it. Then:

- **Download the MP4** — saves it to your Downloads folder.
- **Copy the caption & hashtags** — puts a ready-made caption on your clipboard for the upload form.

The file is also saved automatically inside the `shorts-studio\out` folder, named with the date and time.

At the bottom, **New question, same style** starts a fresh video keeping all your look settings — this is how you make a batch quickly.

---

### Step 7 — Title, tags and description

Everything the upload form asks for, written from the video you just made.

Type your channel or site once — it is remembered — then press **Write the metadata**. You get:

- **Five title options** with live character counts, so you can pick the angle you want. One plain
  and searchable, one question-shaped, one challenge-shaped, one naming the exam, one naming the
  concept.
- **A description** whose first line carries the topic and the exam, since that is the line that
  shows in search results.
- **Tags**, capped at YouTube's real limit — the site counts the whole comma-separated string, not
  the number of tags, so the list is trimmed to fit rather than rejected at upload.
- **Hashtags**, **thumbnail text** and a **pinned comment**.

Every field has a one-click **Copy**. Edit the question afterwards and the whole pack is marked out
of date, so you never paste a title describing a video you changed.

---

## 6. What it costs

| Service | Free allowance | What one video uses |
|---|---|---|
| **Gemini** | A generous free tier | One request. Realistically free. |
| **ElevenLabs** | 10,000 characters/month on the free plan | A short uses 500–900 characters, so **10–20 a month free**. A five-minute explainer uses about 4,400 — **two a month**. |
| **DeepSeek** (optional) | Pay as you go, no free tier | A fraction of a cent per check. |
| **Pexels / NASA** (optional) | Free | Nothing. Photos are downloaded to your own computer. |
| **Rendering** | Free | Runs on your own computer. Costs electricity. |

Changing the look, re-rendering, or editing on-screen text costs **nothing**. Only pressing *Generate the question* and *Make the voiceover* spends anything.

To stretch your ElevenLabs credits: lower the target length in step 2, and use the *Flash* voice model.

---

## 7. When something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| Red box: *"The helper server is not running"* | The PowerShell window was closed. | Reopen PowerShell, `cd` into the folder, run `npm start`, reload the page. |
| *"That Gemini API key was rejected"* | Bad key, usually a stray space. | Re-copy the key from Google AI Studio and paste it again. |
| *"That ElevenLabs API key was rejected"* | Same, for ElevenLabs. | Re-copy from the API Keys page. |
| *"Your ElevenLabs character quota is used up"* | Out of voice credits for the month. | Wait for the reset, shorten the video, or upgrade the plan. |
| *"That DeepSeek API key was rejected"* | Bad key. | Re-copy it from platform.deepseek.com. |
| *"Your DeepSeek account has no credit left"* | DeepSeek has no free tier. | Top up, or clear the key to turn the check off. |
| *"Gemini rate limit hit"* | You generated too fast. | Wait about a minute, press Generate again. |
| *"Gemini refused this topic"* | A safety filter blocked it. | Change the topic wording. |
| No voices in the dropdown | Your ElevenLabs account has no voices saved. | Add one from the Voice Library, reload the page. |
| Render sits at 0% for ages on the first go | It is downloading the rendering browser. | Wait. It only happens once. Do not close the tab. |
| *"The output file is locked"* | A video player still has the last render open. | Close the player, render again. |
| *"running scripts is disabled on this system"* | Windows blocks npm's PowerShell launcher by default. | Use `npm.cmd install` / `npm.cmd start`, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. |
| The browser never opens | Something else is on the same port. | Look in PowerShell for the `Local:` line and click that address. |
| A spoken line sounds clipped at the end | Trailing silence was trimmed too aggressively. | Step 5 → turn off **Trim trailing silence**, then render again. |
| A diagram shows wrong numbers | Gemini invented them. | Step 3 → fix or shorten that scene, or turn off **Draw the diagrams** in step 5. |
| Text is cut off on screen | The on-screen headline is too long. | Go to step 3 and shorten that scene's 📺 box. |
| Everything is broken and confusing | — | Step 6 → **Reset everything**, then start from step 1. |

---

## 8. Where things are saved

Inside `shorts-studio`:

- `out\` — your finished videos. **This is the folder you want.** Nothing here is ever deleted automatically.
- `public\generated\` — the voiceover clips. Cleaned up automatically after a day.
- Your keys and settings — stored in your browser, not in a file.

---

## 9. Questions people ask

**Can I use my own voice?**
Yes. Clone your voice on the ElevenLabs website; it then appears in the step-4 dropdown automatically.

**Can I make it longer than 90 seconds?**
The slider stops at 90 because Shorts and Reels cap out around there. The tool itself has no limit — a longer script just makes a longer video.

**Can I change the fonts and colours?**
Yes. Open `src\lib\theme.ts` in Notepad. Everything visual lives in that one file, with comments. Save it and the preview updates instantly.

**Does it work offline?**
No. Gemini, ElevenLabs and the one-time renderer download all need the internet. Once everything is downloaded, re-rendering an existing video works offline.

**Is my data going anywhere?**
Your topic settings go to Google. Your script goes to ElevenLabs. Nothing else leaves your computer. The helper server only listens on `127.0.0.1`, which means nothing else on your network can reach it.

**Can I sell the videos I make?**
Check each service's terms yourself — Google's, ElevenLabs', and Remotion's. Note in particular that **Remotion is free for individuals and small teams but requires a paid company licence for larger companies**. See <https://remotion.dev/license>.

**Something is still wrong.**
Look at the PowerShell window. The last few red lines usually say plainly what failed.

---

## 10. A short checklist for good videos

- Curiosity factor **8 or 9**. Boring questions do not get watched.
- Target length **40–50 seconds**.
- **Read the question in step 3 and verify the answer.**
- Run the DeepSeek check. A disagreement between two models is the cheapest bug report you will get.
- Keep on-screen headlines under 12 words.
- Karaoke subtitles **on** — most viewers are on mute.
- **Flashy** layout for reach, **Nerdy** or **Elegant** for a subject-specialist audience.
- Thinking time of 3–5 seconds. Too long and people scroll away.
