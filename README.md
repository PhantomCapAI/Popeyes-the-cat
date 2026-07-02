# POPEYES

A client-side meme PFP generator for the Popeyes cat on Solana.

## What it does

Upload a photo (or use the built-in Popeyes cat), drop on stickers — laser eyes,
crowns, gold chains, SOL coins, and more — add a caption, and download a
high-res PNG. Every sticker can be dragged, pinch-scaled, and rotated, with
layer ordering and swappable backgrounds.

It is **100% client-side**. There is no backend and no upload step — your photo
is loaded and composited entirely in the browser and never leaves the device.

- **Live:** https://popeyes-the-cat.vercel.app
- **Token CA:** `swA5DdNU2HC9Uab2SEeJ3etuDRz8LvVDPWCgRc3pump`

## Tech stack

- Vanilla **HTML / CSS / JavaScript** — no framework.
- **HTML5 Canvas** for compositing and export. Every signature sticker is drawn
  procedurally on the canvas, so the output stays crisp and exports cleanly at
  2048px.
- **No build step** and no runtime dependencies.

## Project structure

```
.
├── index.html      # Markup: header, contract-address bar, canvas stage,
│                   #   sticker tray, and control buttons.
├── style.css       # Styling: gold theme, mobile-first layout, tray, CA bar.
├── app.js          # All logic: canvas engine, image loading, procedural
│                   #   sticker rendering, drag/pinch/rotate gestures, layer
│                   #   ordering, backgrounds, PNG export, tap-to-copy CA.
├── assets/
│   └── preset-cat-1.jpg  # The built-in Popeyes cat preset image.
├── vercel.json     # Zero-config static hosting settings for Vercel.
└── README.md
```

## Run locally

The app must be served over **HTTP**, not opened via `file://`. Browsers treat
`file://` pages as an opaque origin and block loading the bundled preset image,
so the Popeyes preset will not render. Any static file server works:

```bash
# Python 3
python3 -m http.server 8000
# then open http://localhost:8000

# or Node
npx serve
```

## Deploy

It is a static site — no build command required.

1. Connect the repository to **Vercel** (or any static host: Netlify, GitHub
   Pages, Cloudflare Pages, S3, etc.).
2. On Vercel, use framework preset **Other**, leave the build command empty, and
   serve the repository root. `vercel.json` already encodes this.
3. Deploy. Pushes to `main` redeploy automatically.
