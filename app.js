/* POPEYES-IFY — static scaffold, Block 1
 * Vanilla canvas meme shrine. One export canvas, procedural overlays,
 * draggable + pinch-scale + rotate, high-res PNG export.
 */
(() => {
  "use strict";

  const PRESET_SRC = "assets/preset-cat-1.jpg"; // <-- exact path for the holy cat
  const RIBBON_TEXTS = ["POPEYES", "THE CAT ON SOLANA"];

  // ---- overlay type defaults (base = size as fraction of stage width) ----
  const TYPE = {
    glow:    { base: 1.15, hw: 1.0,  hh: 1.0,  blend: "screen" },
    eye:     { base: 0.09, hw: 1.0,  hh: 1.0 },
    crown:   { base: 0.44, hw: 1.02, hh: 0.66 },
    paw:     { base: 0.11, hw: 0.78, hh: 0.92 },
    sparkle: { base: 0.055, hw: 1.0, hh: 1.0 },
    ribbon:  { base: 0.47, hw: 1.14, hh: 0.46 },
  };

  const state = {
    img: null,
    mode: "upload", // 'upload' | 'preset'
    overlays: [],
    selected: null,
    ribbon: 0,
    background: null,
    shape: "square", // 'square' | 'circle'
    view: { x: 0, y: 0, scale: 1 }, // pan/zoom of the base photo inside the frame
    exportSize: 2048, // 400 | 800 | 2048
  };

  let uid = 1;

  // ---------------------------------------------------------------- DOM
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");
  const fileInput = document.getElementById("file");
  const dropZone = document.getElementById("drop");
  const toastEl = document.getElementById("toast");

  let LW = 0, LH = 0, dpr = 1;

  // ---------------------------------------------------------------- helpers
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function makeOverlay(type, x, y, extra) {
    const t = TYPE[type] || {};
    const m = META[type] || {};
    return Object.assign(
      { id: uid++, type, x, y, scale: 1, rot: 0,
        base: t.base == null ? 0.16 : t.base, hw: t.hw || 0.8, hh: t.hh || 0.8,
        blend: t.blend || "source-over", char: m.char, text: m.text, alpha: 1 },
      extra || {}
    );
  }

  // ---------------------------------------------------------------- sticker kit
  function lg(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    for (const [o, col] of stops) g.addColorStop(o, col);
    return g;
  }
  function gGold(c, s) {
    return lg(c, 0, -s, 0, s, [
      [0, "#fff3b0"], [0.4, "#ffd54a"], [0.72, "#e6a100"], [1, "#8a5a00"],
    ]);
  }
  function glow(c, col, blur) { c.shadowColor = col; c.shadowBlur = blur; }
  function noglow(c) { c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }
  function drape(c, s, lw, col) {
    c.strokeStyle = col; c.lineWidth = lw; c.lineCap = "round";
    c.beginPath(); c.moveTo(-1 * s, -0.35 * s);
    c.quadraticCurveTo(0, 0.82 * s, 1 * s, -0.35 * s); c.stroke();
  }
  function laser(c, s, rgb) {
    c.save();
    glow(c, `rgba(${rgb},0.95)`, 0.6 * s);
    const g = c.createLinearGradient(0, 0, 3.2 * s, 0);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, -0.17 * s); c.lineTo(3.3 * s, -0.03 * s);
    c.lineTo(3.3 * s, 0.03 * s); c.lineTo(0, 0.17 * s); c.closePath(); c.fill();
    c.fillStyle = `rgba(${rgb},1)`; c.beginPath(); c.arc(0, 0, 0.34 * s, 0, 7); c.fill();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(0, 0, 0.13 * s, 0, 7); c.fill();
    c.restore();
  }
  function drawImageContain(c, img, W, H, f) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.min(W / iw, H / ih) * f;
    const dw = iw * scale, dh = ih * scale;
    c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  Object.assign(TYPE, {
    halo: { base: 0.4, hw: 1.05, hh: 0.55, blend: "screen" },
    chefHat: { base: 0.36, hw: 0.8, hh: 0.85 },
    cowboyHat: { base: 0.42, hw: 1.05, hh: 0.62 },
    partyHat: { base: 0.3, hw: 0.62, hh: 1.05 },
    beanie: { base: 0.2, hw: 0.7, hh: 0.7 },
    durag: { base: 0.44, hw: 1.15, hh: 0.72 },
    topHat: { base: 0.2, hw: 0.7, hh: 0.7 },
    headphones: { base: 0.22, hw: 0.7, hh: 0.7 },
    horns: { base: 0.36, hw: 1.0, hh: 0.9 },
    laserRed: { base: 0.13, hw: 0.55, hh: 0.5 },
    laserGold: { base: 0.13, hw: 0.55, hh: 0.5 },
    shades: { base: 0.46, hw: 1.05, hh: 0.38 },
    glasses3d: { base: 0.46, hw: 1.05, hh: 0.38 },
    dollarEyes: { base: 0.3, hw: 1.0, hh: 0.5 },
    googly: { base: 0.3, hw: 1.0, hh: 0.5 },
    hypno: { base: 0.24, hw: 1.0, hh: 1.0 },
    tearyEyes: { base: 0.3, hw: 1.0, hh: 0.62 },
    monocle: { base: 0.24, hw: 0.6, hh: 1.0 },
    cigar: { base: 0.3, hw: 1.0, hh: 0.32 },
    blunt: { base: 0.3, hw: 1.0, hh: 0.5 },
    grillz: { base: 0.3, hw: 1.0, hh: 0.42 },
    mustache: { base: 0.34, hw: 1.0, hh: 0.32 },
    fangs: { base: 0.28, hw: 0.6, hh: 0.5 },
    goldChain: { base: 0.5, hw: 1.1, hh: 0.72 },
    solChain: { base: 0.5, hw: 1.1, hh: 1.25 },
    bandana: { base: 0.44, hw: 1.25, hh: 0.4 },
    bowtie: { base: 0.26, hw: 0.82, hh: 0.46 },
    cape: { base: 0.5, hw: 1.0, hh: 0.9 },
    solCoin: { base: 0.2, hw: 0.95, hh: 0.95 },
    moneyStack: { base: 0.24, hw: 0.9, hh: 0.58 },
    diamondHands: { base: 0.34, hw: 0.9, hh: 0.85 },
    rocket: { base: 0.28, hw: 0.6, hh: 1.1 },
    pumpArrow: { base: 0.24, hw: 0.66, hh: 1.0 },
    drumstick: { base: 0.18, hw: 0.7, hh: 0.7 },
    mic: { base: 0.18, hw: 0.7, hh: 0.7 },
    moneyBag: { base: 0.18, hw: 0.7, hh: 0.7 },
    fire: { base: 0.22, hw: 0.6, hh: 1.0 },
    moneyRain: { base: 0.16, hw: 0.7, hh: 0.7 },
    star: { base: 0.14, hw: 0.7, hh: 0.7 },
    bolt: { base: 0.2, hw: 0.5, hh: 1.0 },
    lightRays: { base: 0.72, hw: 1.0, hh: 1.0, blend: "screen" },
    confetti: { base: 0.16, hw: 0.7, hh: 0.7 },
    glowRing: { base: 0.5, hw: 1.0, hh: 1.0, blend: "screen" },
    tPopeyes: { base: 0.34, hw: 1.7, hh: 0.45 },
    tSol: { base: 0.3, hw: 0.9, hh: 0.45 },
    tGm: { base: 0.3, hw: 0.8, hh: 0.45 },
    tWagmi: { base: 0.32, hw: 1.15, hh: 0.45 },
    tAllHail: { base: 0.34, hw: 1.55, hh: 0.45 },
    speech: { base: 0.4, hw: 1.05, hh: 0.85 },
  });

  const META = {
    eye: { label: "pop eye" }, crown: { label: "crown" }, sparkle: { label: "sparkle" },
    paw: { label: "paw" }, ribbon: { label: "ribbon" },
    halo: { label: "halo" }, chefHat: { label: "chef hat" }, cowboyHat: { label: "cowboy" },
    partyHat: { label: "party hat" }, beanie: { label: "cap", char: "🧢" }, durag: { label: "durag" },
    topHat: { label: "top hat", char: "🎩" }, headphones: { label: "phones", char: "🎧" }, horns: { label: "horns" },
    laserRed: { label: "laser red" }, laserGold: { label: "laser gold" }, shades: { label: "shades" },
    glasses3d: { label: "3D glasses" }, dollarEyes: { label: "$ eyes" }, googly: { label: "googly" },
    hypno: { label: "hypno" }, tearyEyes: { label: "teary" }, monocle: { label: "monocle" },
    cigar: { label: "cigar" }, blunt: { label: "blunt" }, grillz: { label: "grillz" },
    mustache: { label: "'stache" }, fangs: { label: "fangs" },
    goldChain: { label: "gold chain" }, solChain: { label: "SOL chain" }, bandana: { label: "bandana" },
    bowtie: { label: "bowtie" }, cape: { label: "cape" },
    solCoin: { label: "SOL coin" }, moneyStack: { label: "cash" }, diamondHands: { label: "diamond hands" },
    rocket: { label: "rocket" }, pumpArrow: { label: "pump" }, drumstick: { label: "drumstick", char: "🍗" },
    mic: { label: "mic", char: "🎤" }, moneyBag: { label: "bag", char: "💰" },
    fire: { label: "fire" }, moneyRain: { label: "money", char: "💸" }, star: { label: "star", char: "⭐" },
    bolt: { label: "lightning" }, lightRays: { label: "light rays" }, confetti: { label: "confetti", char: "🎉" },
    glowRing: { label: "glow ring" },
    tPopeyes: { label: "$POPEYES", text: "$POPEYES" }, tSol: { label: "SOL", text: "SOL" },
    tGm: { label: "gm", text: "gm" }, tWagmi: { label: "wagmi", text: "wagmi" },
    tAllHail: { label: "ALL HAIL", text: "ALL HAIL" }, speech: { label: "gm bubble" },
    bgGold: { label: "gold", bg: true }, bgStars: { label: "starfield", bg: true },
    bgRays: { label: "cathedral", bg: true }, bgPump: { label: "pump green", bg: true },
    bgSolana: { label: "solana", bg: true },
  };

  const LIB = {
    HEADWEAR: ["halo", "crown", "chefHat", "cowboyHat", "partyHat", "beanie", "durag", "topHat", "headphones", "horns"],
    EYES: ["laserRed", "laserGold", "eye", "shades", "glasses3d", "dollarEyes", "googly", "hypno", "tearyEyes", "monocle"],
    MOUTH: ["cigar", "blunt", "grillz", "mustache", "fangs"],
    WEAR: ["goldChain", "solChain", "bandana", "bowtie", "cape"],
    PROPS: ["solCoin", "moneyStack", "diamondHands", "rocket", "pumpArrow", "drumstick", "mic", "moneyBag"],
    EFFECTS: ["sparkle", "fire", "moneyRain", "star", "bolt", "lightRays", "confetti", "glowRing"],
    TEXT: ["ribbon", "tPopeyes", "tSol", "tGm", "tWagmi", "tAllHail", "speech"],
    BG: ["bgGold", "bgStars", "bgRays", "bgPump", "bgSolana"],
  };

  const BG = {
    bgGold(c, W, H) {
      const g = c.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.55, Math.max(W, H) * 0.8);
      g.addColorStop(0, "#6a4512"); g.addColorStop(0.5, "#3a2408"); g.addColorStop(1, "#160d03");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    },
    bgStars(c, W, H) {
      c.fillStyle = "#05060f"; c.fillRect(0, 0, W, H);
      const u = Math.max(W, H) / 900;
      for (let i = 1; i <= 140; i++) {
        const x = (((i * 73) % 100) / 100) * W, y = (((i * i * 37) % 100) / 100) * H;
        const r = (((i * 13) % 3) + 1) * 0.6 * u;
        c.globalAlpha = (((i * 17) % 100) / 100) * 0.7 + 0.3;
        c.fillStyle = i % 6 ? "#ffffff" : "#9fe8ff";
        c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
    },
    bgRays(c, W, H) {
      c.fillStyle = "#140f08"; c.fillRect(0, 0, W, H);
      c.save(); c.translate(W / 2, -H * 0.12);
      const n = 11;
      for (let i = 0; i < n; i++) {
        c.save(); c.rotate(-0.62 + (i / (n - 1)) * 1.24);
        const g = c.createLinearGradient(0, 0, 0, H * 1.25);
        g.addColorStop(0, "rgba(255,220,140,0.28)"); g.addColorStop(1, "rgba(255,220,140,0)");
        c.fillStyle = g; c.fillRect(-0.028 * W, 0, 0.056 * W, H * 1.25); c.restore();
      }
      c.restore();
    },
    bgPump(c, W, H) {
      const g = c.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, "#04180c"); g.addColorStop(1, "#0f8a42");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    },
    bgSolana(c, W, H) {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#9945FF"); g.addColorStop(0.5, "#7b46d6"); g.addColorStop(1, "#14F195");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    },
  };

  function drawEmoji(c, s, o) {
    c.save();
    c.font = `${1.7 * s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle";
    glow(c, "rgba(255,190,70,0.6)", 0.5 * s); c.fillText(o.char || "❓", 0, 0);
    c.shadowBlur = 0.18 * s; c.fillText(o.char || "❓", 0, 0);
    c.restore();
  }
  function drawTextBadge(c, s, o) {
    const text = o.text || "$POPEYES";
    c.save();
    c.font = `900 ${0.5 * s}px "Arial Black", Impact, sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle";
    const w = c.measureText(text).width + 0.5 * s, h = 0.78 * s;
    glow(c, "rgba(255,190,70,0.5)", 0.22 * s);
    c.fillStyle = lg(c, 0, -h / 2, 0, h / 2, [[0, "#241708"], [1, "#0a0705"]]);
    roundRect(c, -w / 2, -h / 2, w, h, 0.18 * s); c.fill();
    noglow(c);
    c.lineWidth = 0.03 * s; c.strokeStyle = "#e6a100";
    roundRect(c, -w / 2, -h / 2, w, h, 0.18 * s); c.stroke();
    c.fillStyle = gGold(c, 0.3 * s); c.fillText(text, 0, 0.02 * s);
    c.restore();
  }

  // ---------------------------------------------------------------- rigs
  function buildRig(mode) {
    const o = [];
    if (mode === "preset") {
      // Stock preset = just the plain jpeg. Pop-eyes are opt-in via the 👀
      // button (addEyes() places them dead-center on the cat's eyes).
    } else {
      // Full human rig.
      o.push(makeOverlay("glow", 0.5, 0.44));
      o.push(makeOverlay("paw", 0.19, 0.76, { rot: -0.3 }));
      o.push(makeOverlay("paw", 0.82, 0.72, { rot: 0.35 }));
      o.push(makeOverlay("eye", 0.4, 0.44));
      o.push(makeOverlay("eye", 0.6, 0.44));
      o.push(makeOverlay("crown", 0.5, 0.17));
      o.push(makeOverlay("sparkle", 0.16, 0.26, { rot: 0.3 }));
      o.push(makeOverlay("sparkle", 0.85, 0.3, { rot: -0.2 }));
      o.push(makeOverlay("sparkle", 0.72, 0.6, { scale: 0.8 }));
      o.push(makeOverlay("sparkle", 0.3, 0.63, { scale: 0.7, rot: 0.5 }));
      o.push(makeOverlay("ribbon", 0.5, 0.9));
    }
    state.overlays = o;
    state.selected = null;
  }

  // ---------------------------------------------------------------- drawing
  const DRAW = {
    glow(c, s) {
      const r = s;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, "rgba(255,200,110,0.55)");
      g.addColorStop(0.4, "rgba(255,150,40,0.30)");
      g.addColorStop(1, "rgba(255,120,0,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, r, 0, 7);
      c.fill();
    },

    eye(c, s) {
      const r = 0.9 * s;
      const g = c.createRadialGradient(-0.32 * r, -0.32 * r, 0.08 * r, 0, 0, r);
      g.addColorStop(0, "#4a4a4a");
      g.addColorStop(0.42, "#141414");
      g.addColorStop(1, "#000");
      c.save();
      c.shadowColor = "rgba(0,0,0,0.6)";
      c.shadowBlur = 0.25 * s;
      c.shadowOffsetY = 0.06 * s;
      c.beginPath();
      c.arc(0, 0, r, 0, 7);
      c.fillStyle = g;
      c.fill();
      c.restore();
      c.lineWidth = 0.045 * s;
      c.strokeStyle = "rgba(255,255,255,0.08)";
      c.beginPath();
      c.arc(0, 0, r, 0, 7);
      c.stroke();
      // big glossy highlight
      c.beginPath();
      c.ellipse(-0.32 * r, -0.36 * r, 0.3 * r, 0.2 * r, -0.5, 0, 7);
      c.fillStyle = "rgba(255,255,255,0.92)";
      c.fill();
      // small catch-light
      c.beginPath();
      c.arc(0.26 * r, 0.3 * r, 0.09 * r, 0, 7);
      c.fillStyle = "rgba(255,255,255,0.5)";
      c.fill();
    },

    crown(c, s) {
      const grad = c.createLinearGradient(0, -0.7 * s, 0, 0.6 * s);
      grad.addColorStop(0, "#fff3b0");
      grad.addColorStop(0.4, "#ffd54a");
      grad.addColorStop(0.75, "#e6a100");
      grad.addColorStop(1, "#8a5a00");
      const pts = [
        [-1, 0.5], [-1, -0.1], [-0.6, 0.16], [-0.33, -0.55],
        [0, 0.05], [0.33, -0.55], [0.6, 0.16], [1, -0.1], [1, 0.5],
      ];
      c.save();
      c.beginPath();
      c.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * s, pts[i][1] * s);
      c.closePath();
      c.shadowColor = "rgba(255,200,60,0.9)";
      c.shadowBlur = 0.5 * s;
      c.fillStyle = grad;
      c.fill();
      c.shadowBlur = 0.18 * s;
      c.fill();
      c.restore();
      c.lineWidth = 0.03 * s;
      c.strokeStyle = "#7a4d00";
      c.beginPath();
      c.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * s, pts[i][1] * s);
      c.closePath();
      c.stroke();
      // base band
      c.fillStyle = "#e6a100";
      c.fillRect(-1 * s, 0.26 * s, 2 * s, 0.24 * s);
      c.strokeRect(-1 * s, 0.26 * s, 2 * s, 0.24 * s);
      // jewels
      const jew = [["#ff4d6d", -0.6], ["#4de1ff", 0], ["#7cff9b", 0.6]];
      c.save();
      for (const [col, jx] of jew) {
        c.beginPath();
        c.arc(jx * s, 0.38 * s, 0.09 * s, 0, 7);
        c.shadowColor = col;
        c.shadowBlur = 0.2 * s;
        c.fillStyle = col;
        c.fill();
      }
      // point tips
      for (const tx of [-0.33, 0, 0.33]) {
        const ty = tx === 0 ? 0.05 : -0.55;
        c.beginPath();
        c.arc(tx * s, ty * s, 0.085 * s, 0, 7);
        c.shadowColor = "#fff3b0";
        c.shadowBlur = 0.18 * s;
        c.fillStyle = "#fff8d0";
        c.fill();
      }
      c.restore();
    },

    paw(c, s) {
      c.save();
      c.shadowColor = "rgba(255,190,80,0.7)";
      c.shadowBlur = 0.22 * s;
      const g = c.createLinearGradient(0, -1 * s, 0, 1 * s);
      g.addColorStop(0, "#ffe08a");
      g.addColorStop(1, "#c9860f");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0.35 * s, 0.55 * s, 0.46 * s, 0, 0, 7);
      c.fill();
      const toes = [
        [-0.46, -0.32, 0.21], [-0.16, -0.6, 0.23],
        [0.16, -0.6, 0.23], [0.46, -0.32, 0.21],
      ];
      for (const [tx, ty, tr] of toes) {
        c.beginPath();
        c.arc(tx * s, ty * s, tr * s, 0, 7);
        c.fill();
      }
      c.restore();
    },

    sparkle(c, s) {
      c.save();
      const g = c.createRadialGradient(0, 0, 0, 0, 0, s);
      g.addColorStop(0, "#fffef0");
      g.addColorStop(0.5, "#ffdd77");
      g.addColorStop(1, "rgba(255,200,80,0)");
      c.fillStyle = g;
      c.shadowColor = "#ffd257";
      c.shadowBlur = 0.5 * s;
      c.beginPath();
      c.moveTo(0, -1 * s);
      c.quadraticCurveTo(0.13 * s, -0.13 * s, 1 * s, 0);
      c.quadraticCurveTo(0.13 * s, 0.13 * s, 0, 1 * s);
      c.quadraticCurveTo(-0.13 * s, 0.13 * s, -1 * s, 0);
      c.quadraticCurveTo(-0.13 * s, -0.13 * s, 0, -1 * s);
      c.fill();
      c.restore();
    },

    ribbon(c, s) {
      const text = RIBBON_TEXTS[state.ribbon];
      const w = 1.0, h = 0.26;
      c.save();
      // rolled tails (behind, darker)
      c.fillStyle = "#7a4a08";
      for (const dir of [-1, 1]) {
        c.beginPath();
        c.moveTo(dir * 1.16 * s, -0.42 * s);
        c.lineTo(dir * 0.9 * s, -h * s);
        c.lineTo(dir * 0.9 * s, h * s);
        c.lineTo(dir * 1.16 * s, 0.42 * s);
        c.lineTo(dir * 1.04 * s, 0);
        c.closePath();
        c.fill();
      }
      // body
      const bodyG = c.createLinearGradient(0, -h * s, 0, h * s);
      bodyG.addColorStop(0, "#f6d896");
      bodyG.addColorStop(0.5, "#d99a2b");
      bodyG.addColorStop(1, "#a8670c");
      c.shadowColor = "rgba(0,0,0,0.5)";
      c.shadowBlur = 0.14 * s;
      c.shadowOffsetY = 0.05 * s;
      roundRect(c, -w * s, -h * s, 2 * w * s, 2 * h * s, 0.08 * s);
      c.fillStyle = bodyG;
      c.fill();
      c.shadowColor = "transparent";
      c.shadowBlur = 0;
      c.shadowOffsetY = 0;
      // aged inner border
      c.lineWidth = 0.028 * s;
      c.strokeStyle = "rgba(120,70,0,0.85)";
      roundRect(c, -0.93 * w * s, -0.76 * h * s, 1.86 * w * s, 1.52 * h * s, 0.06 * s);
      c.stroke();
      // gospel text, auto-shrink to fit
      c.textAlign = "center";
      c.textBaseline = "middle";
      let fs = 0.3 * s;
      const fit = 1.72 * s;
      c.font = `800 ${fs}px Georgia, "Times New Roman", serif`;
      while (c.measureText(text).width > fit && fs > 0.06 * s) {
        fs *= 0.94;
        c.font = `800 ${fs}px Georgia, "Times New Roman", serif`;
      }
      c.shadowColor = "rgba(255,244,200,0.7)";
      c.shadowBlur = 0.015 * s;
      c.shadowOffsetY = 0.012 * s;
      c.fillStyle = "#452800";
      c.fillText(text, 0, 0.01 * s);
      c.restore();
    },
  };

  Object.assign(DRAW, {
    // emoji + text share renderers
    beanie: drawEmoji, topHat: drawEmoji, headphones: drawEmoji, drumstick: drawEmoji,
    mic: drawEmoji, moneyBag: drawEmoji, moneyRain: drawEmoji, star: drawEmoji, confetti: drawEmoji,
    tPopeyes: drawTextBadge, tSol: drawTextBadge, tGm: drawTextBadge, tWagmi: drawTextBadge, tAllHail: drawTextBadge,

    halo(c, s) {
      c.save(); glow(c, "rgba(255,210,90,0.95)", 0.5 * s);
      c.strokeStyle = lg(c, -s, 0, s, 0, [[0, "#fff3b0"], [0.5, "#ffd54a"], [1, "#e6a100"]]);
      c.lineWidth = 0.16 * s;
      c.beginPath(); c.ellipse(0, 0, 0.95 * s, 0.34 * s, 0, 0, 7); c.stroke();
      c.restore();
    },
    chefHat(c, s) {
      c.save();
      c.fillStyle = "#efefef"; roundRect(c, -0.6 * s, 0.18 * s, 1.2 * s, 0.42 * s, 0.08 * s); c.fill();
      glow(c, "rgba(255,220,140,0.4)", 0.18 * s); c.fillStyle = "#ffffff";
      c.beginPath(); c.arc(-0.45 * s, -0.08 * s, 0.42 * s, 0, 7);
      c.arc(0, -0.36 * s, 0.5 * s, 0, 7); c.arc(0.45 * s, -0.08 * s, 0.42 * s, 0, 7); c.fill();
      noglow(c); c.fillStyle = "rgba(0,0,0,0.06)"; c.fillRect(-0.6 * s, 0.18 * s, 1.2 * s, 0.1 * s);
      c.restore();
    },
    cowboyHat(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.4)", 0.15 * s);
      c.fillStyle = lg(c, 0, -0.6 * s, 0, 0.4 * s, [[0, "#d9a441"], [1, "#7a4d12"]]);
      c.beginPath(); c.ellipse(0, 0.3 * s, 1 * s, 0.28 * s, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(-0.42 * s, 0.32 * s);
      c.quadraticCurveTo(-0.52 * s, -0.5 * s, 0, -0.55 * s);
      c.quadraticCurveTo(0.52 * s, -0.5 * s, 0.42 * s, 0.32 * s); c.closePath(); c.fill();
      noglow(c); c.fillStyle = "#4a2f0c"; c.fillRect(-0.44 * s, 0.12 * s, 0.88 * s, 0.13 * s);
      c.restore();
    },
    partyHat(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.5)", 0.2 * s);
      c.fillStyle = gGold(c, s);
      c.beginPath(); c.moveTo(0, -1 * s); c.lineTo(-0.5 * s, 0.62 * s); c.lineTo(0.5 * s, 0.62 * s); c.closePath(); c.fill();
      noglow(c); c.strokeStyle = "#8a5a00"; c.lineWidth = 0.06 * s;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 0.16 * s, -0.15 * s); c.lineTo(i * 0.3 * s, 0.62 * s); c.stroke(); }
      glow(c, "rgba(255,230,150,0.8)", 0.2 * s); c.fillStyle = "#fff3b0";
      c.beginPath(); c.arc(0, -1 * s, 0.13 * s, 0, 7); c.fill();
      c.restore();
    },
    durag(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.3)", 0.12 * s);
      c.fillStyle = lg(c, 0, -0.6 * s, 0, 0.5 * s, [[0, "#3a3a3a"], [1, "#0e0e0e"]]);
      c.beginPath(); c.ellipse(0, 0.05 * s, 0.92 * s, 0.6 * s, 0, Math.PI, 2 * Math.PI); c.fill();
      c.fillRect(-0.92 * s, 0.03 * s, 1.84 * s, 0.14 * s);
      c.beginPath(); c.moveTo(0.55 * s, 0.08 * s); c.lineTo(1.2 * s, 0.42 * s);
      c.lineTo(1.05 * s, 0.55 * s); c.lineTo(0.45 * s, 0.16 * s); c.closePath(); c.fill();
      noglow(c); c.restore();
    },
    horns(c, s) {
      c.save(); glow(c, "rgba(255,60,60,0.6)", 0.25 * s);
      c.fillStyle = lg(c, 0, -0.8 * s, 0, 0.4 * s, [[0, "#ff6a6a"], [1, "#9e0000"]]);
      for (const d of [-1, 1]) {
        c.beginPath(); c.moveTo(d * 0.5 * s, 0.4 * s);
        c.quadraticCurveTo(d * 0.78 * s, -0.2 * s, d * 0.92 * s, -0.82 * s);
        c.quadraticCurveTo(d * 0.55 * s, -0.3 * s, d * 0.28 * s, 0.36 * s); c.closePath(); c.fill();
      }
      c.restore();
    },
    laserRed(c, s) { laser(c, s, "255,40,40"); },
    laserGold(c, s) { laser(c, s, "255,205,70"); },
    shades(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.4)", 0.15 * s); c.fillStyle = "#0a0a0a";
      roundRect(c, -0.95 * s, -0.26 * s, 0.8 * s, 0.5 * s, 0.08 * s); c.fill();
      roundRect(c, 0.15 * s, -0.26 * s, 0.8 * s, 0.5 * s, 0.08 * s); c.fill();
      c.fillRect(-0.18 * s, -0.14 * s, 0.36 * s, 0.1 * s);
      noglow(c); c.strokeStyle = "#ffd54a"; c.lineWidth = 0.04 * s;
      roundRect(c, -0.95 * s, -0.26 * s, 0.8 * s, 0.5 * s, 0.08 * s); c.stroke();
      roundRect(c, 0.15 * s, -0.26 * s, 0.8 * s, 0.5 * s, 0.08 * s); c.stroke();
      c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = 0.03 * s;
      c.beginPath(); c.moveTo(-0.85 * s, 0.12 * s); c.lineTo(-0.4 * s, -0.16 * s); c.stroke();
      c.restore();
    },
    glasses3d(c, s) {
      c.save(); c.fillStyle = "#111"; roundRect(c, -1 * s, -0.3 * s, 2 * s, 0.6 * s, 0.1 * s); c.fill();
      c.globalAlpha = 0.85; c.fillStyle = "#ff2b4e";
      roundRect(c, -0.9 * s, -0.22 * s, 0.78 * s, 0.44 * s, 0.06 * s); c.fill();
      c.fillStyle = "#22d3ee"; roundRect(c, 0.12 * s, -0.22 * s, 0.78 * s, 0.44 * s, 0.06 * s); c.fill();
      c.restore();
    },
    dollarEyes(c, s) {
      for (const dx of [-0.5, 0.5]) {
        c.save(); glow(c, "rgba(255,190,70,0.4)", 0.12 * s); c.fillStyle = "#fff";
        c.beginPath(); c.arc(dx * s, 0, 0.42 * s, 0, 7); c.fill(); noglow(c);
        c.fillStyle = "#0a7d2c"; c.font = `bold ${0.5 * s}px Georgia, serif`;
        c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", dx * s, 0.02 * s); c.restore();
      }
    },
    googly(c, s) {
      for (const dx of [-0.5, 0.5]) {
        c.fillStyle = "#fff"; c.strokeStyle = "#000"; c.lineWidth = 0.03 * s;
        c.beginPath(); c.arc(dx * s, 0, 0.42 * s, 0, 7); c.fill(); c.stroke();
        c.fillStyle = "#000"; c.beginPath(); c.arc(dx * s + 0.1 * s, 0.1 * s, 0.16 * s, 0, 7); c.fill();
      }
    },
    hypno(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.6)", 0.2 * s);
      c.strokeStyle = gGold(c, s); c.lineWidth = 0.12 * s; c.lineCap = "round";
      c.beginPath();
      for (let a = 0; a < Math.PI * 6; a += 0.15) { const r = (a / (Math.PI * 6)) * s; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.stroke(); c.restore();
    },
    tearyEyes(c, s) {
      for (const dx of [-0.5, 0.5]) {
        c.fillStyle = lg(c, 0, -0.4 * s, 0, 0.4 * s, [[0, "#6bb0ff"], [1, "#123a7a"]]);
        c.beginPath(); c.arc(dx * s, 0, 0.4 * s, 0, 7); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.arc(dx * s - 0.12 * s, -0.12 * s, 0.12 * s, 0, 7); c.fill();
        c.beginPath(); c.arc(dx * s + 0.1 * s, 0.08 * s, 0.06 * s, 0, 7); c.fill();
        c.fillStyle = "rgba(150,210,255,0.9)"; c.beginPath(); c.arc(dx * s, 0.46 * s, 0.09 * s, 0, 7); c.fill();
      }
    },
    monocle(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.6)", 0.2 * s);
      c.strokeStyle = gGold(c, s); c.lineWidth = 0.1 * s;
      c.beginPath(); c.arc(0, 0, 0.5 * s, 0, 7); c.stroke(); noglow(c);
      c.fillStyle = "rgba(255,255,255,0.12)"; c.beginPath(); c.arc(0, 0, 0.45 * s, 0, 7); c.fill();
      c.strokeStyle = "#e6a100"; c.lineWidth = 0.03 * s;
      c.beginPath(); c.moveTo(0.22 * s, 0.45 * s); c.quadraticCurveTo(0.5 * s, 0.95 * s, 0.28 * s, 1.15 * s); c.stroke();
      c.restore();
    },
    cigar(c, s) {
      c.save(); c.fillStyle = lg(c, 0, -0.15 * s, 0, 0.15 * s, [[0, "#6b4423"], [1, "#3a2410"]]);
      roundRect(c, -0.9 * s, -0.15 * s, 1.5 * s, 0.3 * s, 0.06 * s); c.fill();
      glow(c, "rgba(255,120,0,0.9)", 0.2 * s); c.fillStyle = "#ff6a00";
      c.beginPath(); c.arc(0.62 * s, 0, 0.14 * s, 0, 7); c.fill(); noglow(c);
      c.fillStyle = "#ffd54a"; c.fillRect(-0.72 * s, -0.15 * s, 0.13 * s, 0.3 * s); c.restore();
    },
    blunt(c, s) {
      c.save(); c.fillStyle = "#f0ead8"; roundRect(c, -0.9 * s, -0.1 * s, 1.5 * s, 0.2 * s, 0.05 * s); c.fill();
      glow(c, "rgba(255,120,0,0.9)", 0.18 * s); c.fillStyle = "#ff6a00";
      c.beginPath(); c.arc(0.62 * s, 0, 0.11 * s, 0, 7); c.fill(); noglow(c);
      c.strokeStyle = "rgba(220,220,220,0.5)"; c.lineWidth = 0.05 * s;
      c.beginPath(); c.moveTo(0.7 * s, -0.05 * s); c.quadraticCurveTo(1 * s, -0.35 * s, 0.82 * s, -0.7 * s); c.stroke();
      c.restore();
    },
    grillz(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.5)", 0.14 * s); c.fillStyle = gGold(c, s);
      for (let i = -3; i <= 3; i++) { roundRect(c, i * 0.24 * s - 0.1 * s, Math.abs(i) * 0.03 * s, 0.2 * s, 0.3 * s, 0.04 * s); c.fill(); }
      noglow(c); c.strokeStyle = "#8a5a00"; c.lineWidth = 0.02 * s;
      for (let i = -3; i <= 3; i++) { roundRect(c, i * 0.24 * s - 0.1 * s, Math.abs(i) * 0.03 * s, 0.2 * s, 0.3 * s, 0.04 * s); c.stroke(); }
      c.restore();
    },
    mustache(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.3)", 0.1 * s);
      c.fillStyle = lg(c, 0, -0.2 * s, 0, 0.2 * s, [[0, "#5a3a10"], [1, "#241407"]]);
      c.beginPath(); c.moveTo(0, 0.05 * s);
      c.quadraticCurveTo(-0.4 * s, 0.22 * s, -0.9 * s, -0.1 * s);
      c.quadraticCurveTo(-0.6 * s, 0.06 * s, -0.2 * s, 0.1 * s);
      c.quadraticCurveTo(0, 0.15 * s, 0.2 * s, 0.1 * s);
      c.quadraticCurveTo(0.6 * s, 0.06 * s, 0.9 * s, -0.1 * s);
      c.quadraticCurveTo(0.4 * s, 0.22 * s, 0, 0.05 * s); c.fill(); c.restore();
    },
    fangs(c, s) {
      c.save(); glow(c, "rgba(255,255,255,0.5)", 0.1 * s); c.fillStyle = "#fff";
      for (const dx of [-0.3, 0.3]) {
        c.beginPath(); c.moveTo(dx * s - 0.12 * s, -0.3 * s); c.lineTo(dx * s + 0.12 * s, -0.3 * s);
        c.lineTo(dx * s, 0.36 * s); c.closePath(); c.fill();
      }
      c.restore();
    },
    goldChain(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.6)", 0.2 * s);
      drape(c, s, 0.2 * s, "#8a5a00"); drape(c, s, 0.13 * s, "#ffd54a"); drape(c, s, 0.05 * s, "#fff3b0");
      c.restore();
    },
    solChain(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.55)", 0.18 * s);
      drape(c, s, 0.18 * s, "#8a5a00"); drape(c, s, 0.11 * s, "#ffd54a"); drape(c, s, 0.045 * s, "#fff3b0");
      noglow(c);
      const py = 0.9 * s;
      glow(c, "rgba(120,220,255,0.7)", 0.2 * s);
      c.fillStyle = lg(c, -0.3 * s, py - 0.32 * s, 0.3 * s, py + 0.36 * s, [[0, "#9945FF"], [1, "#14F195"]]);
      c.beginPath(); c.moveTo(0, py - 0.32 * s); c.lineTo(0.3 * s, py);
      c.lineTo(0, py + 0.38 * s); c.lineTo(-0.3 * s, py); c.closePath(); c.fill();
      noglow(c); c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 0.02 * s;
      c.beginPath(); c.moveTo(-0.3 * s, py); c.lineTo(0.3 * s, py);
      c.moveTo(0, py - 0.32 * s); c.lineTo(0, py + 0.38 * s); c.stroke();
      c.restore();
    },
    bandana(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.4)", 0.12 * s);
      c.fillStyle = lg(c, 0, -0.3 * s, 0, 0.3 * s, [[0, "#ffd54a"], [1, "#c98a12"]]);
      c.beginPath(); c.moveTo(-1 * s, -0.2 * s); c.lineTo(1 * s, -0.2 * s);
      c.lineTo(0.9 * s, 0.2 * s); c.lineTo(-0.9 * s, 0.2 * s); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0.9 * s, 0); c.lineTo(1.3 * s, -0.16 * s); c.lineTo(1.24 * s, 0.12 * s); c.closePath(); c.fill();
      noglow(c); c.fillStyle = "#8a5a00";
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 0.35 * s, 0, 0.05 * s, 0, 7); c.fill(); }
      c.restore();
    },
    bowtie(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.4)", 0.12 * s); c.fillStyle = gGold(c, s);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-0.7 * s, -0.4 * s); c.lineTo(-0.7 * s, 0.4 * s); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0.7 * s, -0.4 * s); c.lineTo(0.7 * s, 0.4 * s); c.closePath(); c.fill();
      noglow(c); c.fillStyle = "#e6a100"; roundRect(c, -0.13 * s, -0.2 * s, 0.26 * s, 0.4 * s, 0.05 * s); c.fill();
      c.restore();
    },
    cape(c, s) {
      c.save(); glow(c, "rgba(255,60,60,0.25)", 0.14 * s);
      c.fillStyle = lg(c, 0, -0.6 * s, 0, 0.9 * s, [[0, "#c0102a"], [1, "#4a000c"]]);
      c.beginPath(); c.moveTo(-0.6 * s, -0.6 * s); c.lineTo(0.6 * s, -0.6 * s);
      c.quadraticCurveTo(1 * s, 0.6 * s, 0.4 * s, 0.9 * s); c.lineTo(-0.4 * s, 0.9 * s);
      c.quadraticCurveTo(-1 * s, 0.6 * s, -0.6 * s, -0.6 * s); c.closePath(); c.fill();
      noglow(c); c.fillStyle = "#ffd54a"; roundRect(c, -0.62 * s, -0.64 * s, 1.24 * s, 0.16 * s, 0.04 * s); c.fill();
      c.restore();
    },
    solCoin(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.6)", 0.25 * s);
      c.fillStyle = gGold(c, s); c.beginPath(); c.arc(0, 0, 0.9 * s, 0, 7); c.fill(); noglow(c);
      c.strokeStyle = "#8a5a00"; c.lineWidth = 0.06 * s; c.beginPath(); c.arc(0, 0, 0.9 * s, 0, 7); c.stroke();
      c.strokeStyle = "rgba(255,248,208,0.6)"; c.lineWidth = 0.03 * s; c.beginPath(); c.arc(0, 0, 0.75 * s, 0, 7); c.stroke();
      const bar = (yy) => {
        c.beginPath(); c.moveTo(-0.4 * s, yy); c.lineTo(0.3 * s, yy);
        c.lineTo(0.4 * s, yy + 0.11 * s); c.lineTo(-0.3 * s, yy + 0.11 * s); c.closePath();
      };
      c.fillStyle = lg(c, -0.4 * s, 0, 0.4 * s, 0, [[0, "#9945FF"], [1, "#14F195"]]);
      bar(-0.3 * s); c.fill(); bar(-0.06 * s); c.fill(); bar(0.18 * s); c.fill();
      c.restore();
    },
    moneyStack(c, s) {
      c.save();
      for (let i = 0; i < 4; i++) { const y = 0.18 * s - i * 0.12 * s; c.fillStyle = i % 2 ? "#3aa76d" : "#2e8f5b"; roundRect(c, -0.8 * s, y, 1.6 * s, 0.14 * s, 0.03 * s); c.fill(); }
      c.fillStyle = "#3fbf7f"; roundRect(c, -0.8 * s, -0.42 * s, 1.6 * s, 0.3 * s, 0.04 * s); c.fill();
      c.fillStyle = "#eafff2"; c.beginPath(); c.arc(0, -0.27 * s, 0.1 * s, 0, 7); c.fill();
      c.fillStyle = "#2e8f5b"; c.font = `bold ${0.17 * s}px Georgia, serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", 0, -0.26 * s);
      glow(c, "rgba(255,190,70,0.5)", 0.12 * s); c.fillStyle = "#ffd54a"; c.fillRect(-0.25 * s, -0.46 * s, 0.5 * s, 0.56 * s); noglow(c);
      c.restore();
    },
    diamondHands(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.3)", 0.1 * s);
      c.fillStyle = lg(c, 0, 0, 0, 0.8 * s, [[0, "#ffd54a"], [1, "#c98a12"]]);
      for (const d of [-1, 1]) { c.beginPath(); c.ellipse(d * 0.5 * s, 0.52 * s, 0.3 * s, 0.22 * s, d * 0.4, 0, 7); c.fill(); }
      noglow(c); glow(c, "rgba(150,220,255,0.8)", 0.25 * s);
      c.fillStyle = lg(c, 0, -0.6 * s, 0, 0.5 * s, [[0, "#eafcff"], [0.5, "#9fe8ff"], [1, "#3aa7d6"]]);
      c.beginPath(); c.moveTo(-0.4 * s, -0.2 * s); c.lineTo(0.4 * s, -0.2 * s); c.lineTo(0.55 * s, -0.05 * s);
      c.lineTo(0, 0.5 * s); c.lineTo(-0.55 * s, -0.05 * s); c.closePath(); c.fill();
      noglow(c); c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 0.02 * s;
      c.beginPath(); c.moveTo(-0.4 * s, -0.2 * s); c.lineTo(0, 0.5 * s); c.lineTo(0.4 * s, -0.2 * s);
      c.moveTo(-0.55 * s, -0.05 * s); c.lineTo(0.55 * s, -0.05 * s); c.stroke();
      c.restore();
    },
    rocket(c, s) {
      c.save(); glow(c, "rgba(255,140,0,0.9)", 0.3 * s);
      c.fillStyle = lg(c, 0, 0.4 * s, 0, 1.1 * s, [[0, "#ffd54a"], [0.5, "#ff8a00"], [1, "rgba(255,60,0,0)"]]);
      c.beginPath(); c.moveTo(-0.22 * s, 0.45 * s); c.quadraticCurveTo(0, 1.2 * s, 0.22 * s, 0.45 * s); c.fill(); noglow(c);
      c.fillStyle = lg(c, -0.3 * s, 0, 0.3 * s, 0, [[0, "#aaa"], [0.5, "#fff"], [1, "#888"]]);
      c.beginPath(); c.moveTo(0, -1 * s); c.quadraticCurveTo(0.35 * s, -0.2 * s, 0.28 * s, 0.45 * s);
      c.lineTo(-0.28 * s, 0.45 * s); c.quadraticCurveTo(-0.35 * s, -0.2 * s, 0, -1 * s); c.fill();
      c.fillStyle = "#ffd54a"; c.beginPath(); c.moveTo(0, -1 * s); c.quadraticCurveTo(0.2 * s, -0.5 * s, 0.12 * s, -0.35 * s);
      c.lineTo(-0.12 * s, -0.35 * s); c.quadraticCurveTo(-0.2 * s, -0.5 * s, 0, -1 * s); c.fill();
      c.fillStyle = "#3aa7d6"; c.strokeStyle = "#8a5a00"; c.lineWidth = 0.02 * s;
      c.beginPath(); c.arc(0, -0.05 * s, 0.13 * s, 0, 7); c.fill(); c.stroke();
      c.fillStyle = "#c0102a";
      c.beginPath(); c.moveTo(-0.28 * s, 0.1 * s); c.lineTo(-0.5 * s, 0.5 * s); c.lineTo(-0.28 * s, 0.45 * s); c.fill();
      c.beginPath(); c.moveTo(0.28 * s, 0.1 * s); c.lineTo(0.5 * s, 0.5 * s); c.lineTo(0.28 * s, 0.45 * s); c.fill();
      c.restore();
    },
    pumpArrow(c, s) {
      c.save(); glow(c, "rgba(60,220,120,0.7)", 0.25 * s);
      c.fillStyle = lg(c, 0, -1 * s, 0, 1 * s, [[0, "#7CFF9B"], [1, "#12a150"]]);
      c.beginPath(); c.moveTo(0, -1 * s); c.lineTo(0.6 * s, -0.2 * s); c.lineTo(0.25 * s, -0.2 * s);
      c.lineTo(0.25 * s, 0.9 * s); c.lineTo(-0.25 * s, 0.9 * s); c.lineTo(-0.25 * s, -0.2 * s);
      c.lineTo(-0.6 * s, -0.2 * s); c.closePath(); c.fill();
      noglow(c); c.strokeStyle = "#0a5c2a"; c.lineWidth = 0.02 * s; c.stroke(); c.restore();
    },
    fire(c, s) {
      c.save(); glow(c, "rgba(255,140,0,0.9)", 0.3 * s);
      c.fillStyle = lg(c, 0, -1 * s, 0, 0.8 * s, [[0, "#fff3b0"], [0.35, "#ffd54a"], [0.7, "#ff7a00"], [1, "#d21e00"]]);
      c.beginPath(); c.moveTo(0, -1 * s);
      c.quadraticCurveTo(0.6 * s, -0.2 * s, 0.4 * s, 0.4 * s);
      c.quadraticCurveTo(0.3 * s, 0.8 * s, 0, 0.85 * s);
      c.quadraticCurveTo(-0.3 * s, 0.8 * s, -0.4 * s, 0.4 * s);
      c.quadraticCurveTo(-0.6 * s, -0.2 * s, 0, -1 * s); c.fill();
      noglow(c);
      c.fillStyle = lg(c, 0, -0.3 * s, 0, 0.7 * s, [[0, "#ffe98a"], [1, "#ff8a00"]]);
      c.beginPath(); c.moveTo(0, -0.3 * s); c.quadraticCurveTo(0.28 * s, 0.2 * s, 0.16 * s, 0.5 * s);
      c.quadraticCurveTo(0, 0.75 * s, -0.16 * s, 0.5 * s); c.quadraticCurveTo(-0.28 * s, 0.2 * s, 0, -0.3 * s); c.fill();
      c.restore();
    },
    bolt(c, s) {
      c.save(); glow(c, "rgba(255,210,80,0.8)", 0.25 * s); c.fillStyle = gGold(c, s);
      c.beginPath(); c.moveTo(0.2 * s, -1 * s); c.lineTo(-0.4 * s, 0.1 * s); c.lineTo(-0.02 * s, 0.1 * s);
      c.lineTo(-0.25 * s, 1 * s); c.lineTo(0.45 * s, -0.2 * s); c.lineTo(0.05 * s, -0.2 * s); c.closePath(); c.fill();
      noglow(c); c.strokeStyle = "#8a5a00"; c.lineWidth = 0.02 * s; c.stroke(); c.restore();
    },
    lightRays(c, s) {
      c.save(); const n = 14;
      for (let i = 0; i < n; i++) {
        c.save(); c.rotate((i / n) * Math.PI * 2);
        const g = c.createLinearGradient(0, 0, 0, -1.1 * s);
        g.addColorStop(0, "rgba(255,220,120,0.5)"); g.addColorStop(1, "rgba(255,220,120,0)");
        c.fillStyle = g; c.beginPath(); c.moveTo(-0.06 * s, 0); c.lineTo(0.06 * s, 0);
        c.lineTo(0.14 * s, -1.1 * s); c.lineTo(-0.14 * s, -1.1 * s); c.closePath(); c.fill(); c.restore();
      }
      const rg = c.createRadialGradient(0, 0, 0, 0, 0, 0.4 * s);
      rg.addColorStop(0, "rgba(255,240,180,0.7)"); rg.addColorStop(1, "rgba(255,240,180,0)");
      c.fillStyle = rg; c.beginPath(); c.arc(0, 0, 0.4 * s, 0, 7); c.fill(); c.restore();
    },
    glowRing(c, s) {
      c.save(); glow(c, "rgba(255,200,90,0.9)", 0.4 * s);
      c.strokeStyle = "rgba(255,215,120,0.9)"; c.lineWidth = 0.12 * s;
      c.beginPath(); c.arc(0, 0, 0.85 * s, 0, 7); c.stroke(); c.restore();
    },
    speech(c, s) {
      c.save(); glow(c, "rgba(255,190,70,0.4)", 0.15 * s); c.fillStyle = "#fff8ec";
      roundRect(c, -1 * s, -0.6 * s, 2 * s, 1 * s, 0.2 * s); c.fill();
      c.beginPath(); c.moveTo(-0.3 * s, 0.38 * s); c.lineTo(-0.5 * s, 0.78 * s); c.lineTo(-0.05 * s, 0.38 * s); c.closePath(); c.fill();
      noglow(c); c.strokeStyle = "#e6a100"; c.lineWidth = 0.03 * s;
      roundRect(c, -1 * s, -0.6 * s, 2 * s, 1 * s, 0.2 * s); c.stroke();
      c.fillStyle = "#3a2a00"; c.font = `800 ${0.45 * s}px Georgia, serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("gm", 0, -0.05 * s);
      c.restore();
    },
  });

  function drawImageCover(c, img, W, H) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale, dh = ih * scale;
    c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  function drawPlaceholder(c, W, H) {
    c.fillStyle = "#c99a4e";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `800 ${Math.round(W * 0.05)}px "Trebuchet MS", sans-serif`;
    c.fillText("😇", W / 2, H * 0.4);
    c.font = `800 ${Math.round(W * 0.045)}px "Trebuchet MS", sans-serif`;
    c.fillText("CLICK TO POP", W / 2, H * 0.52);
    c.font = `600 ${Math.round(W * 0.03)}px "Trebuchet MS", sans-serif`;
    c.fillStyle = "#8a6e40";
    c.fillText("or use Popeyes", W / 2, H * 0.58);
  }

  function drawSelection(c, o, W, H) {
    const s = o.base * o.scale * W;
    const hw = o.hw * s, hh = o.hh * s;
    c.save();
    c.translate(o.x * W, o.y * H);
    c.rotate(o.rot);
    // dashed outline
    c.strokeStyle = "rgba(255,214,74,0.95)";
    c.lineWidth = Math.max(1.5, 0.006 * W);
    c.setLineDash([0.05 * W, 0.03 * W]);
    c.strokeRect(-hw, -hh, 2 * hw, 2 * hh);
    c.setLineDash([]);
    // corner handles
    const hr = Math.max(4, 0.013 * W);
    c.fillStyle = "#ffd54a"; c.strokeStyle = "rgba(0,0,0,0.4)"; c.lineWidth = 1;
    for (const cx of [-hw, hw]) for (const cy of [-hh, hh]) {
      c.beginPath(); c.arc(cx, cy, hr, 0, 7); c.fill(); c.stroke();
    }
    // tappable delete handle (top-right)
    const dr = Math.max(15, 0.034 * W);
    c.translate(hw, -hh);
    c.fillStyle = "#e0304a"; c.beginPath(); c.arc(0, 0, dr, 0, 7); c.fill();
    c.strokeStyle = "#fff"; c.lineWidth = Math.max(2, 0.006 * W);
    c.beginPath();
    c.moveTo(-dr * 0.4, -dr * 0.4); c.lineTo(dr * 0.4, dr * 0.4);
    c.moveTo(dr * 0.4, -dr * 0.4); c.lineTo(-dr * 0.4, dr * 0.4); c.stroke();
    c.restore();
  }

  function renderScene(c, W, H, opts) {
    opts = opts || {};
    c.clearRect(0, 0, W, H);
    // backdrop: a chosen background, else the warm default
    if (state.background && BG[state.background]) {
      BG[state.background](c, W, H);
    } else {
      const bg = c.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.5, Math.max(W, H) * 0.85);
      bg.addColorStop(0, "#241708");
      bg.addColorStop(1, "#0a0705");
      c.fillStyle = bg;
      c.fillRect(0, 0, W, H);
    }

    if (state.img) {
      drawBaseImage(c, state.img, W, H);
    } else if (opts.placeholder && !state.overlays.length && !state.background) {
      drawPlaceholder(c, W, H);
      return;
    }

    for (const o of state.overlays) {
      const fn = DRAW[o.type];
      if (!fn) continue;
      c.save();
      c.globalCompositeOperation = o.blend || "source-over";
      c.globalAlpha = o.alpha == null ? 1 : o.alpha;
      c.translate(o.x * W, o.y * H);
      c.rotate(o.rot);
      if (o.flipX) c.scale(-1, 1);
      fn(c, o.base * o.scale * W, o);
      c.restore();
    }

    // live circle-crop preview: dim everything outside the export circle
    if (state.shape === "circle" && opts.preview) {
      const r = Math.min(W, H) / 2;
      c.save();
      c.fillStyle = "rgba(8,5,3,0.6)";
      c.beginPath();
      c.rect(0, 0, W, H);
      c.moveTo(W / 2 + r, H / 2); // break the subpath so no chord line is drawn
      c.arc(W / 2, H / 2, r, 0, Math.PI * 2, true);
      c.fill("evenodd");
      c.strokeStyle = "rgba(255,214,74,0.9)";
      c.lineWidth = Math.max(2, 0.006 * W);
      c.beginPath(); c.arc(W / 2, H / 2, r, 0, 7); c.stroke();
      c.restore();
    }

    if (opts.selectedId != null) {
      const o = state.overlays.find((v) => v.id === opts.selectedId);
      if (o) drawSelection(c, o, W, H);
    }
  }

  // base photo drawn with cover-fit (or inset when a background is set),
  // plus the user's pan/zoom (state.view)
  function drawBaseImage(c, img, W, H) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const fit = state.background ? Math.min(W / iw, H / ih) * 0.86 : Math.max(W / iw, H / ih);
    const sc = fit * state.view.scale;
    const dw = iw * sc, dh = ih * sc;
    const cx = W / 2 + state.view.x * W, cy = H / 2 + state.view.y * H;
    c.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }

  // keep the photo covering the frame (no gaps) while panning/zooming
  function clampView() {
    if (!state.img) return;
    state.view.scale = Math.max(1, Math.min(6, state.view.scale));
    const iw = state.img.naturalWidth, ih = state.img.naturalHeight;
    const fit = state.background ? Math.min(LW / iw, LH / ih) * 0.86 : Math.max(LW / iw, LH / ih);
    const sc = fit * state.view.scale;
    const dw = iw * sc, dh = ih * sc;
    if (state.background) {
      state.view.x = Math.max(-0.5, Math.min(0.5, state.view.x));
      state.view.y = Math.max(-0.5, Math.min(0.5, state.view.y));
    } else {
      const mx = Math.max(0, (dw - LW) / (2 * LW)), my = Math.max(0, (dh - LH) / (2 * LH));
      state.view.x = Math.max(-mx, Math.min(mx, state.view.x));
      state.view.y = Math.max(-my, Math.min(my, state.view.y));
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderScene(ctx, LW, LH, { placeholder: true, preview: true, selectedId: state.selected });
  }

  // coalesce rapid redraws (drag / pinch / animation) into one per frame
  let drawQueued = false;
  function scheduleDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; draw(); });
  }

  // ---------------------------------------------------------------- history
  let history = [], hIndex = -1, commitTimer = null;
  function snapshot() {
    return {
      overlays: state.overlays.map((o) => ({ ...o })),
      view: { ...state.view },
      shape: state.shape, background: state.background,
      ribbon: state.ribbon, mode: state.mode, selected: state.selected,
    };
  }
  function commit() {
    history = history.slice(0, hIndex + 1);
    history.push(snapshot());
    if (history.length > 80) history.shift();
    hIndex = history.length - 1;
    updateUndoRedo();
  }
  function commitDebounced() { clearTimeout(commitTimer); commitTimer = setTimeout(commit, 350); }
  function applySnapshot(s) {
    state.overlays = s.overlays.map((o) => ({ ...o }));
    state.view = { ...s.view };
    state.shape = s.shape; state.background = s.background;
    state.ribbon = s.ribbon; state.mode = s.mode; state.selected = s.selected;
    syncUI(); draw();
  }
  function undo() { if (hIndex > 0) { hIndex--; applySnapshot(history[hIndex]); updateUndoRedo(); } }
  function redo() { if (hIndex < history.length - 1) { hIndex++; applySnapshot(history[hIndex]); updateUndoRedo(); } }
  function updateUndoRedo() {
    const u = document.getElementById("undo"), r = document.getElementById("redo");
    if (u) u.disabled = hIndex <= 0;
    if (r) r.disabled = hIndex >= history.length - 1;
  }
  function syncUI() {
    const rt = document.getElementById("ribbonTxt");
    if (rt) rt.textContent = RIBBON_TEXTS[state.ribbon];
    document.querySelectorAll(".scChip").forEach((ch) =>
      ch.classList.toggle("bg--on", !!ch.dataset.bg && ch.dataset.bg === state.background));
    document.querySelectorAll("[data-shape]").forEach((b) =>
      b.classList.toggle("seg--on", b.dataset.shape === state.shape));
  }

  // ---------------------------------------------------------------- selection helpers
  function selOverlay() { return state.overlays.find((o) => o.id === state.selected); }
  function deleteSelected() {
    if (state.selected == null) return false;
    state.overlays = state.overlays.filter((o) => o.id !== state.selected);
    state.selected = null; commit(); draw(); return true;
  }
  function deleteHandlePos(o) {
    const s = o.base * o.scale * LW;
    const lx = o.hw * s, ly = -o.hh * s;
    const cos = Math.cos(o.rot), sin = Math.sin(o.rot);
    return {
      x: o.x * LW + lx * cos - ly * sin,
      y: o.y * LH + lx * sin + ly * cos,
      r: Math.max(15, 0.034 * LW),
    };
  }

  // ---------------------------------------------------------------- sizing
  function resize() {
    const rect = canvas.getBoundingClientRect();
    LW = rect.width;
    LH = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(LW * dpr);
    canvas.height = Math.round(LH * dpr);
    draw();
  }

  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(canvas);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 150));

  function setAspectFromImage() {
    // pfp frame is always square; the photo is pan/zoomable inside it
    canvas.style.aspectRatio = "1 / 1";
    state.view = { x: 0, y: 0, scale: 1 };
    requestAnimationFrame(resize);
  }

  // ---------------------------------------------------------------- hit test
  function hitTest(px, py) {
    for (let i = state.overlays.length - 1; i >= 0; i--) {
      const o = state.overlays[i];
      const cx = o.x * LW, cy = o.y * LH;
      const s = o.base * o.scale * LW;
      const dx = px - cx, dy = py - cy;
      const cos = Math.cos(-o.rot), sin = Math.sin(-o.rot);
      const lx = (dx * cos - dy * sin) / s;
      const ly = (dx * sin + dy * cos) / s;
      if (Math.abs(lx) <= o.hw && Math.abs(ly) <= o.hh) return o;
    }
    return null;
  }

  // ---------------------------------------------------------------- gestures
  const pointers = new Map();
  let gm = null;      // active gesture: {type, ...}
  let moved = false;  // did anything actually change during this gesture

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = getPos(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      moved = false;
      // tap the delete handle of the selected sticker?
      const sel = selOverlay();
      if (sel) {
        const h = deleteHandlePos(sel);
        if (Math.hypot(p.x - h.x, p.y - h.y) <= h.r) { deleteSelected(); gm = null; return; }
      }
      const o = hitTest(p.x, p.y);
      if (o) {
        state.selected = o.id;
        gm = { type: "stickerDrag", id: o.id, sx: p.x, sy: p.y, ox: o.x, oy: o.y };
      } else {
        state.selected = null;
        gm = { type: "basePan", sx: p.x, sy: p.y, vx0: state.view.x, vy0: state.view.y };
      }
      draw();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const onSticker = gm && gm.type && gm.type.indexOf("sticker") === 0 && selOverlay();
      if (onSticker) {
        const o = selOverlay();
        gm = { type: "stickerPinch", id: o.id, d0: Math.max(1, dist(a, b)), a0: ang(a, b), s0: o.scale, r0: o.rot };
      } else {
        const m = mid(a, b);
        gm = { type: "basePinch", d0: Math.max(1, dist(a, b)), mx0: m.x, my0: m.y, vs0: state.view.scale, vx0: state.view.x, vy0: state.view.y };
      }
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !gm) return;
    pointers.set(e.pointerId, getPos(e));
    moved = true;
    const vals = [...pointers.values()];
    if (gm.type === "stickerPinch" && vals.length >= 2) {
      const o = selOverlay(); if (o) { o.scale = clamp(gm.s0 * (dist(vals[0], vals[1]) / gm.d0), 0.12, 6); o.rot = gm.r0 + (ang(vals[0], vals[1]) - gm.a0); }
    } else if (gm.type === "basePinch" && vals.length >= 2) {
      const m = mid(vals[0], vals[1]);
      state.view.scale = gm.vs0 * (dist(vals[0], vals[1]) / gm.d0);
      state.view.x = gm.vx0 + (m.x - gm.mx0) / LW;
      state.view.y = gm.vy0 + (m.y - gm.my0) / LH;
      clampView();
    } else if (gm.type === "stickerDrag") {
      const p = pointers.get(e.pointerId); const o = selOverlay();
      if (o) { o.x = gm.ox + (p.x - gm.sx) / LW; o.y = gm.oy + (p.y - gm.sy) / LH; }
    } else if (gm.type === "basePan") {
      const p = pointers.get(e.pointerId);
      state.view.x = gm.vx0 + (p.x - gm.sx) / LW;
      state.view.y = gm.vy0 + (p.y - gm.sy) / LH;
      clampView();
    }
    scheduleDraw();
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      if (moved && gm) commit();
      gm = null; moved = false;
    } else if (pointers.size === 1) {
      // 2 -> 1 finger: continue smoothly with the remaining pointer
      const p = [...pointers.values()][0];
      if (state.selected != null && gm && gm.type && gm.type.indexOf("sticker") === 0) {
        const o = selOverlay();
        if (o) gm = { type: "stickerDrag", id: o.id, sx: p.x, sy: p.y, ox: o.x, oy: o.y };
      } else {
        gm = { type: "basePan", sx: p.x, sy: p.y, vx0: state.view.x, vy0: state.view.y };
      }
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  // desktop: wheel scales the selected sticker (alt/shift = rotate), else zooms the photo
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const o = selOverlay();
      if (o) {
        if (e.altKey || e.shiftKey) o.rot += (e.deltaY > 0 ? 1 : -1) * 0.08;
        else o.scale = clamp(o.scale * (e.deltaY > 0 ? 0.94 : 1.06), 0.12, 6);
      } else if (state.img) {
        state.view.scale = clamp(state.view.scale * (e.deltaY > 0 ? 0.94 : 1.06), 1, 6);
        clampView();
      } else return;
      draw();
      commitDebounced();
    },
    { passive: false }
  );

  // ---------------------------------------------------------------- sources
  function loadImageFromURL(url, mode, { onerror } = {}) {
    const img = new Image();
    img.onload = () => {
      state.img = img;
      state.mode = mode;
      buildRig(mode);
      setAspectFromImage();
      history = []; hIndex = -1; commit();
      draw();
    };
    img.onerror = () => { if (onerror) onerror(); };
    // NOTE: no crossOrigin — the preset is same-origin, so it never taints the
    // canvas (export still works). Setting crossOrigin="anonymous" forces CORS
    // mode, which iOS Safari fails on for CDN-cached same-origin images.
    img.src = url;
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      toast("that's not an image");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => loadImageFromURL(reader.result, "upload");
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    fileInput.value = "";
  });

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  ["dragenter", "dragover"].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add("drag"); })
  );
  ["dragleave", "dragend", "drop"].forEach((ev) =>
    dropZone.addEventListener(ev, () => dropZone.classList.remove("drag"))
  );
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  document.getElementById("preset").addEventListener("click", () => {
    loadImageFromURL(PRESET_SRC, "preset", {
      onerror: () =>
        toast("drop " + PRESET_SRC + " in the repo, then tap again"),
    });
  });

  // Auto-load the Popeyes cat on first paint so visitors see it immediately
  // instead of the "CLICK TO POP" placeholder — no need to tap "use Popeyes".
  loadImageFromURL(PRESET_SRC, "preset", { onerror: () => {} });

  // ---------------------------------------------------------------- controls
  const ribbonBtn = document.getElementById("ribbonToggle");
  const ribbonTxt = document.getElementById("ribbonTxt");
  ribbonBtn.addEventListener("click", () => {
    state.ribbon = (state.ribbon + 1) % RIBBON_TEXTS.length;
    ribbonTxt.textContent = RIBBON_TEXTS[state.ribbon];
    ribbonBtn.setAttribute("aria-pressed", state.ribbon === 1 ? "true" : "false");
    if (state.img) commit();
    draw();
  });

  // 👀 pop-eyes: opt-in toggle. On the preset they land dead-center on the
  // cat's eyes (calibrated to preset-cat-1.jpg); on uploads they go eye-height.
  function addEyes() {
    const eyes =
      state.mode === "preset"
        ? [makeOverlay("eye", 0.33, 0.52, { scale: 1.12 }), makeOverlay("eye", 0.662, 0.518, { scale: 1.12 })]
        : [makeOverlay("eye", 0.4, 0.44), makeOverlay("eye", 0.6, 0.44)];
    // insert just below the crown (if any) so eyes sit under it, over the photo
    const at = state.overlays.findIndex((o) => o.type === "crown");
    if (at >= 0) state.overlays.splice(at, 0, ...eyes);
    else state.overlays.push(...eyes);
    commit();
    animateIn(eyes);
  }

  document.getElementById("toggleEyes").addEventListener("click", () => {
    if (!state.img) { toast("add a photo first"); return; }
    const hasEyes = state.overlays.some((o) => o.type === "eye");
    if (hasEyes) {
      state.overlays = state.overlays.filter((o) => o.type !== "eye");
      if (state.selected != null && !state.overlays.some((o) => o.id === state.selected)) state.selected = null;
      commit(); draw();
    } else {
      addEyes();
    }
  });

  document.getElementById("addSparkle").addEventListener("click", () => {
    const o = makeOverlay("sparkle", 0.5, 0.4, { scale: 0.9 });
    state.overlays.push(o); state.selected = o.id; commit(); animateIn([o]);
  });
  document.getElementById("addPaw").addEventListener("click", () => {
    const o = makeOverlay("paw", 0.5, 0.55);
    state.overlays.push(o); state.selected = o.id; commit(); animateIn([o]);
  });
  document.getElementById("delSel").addEventListener("click", () => {
    if (!deleteSelected()) toast("tap a sticker first");
  });
  document.getElementById("reset").addEventListener("click", () => {
    buildRig(state.mode);
    state.background = null;
    state.view = { x: 0, y: 0, scale: 1 };
    document.querySelectorAll(".scChip.bg--on").forEach((c) => c.classList.remove("bg--on"));
    commit(); draw();
  });

  // ---------------------------------------------------------------- sticker tray
  function animateIn(items, dur) {
    dur = dur || 220;
    items.forEach((o) => (o.alpha = 0));
    let t0 = null;
    function step(t) {
      if (t0 == null) t0 = t;
      const k = Math.min(1, (t - t0) / dur);
      items.forEach((o) => (o.alpha = k));
      scheduleDraw();
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function addSticker(key) {
    const o = makeOverlay(key, 0.5, 0.45);
    state.overlays.push(o);
    state.selected = o.id;
    commit();
    animateIn([o]);
  }
  function setBackground(key) {
    state.background = state.background === key ? null : key;
    clampView();
    commit();
    draw();
    document.querySelectorAll(".scChip").forEach((ch) =>
      ch.classList.toggle("bg--on", !!ch.dataset.bg && ch.dataset.bg === state.background)
    );
  }

  const trayTabs = document.getElementById("trayTabs");
  const trayStrip = document.getElementById("trayStrip");
  function renderChipPreview(cv, key) {
    const g = cv.getContext("2d");
    const S = cv.width;
    g.clearRect(0, 0, S, S);
    const m = META[key] || {};
    if (m.bg) { BG[key](g, S, S); return; }
    const fn = DRAW[key];
    if (!fn) return;
    g.save();
    g.translate(S / 2, S / 2);
    g.globalCompositeOperation = (TYPE[key] && TYPE[key].blend) || "source-over";
    fn(g, S * 0.3, { char: m.char, text: m.text, base: 0.3, scale: 1 });
    g.restore();
  }
  function selectCat(cat) {
    [...trayTabs.children].forEach((t) => t.classList.toggle("tab--on", t.dataset.cat === cat));
    trayStrip.innerHTML = "";
    for (const key of LIB[cat]) {
      const m = META[key] || {};
      const chip = document.createElement("button");
      chip.className = "scChip";
      chip.type = "button";
      chip.title = m.label || key;
      if (m.bg) { chip.dataset.bg = key; if (state.background === key) chip.classList.add("bg--on"); }
      const cv = document.createElement("canvas");
      cv.width = cv.height = 58;
      chip.appendChild(cv);
      const lbl = document.createElement("span");
      lbl.className = "scLbl";
      lbl.textContent = m.label || key;
      chip.appendChild(lbl);
      chip.addEventListener("click", () => (m.bg ? setBackground(key) : addSticker(key)));
      trayStrip.appendChild(chip);
      renderChipPreview(cv, key);
    }
    trayStrip.scrollLeft = 0;
  }
  (function buildTray() {
    Object.keys(LIB).forEach((cat) => {
      const tb = document.createElement("button");
      tb.className = "tab";
      tb.type = "button";
      tb.textContent = cat;
      tb.dataset.cat = cat;
      tb.addEventListener("click", () => selectCat(cat));
      trayTabs.appendChild(tb);
    });
    selectCat(Object.keys(LIB)[0]);
  })();

  function moveLayer(kind) {
    const i = state.overlays.findIndex((o) => o.id === state.selected);
    if (i < 0) { toast("tap a sticker first"); return; }
    const arr = state.overlays, [o] = arr.splice(i, 1);
    let j = i;
    if (kind === "front") j = arr.length;
    else if (kind === "back") j = 0;
    else if (kind === "forward") j = Math.min(arr.length, i + 1);
    else if (kind === "backward") j = Math.max(0, i - 1);
    arr.splice(j, 0, o);
    commit(); draw();
  }
  document.getElementById("layerFront").addEventListener("click", () => moveLayer("front"));
  document.getElementById("layerBack").addEventListener("click", () => moveLayer("back"));
  const lf = document.getElementById("layerForward"); if (lf) lf.addEventListener("click", () => moveLayer("forward"));
  const lb = document.getElementById("layerBackward"); if (lb) lb.addEventListener("click", () => moveLayer("backward"));

  // flip / duplicate selected sticker
  document.getElementById("flipSel").addEventListener("click", () => {
    const o = selOverlay(); if (!o) { toast("tap a sticker first"); return; }
    o.flipX = o.flipX ? 0 : 1; commit(); draw();
  });
  document.getElementById("dupSel").addEventListener("click", () => {
    const o = selOverlay(); if (!o) { toast("tap a sticker first"); return; }
    const clone = { ...o, id: uid++, x: Math.min(0.95, o.x + 0.06), y: Math.min(0.95, o.y + 0.06) };
    const i = state.overlays.findIndex((v) => v.id === o.id);
    state.overlays.splice(i + 1, 0, clone);
    state.selected = clone.id;
    commit(); draw();
  });

  // undo / redo
  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("redo").addEventListener("click", redo);
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.metaKey || e.ctrlKey) && k === "y") { e.preventDefault(); redo(); }
  });

  // crop shape (square / circle)
  document.querySelectorAll("[data-shape]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.shape === btn.dataset.shape) return;
      state.shape = btn.dataset.shape;
      syncUI(); commit(); draw();
    });
  });

  // export size picker
  document.querySelectorAll("[data-size]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.exportSize = parseInt(btn.dataset.size, 10);
      document.querySelectorAll("[data-size]").forEach((b) => b.classList.toggle("seg--on", b === btn));
    });
  });

  // ---------------------------------------------------------------- contract address
  const CA_TEXT = "swA5DdNU2HC9Uab2SEeJ3etuDRz8LvVDPWCgRc3pump";
  const caBtn = document.getElementById("caCopy");
  if (caBtn) {
    caBtn.addEventListener("click", async () => {
      let ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(CA_TEXT);
          ok = true;
        }
      } catch (e) { ok = false; }
      if (!ok) {
        const ta = document.createElement("textarea");
        ta.value = CA_TEXT;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:-1000px;left:0;opacity:0;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { ta.setSelectionRange(0, CA_TEXT.length); } catch (e) {}
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        ta.remove();
      }
      toast(ok ? "CA copied ✓" : "copy failed — long-press to copy");
    });
  }

  // ---------------------------------------------------------------- export / share
  // render the composite to a square NxN canvas; circle -> transparent corners
  function renderExport() {
    const N = state.exportSize || 2048;
    const off = document.createElement("canvas");
    off.width = N; off.height = N;
    const ectx = off.getContext("2d");
    ectx.setTransform(1, 0, 0, 1, 0, 0);
    renderScene(ectx, N, N, { placeholder: false, preview: false });
    if (state.shape === "circle") {
      ectx.globalCompositeOperation = "destination-in";
      ectx.fillStyle = "#fff";
      ectx.beginPath();
      ectx.arc(N / 2, N / 2, N / 2, 0, 7);
      ectx.fill();
      ectx.globalCompositeOperation = "source-over";
    }
    return off;
  }
  function exportBlob() {
    const off = renderExport();
    return new Promise((resolve) => {
      if (off.toBlob) off.toBlob((b) => resolve(b), "image/png");
      else resolve(dataURLToBlob(off.toDataURL("image/png")));
    });
  }
  function dataURLToBlob(u) {
    const [head, b64] = u.split(",");
    const mime = head.match(/:(.*?);/)[1];
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function triggerDownload(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "popeyes.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  document.getElementById("download").addEventListener("click", async () => {
    if (!state.img) { toast("add a photo first"); return; }
    const blob = await exportBlob();
    if (!blob) { triggerDownload(dataURLToBlob(renderExport().toDataURL("image/png"))); }
    else triggerDownload(blob);
    toast("downloaded 😼");
  });

  document.getElementById("copyImg").addEventListener("click", async () => {
    if (!state.img) { toast("add a photo first"); return; }
    // Safari needs the ClipboardItem promise created synchronously in the gesture
    try {
      if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error("no clipboard image");
      const item = new ClipboardItem({ "image/png": exportBlob() });
      await navigator.clipboard.write([item]);
      toast("image copied — paste into X ✓");
    } catch (err) {
      const blob = await exportBlob();
      triggerDownload(blob);
      toast("copy unsupported — downloaded instead");
    }
  });

  document.getElementById("shareX").addEventListener("click", async () => {
    if (!state.img) { toast("add a photo first"); return; }
    const blob = await exportBlob();
    triggerDownload(blob);
    const text =
      "made my $POPEYES pfp — the cutest pussy on Solana\n\n" +
      "CA: swA5DdNU2HC9Uab2SEeJ3etuDRz8LvVDPWCgRc3pump";
    const url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener");
    toast("image saved — attach it to your post");
  });

  // ---------------------------------------------------------------- boot
  commit(); // seed history with the empty starting state
  updateUndoRedo();
  requestAnimationFrame(resize);
})();
