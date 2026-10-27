# Yum Yum Num

A small, mobile-first 3D counting game for children aged 3–4, built with Three.js, TypeScript and Vite.
A friendly animal asks for 1, 2 or 3 of its favourite food. The child taps each object, it hops into the
basket, and the game counts aloud. When the target is reached, the animal celebrates and eats its snack,
then the next animal comes along. There are no timers, lives, scores or failure screens.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN; open it on a phone)
```

Useful URL parameters:

| Parameter  | Effect                                                                  |
| ---------- | ----------------------------------------------------------------------- |
| `?seed=42` | Reproducible challenge sequence (the seed is logged to the console)      |
| `?level=2` | Start at level 1, 2 or 3                                                |
| `?test`    | Exposes `window.__yum` for automated tests                           |

## Build and deploy

```bash
npm run build        # type-checks, then writes a static site to dist/
npm run preview      # serve dist/ locally
```

`dist/` is plain static files with relative paths (`base: "./"`), so it can be uploaded to any static host
or sub-folder, for example GitHub Pages, Netlify, Vercel, Cloudflare Pages or S3. No backend is needed.
Serve it over HTTPS so mobile browsers allow audio.

### GitHub Pages

`.github/workflows/deploy.yml` tests, builds and publishes the game on every push to `main`
(or manually from the Actions tab). One-time setup: **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The game is then live at https://aodihis.github.io/yum-yum-num/.

## Tests

```bash
npm test             # unit tests (Vitest): challenge generation and counting state machine
npm run build && npm run test:e2e   # headless Chromium, phone emulation, real touch events
```

The end-to-end script needs Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`
if it is not already available). It writes screenshots to `e2e-screens/`.

## How it works

```
src/
├── main.ts                 wiring, URL params
├── game/
│   ├── Game.ts             connects rules, scene, HUD and audio; challenge flow
│   ├── GameState.ts        READY → INSTRUCTION → COUNTING → CELEBRATING state machine
│   ├── ChallengeManager.ts seeded challenge generation, layouts, level progression
│   ├── InputManager.ts     pointerdown → raycast
│   ├── AudioManager.ts     voice clips / speech synthesis, synthesized sound effects
│   ├── tween.ts, random.ts, types.ts
├── scene/                  procedural low-poly models, camera framing, effects
└── ui/                     HTML/CSS overlay (HUD.ts, styles.css)
```

- **Counting rules**: `GameState.collect()` is the only place a count can change. It ignores taps outside
  `COUNTING`, never counts an object twice, and switches to `CELEBRATING` on the exact tap that reaches the
  target, so extra taps can't count. Every async sequence in `Game` stops as soon as a newer challenge starts.
- **Help without penalties**: tapping the basket (or waiting 14 s) plays "Let's count together!", recounts
  what's in the basket and wiggles the next object. Tapping the animal replays the question. Undo
  (curved arrow) sends the last object back.
- **Progression**: level 1 lines up 1–2 extra objects with wide gaps. Level 2 scatters up to 5 objects.
  Level 3 also shows a "3 = 🍌🍌🍌" card on completion. The level goes up only after 3 challenges in a row
  finished without help or undo, never just because more challenges were played, and it never goes down.
  Targets come from a shuffled bag, so 1, 2 and 3 each appear in every group of three challenges.
- **Visual cues for muted play**: big numeral with food icons at the top, a numeral popping up from each
  tapped object, numbered progress slots at the bottom.

## Voice recordings

The game uses recorded clips when they exist and falls back to the browser's speech synthesis.
To add recordings, put MP3 files in `public/audio/` and list them in `public/audio/manifest.json`:

```json
{ "clips": ["count_1", "count_2", "count_3", "together", "great_job", "ask_banana_3"] }
```

(or `{ "clips": { "count_1": "one.mp3" } }` to name files yourself). Lines and their script:

| Key                          | Text                                 |
| ---------------------------- | ------------------------------------ |
| `ask_<item>_<n>`             | "Can you give me three bananas?" (item = banana, carrot, apple; n = 1–3) |
| `count_1`, `count_2`, `count_3` | "One!", "Two!", "Three!"          |
| `together`                   | "Let's count together!"              |
| `great_job`                  | "Great job!"                         |
