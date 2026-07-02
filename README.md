# POPEYES-IFY 😼👑

A meme generator — the church of the holiest cat on SOL. Upload a photo (or use
the holy cat preset), drop glossy pop-eyes, a gold neon crown, an amber holy
glow, paws, sparkles, and a scroll ribbon on it, then download a high-res PNG.

**Pure static site.** Vanilla HTML + CSS + JavaScript with a single `<canvas>`.
No framework, no build step, no dependencies. Every overlay is drawn
procedurally on the canvas, so the export is crisp at any resolution.

---

## Files

```
Popeyes-the-cat/
├── index.html              # markup: logo, canvas stage, controls
├── style.css               # premium "shrine" styling, mobile-first
├── app.js                  # canvas engine: image load, overlays, gestures, PNG export
├── vercel.json             # zero-config static serving on Vercel
├── assets/
│   ├── preset-cat-1.jpg    # the holy cat preset image
│   └── README.md           # notes on assets
└── README.md               # this file
```

## Features

- Upload or drag-drop a photo, or tap **use the holy cat** for the preset.
- Overlays are draggable, pinch-to-scale, and twist-to-rotate (desktop: drag +
  scroll to scale, alt/shift+scroll to rotate).
- Overlays: glossy black pop-eyes ×2, gold neon crown, amber radial glow, paw
  prints, sparkles, and a bottom scroll ribbon with a gospel toggle
  (`ALL HAIL POPEYES` ↔ `THE HOLIEST CAT ON SOL`).
- The cat preset is treated as **already blessed**: it gets crown + ribbon only
  (no pop-eyes, no extra glow). Uploaded photos get the full rig.
- **Download PNG** exports the full composite at 2048px (with a Safari fallback).

---

## Deploy to Vercel (free tier) — from a phone browser

The GitHub repo `PhantomCapAI/Popeyes-the-cat` is the source of truth. Vercel
watches `main` and redeploys on every push.

1. Go to **vercel.com** and sign in with GitHub.
2. Tap **Add New… → Project**.
3. Under **Import Git Repository**, pick **PhantomCapAI/Popeyes-the-cat**.
   (If it's not listed, tap **Adjust GitHub App Permissions** and grant Vercel
   access to this repo.)
4. On the configure screen:
   - **Framework Preset:** `Other`
   - **Root Directory:** `.` (leave as the repo root)
   - **Build Command:** leave empty / off (there is no build)
   - **Output Directory:** leave as the repo root (`.`)
   - **Install Command:** leave empty / off
   These are already encoded in `vercel.json`, so the defaults should be correct.
5. Tap **Deploy**. In ~20 seconds you get a live URL like
   `https://popeyes-the-cat.vercel.app`.

Every future `git push` to `main` auto-deploys. Pull requests get their own
preview URLs.

---

## Run / deploy it yourself (developers)

It's static — no toolchain required.

**Local preview** (any static file server works):

```bash
# option A: Python (no install)
python3 -m http.server 8000
# then open http://localhost:8000

# option B: Node
npx serve .

# option C: Vercel CLI (mirrors production)
npm i -g vercel
vercel dev
```

Because everything runs client-side, opening `index.html` directly via
`file://` mostly works too — except the cat preset, which the browser blocks
over `file://` (CORS). Serve over `http://` (any option above) to load it.

**Deploy from the CLI:**

```bash
npm i -g vercel
vercel          # first run links the project + creates a preview
vercel --prod   # promote to production
```

## Configuration notes

`vercel.json` disables the build and serves the repo root as static files:

- `buildCommand` / `installCommand`: `null` — nothing to build.
- `outputDirectory`: `.` — serve files straight from the repo root.
- `cleanUrls`: `true` — `/index.html` is reachable at `/`.
- `assets/*` gets a 1-day `Cache-Control` header.

No environment variables or secrets are needed.
