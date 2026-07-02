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
    const t = TYPE[type];
    return Object.assign(
      { id: uid++, type, x, y, scale: 1, rot: 0, base: t.base, hw: t.hw, hh: t.hh, blend: t.blend || "source-over" },
      extra || {}
    );
  }

  // ---------------------------------------------------------------- rigs
  function buildRig(mode) {
    const o = [];
    if (mode === "preset") {
      // Already blessed: crown + ribbon ONLY.
      o.push(makeOverlay("crown", 0.5, 0.16));
      o.push(makeOverlay("ribbon", 0.5, 0.9));
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
    c.save();
    c.translate(o.x * W, o.y * H);
    c.rotate(o.rot);
    const s = o.base * o.scale * W;
    c.strokeStyle = "rgba(255,214,74,0.9)";
    c.lineWidth = Math.max(1, 0.012 * s);
    c.setLineDash([0.12 * s, 0.09 * s]);
    c.strokeRect(-o.hw * s, -o.hh * s, 2 * o.hw * s, 2 * o.hh * s);
    c.setLineDash([]);
    c.restore();
  }

  function renderScene(c, W, H, opts) {
    opts = opts || {};
    c.clearRect(0, 0, W, H);
    // warm shrine backdrop
    const bg = c.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.5, Math.max(W, H) * 0.85);
    bg.addColorStop(0, "#241708");
    bg.addColorStop(1, "#0a0705");
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    if (state.img) {
      drawImageCover(c, state.img, W, H);
    } else if (opts.placeholder) {
      drawPlaceholder(c, W, H);
      return;
    }

    for (const o of state.overlays) {
      c.save();
      c.globalCompositeOperation = o.blend || "source-over";
      c.translate(o.x * W, o.y * H);
      c.rotate(o.rot);
      DRAW[o.type](c, o.base * o.scale * W, o);
      c.restore();
    }

    if (opts.selectedId != null) {
      const o = state.overlays.find((v) => v.id === opts.selectedId);
      if (o) drawSelection(c, o, W, H);
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderScene(ctx, LW, LH, { placeholder: true, selectedId: state.selected });
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

  function setAspectFromImage(img) {
    let ar = img.naturalWidth / img.naturalHeight;
    ar = Math.max(0.62, Math.min(1.6, ar)); // keep it mobile-sane
    canvas.style.aspectRatio = ar.toFixed(4);
    // ResizeObserver fires on the layout change; nudge in case it doesn't.
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
  let drag = null;  // { id, sx, sy, ox, oy }
  let pinch = null; // { id, d0, a0, s0, r0 }

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, getPos(e));
    if (pointers.size === 1) {
      const o = hitTest(pointers.get(e.pointerId).x, pointers.get(e.pointerId).y);
      state.selected = o ? o.id : null;
      drag = o ? { id: o.id, sx: pointers.get(e.pointerId).x, sy: pointers.get(e.pointerId).y, ox: o.x, oy: o.y } : null;
      draw();
    } else if (pointers.size === 2) {
      drag = null;
      const o = state.selected != null ? state.overlays.find((v) => v.id === state.selected) : null;
      if (o) {
        const [a, b] = [...pointers.values()];
        pinch = { id: o.id, d0: Math.max(1, dist(a, b)), a0: ang(a, b), s0: o.scale, r0: o.rot };
      }
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, getPos(e));
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const o = state.overlays.find((v) => v.id === pinch.id);
      if (o) {
        o.scale = Math.max(0.12, Math.min(6, pinch.s0 * (dist(a, b) / pinch.d0)));
        o.rot = pinch.r0 + (ang(a, b) - pinch.a0);
        draw();
      }
    } else if (drag) {
      const p = pointers.get(e.pointerId);
      const o = state.overlays.find((v) => v.id === drag.id);
      if (o) {
        o.x = drag.ox + (p.x - drag.sx) / LW;
        o.y = drag.oy + (p.y - drag.sy) / LH;
        draw();
      }
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  // desktop niceties: wheel = scale, alt/shift+wheel = rotate
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (state.selected == null) return;
      e.preventDefault();
      const o = state.overlays.find((v) => v.id === state.selected);
      if (!o) return;
      if (e.altKey || e.shiftKey) {
        o.rot += (e.deltaY > 0 ? 1 : -1) * 0.08;
      } else {
        o.scale = Math.max(0.12, Math.min(6, o.scale * (e.deltaY > 0 ? 0.94 : 1.06)));
      }
      draw();
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
      setAspectFromImage(img);
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

  // ---------------------------------------------------------------- controls
  const ribbonBtn = document.getElementById("ribbonToggle");
  const ribbonTxt = document.getElementById("ribbonTxt");
  ribbonBtn.addEventListener("click", () => {
    state.ribbon = (state.ribbon + 1) % RIBBON_TEXTS.length;
    ribbonTxt.textContent = RIBBON_TEXTS[state.ribbon];
    ribbonBtn.setAttribute("aria-pressed", state.ribbon === 1 ? "true" : "false");
    draw();
  });

  document.getElementById("addSparkle").addEventListener("click", () => {
    const o = makeOverlay("sparkle", 0.5, 0.4, { scale: 0.9 });
    state.overlays.push(o);
    state.selected = o.id;
    draw();
  });
  document.getElementById("addPaw").addEventListener("click", () => {
    const o = makeOverlay("paw", 0.5, 0.55);
    state.overlays.push(o);
    state.selected = o.id;
    draw();
  });
  document.getElementById("delSel").addEventListener("click", () => {
    if (state.selected == null) { toast("tap a sticker first"); return; }
    state.overlays = state.overlays.filter((v) => v.id !== state.selected);
    state.selected = null;
    draw();
  });
  document.getElementById("reset").addEventListener("click", () => {
    buildRig(state.mode);
    draw();
  });

  // ---------------------------------------------------------------- export
  document.getElementById("download").addEventListener("click", () => {
    if (!state.img) { toast("add a photo first"); return; }
    const aspect = LW / LH || 0.8;
    const T = 2048;
    let EW, EH;
    if (aspect >= 1) { EW = T; EH = Math.round(T / aspect); }
    else { EH = T; EW = Math.round(T * aspect); }

    const off = document.createElement("canvas");
    off.width = EW;
    off.height = EH;
    const ectx = off.getContext("2d");
    ectx.setTransform(1, 0, 0, 1, 0, 0);
    renderScene(ectx, EW, EH, { placeholder: false });

    const finish = (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "popeyes-ify.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("downloaded 😼");
    };

    if (off.toBlob) {
      off.toBlob((b) => { if (b) finish(b); else fallbackDownload(off); }, "image/png");
    } else {
      fallbackDownload(off);
    }
  });

  function fallbackDownload(off) {
    // Safari fallback if toBlob is unavailable/blocked.
    const a = document.createElement("a");
    a.href = off.toDataURL("image/png");
    a.download = "popeyes-ify.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("downloaded 😼");
  }

  // ---------------------------------------------------------------- boot
  requestAnimationFrame(resize);
})();
