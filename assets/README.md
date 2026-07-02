# /assets

Overlays (pop-eyes, crown, glow, paws, sparkles, ribbon) are drawn **procedurally
on the canvas** in `app.js` — there are no overlay image files to manage.

## The one asset you add

**`assets/preset-cat-1.jpg`** — the holy cat preset photo.

- Referenced by exact path in `app.js` (`PRESET_SRC = "assets/preset-cat-1.jpg"`).
- Drop the JPG here with that exact filename and the **use the holy cat** button
  will render it instantly.
- Until it exists, the button shows a toast reminding you to add it (nothing breaks).

When the preset is selected it's treated as **already blessed**: only the crown +
ribbon are placed — no pop-eyes, no extra glow.
