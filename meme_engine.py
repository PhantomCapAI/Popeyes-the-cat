#!/usr/bin/env python3
"""
meme_engine.py — standalone meme generator for $POPEYES, the holiest cat on SOL.

Renders four templates off a single mascot image:
    classic        impact-caption meme (top + bottom)
    reaction       single reaction bar
    milestone      gold milestone banner (halo / cone lore)
    chart_teaser   live price / mcap / 24h% from Dexscreener in a gold frame

A caption bank + sha1 dedup ledger (posted.json) refuses repeat template|caption
combos inside a rolling 30-post window and round-robins formats across a batch.

Hard rules baked in:
  * Real live data only. If Dexscreener can't be reached or the token fails
    verification, chart_teaser is SKIPPED — never rendered with invented numbers.
  * Nothing auto-posts. PNGs land in out/ for manual review. Telegram push is
    optional, env-gated (TG_BOT_TOKEN + TG_CHAT_ID), and is still for eyeball
    approval only — it does not post anywhere public.
  * Standalone: stdlib + Pillow. No external infra, no hardcoded secrets.

Usage:
    python3 meme_engine.py                 # verify token, render a batch of 4
    python3 meme_engine.py --count 8       # render 8 (round-robins templates)
    python3 meme_engine.py --verify-only   # just run STEP 0 token verification
    python3 meme_engine.py --template classic --count 3
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

# --------------------------------------------------------------------------- #
# Paths (everything resolved next to this script — no cwd surprises)
# --------------------------------------------------------------------------- #
ROOT = Path(__file__).resolve().parent
MASCOT_PATH = ROOT / "mascot.jpg"
FONT_ANTON = ROOT / "fonts" / "Anton.ttf"
FONT_OSWALD = ROOT / "fonts" / "Oswald.ttf"
LEDGER_PATH = ROOT / "posted.json"
OUT_DIR = ROOT / "out"

# --------------------------------------------------------------------------- #
# Token (STEP 0 candidate — UNCONFIRMED until verify_token() passes)
# --------------------------------------------------------------------------- #
CANDIDATE_CA = "45acsB9DR1pN7me74rxUzp6yrVDRdxpcG2iZXoib8xZW"
REQUIRE_SYMBOL = "popeyes"
REQUIRE_CHAIN = "solana"
REQUIRE_DEX = "pumpswap"
DEX_ENDPOINT = "https://api.dexscreener.com/latest/dex/tokens/{ca}"

# --------------------------------------------------------------------------- #
# Canvas + palette
# --------------------------------------------------------------------------- #
W = H = 1080
GOLD = (214, 174, 92)
GOLD_HI = (247, 224, 158)
GOLD_LO = (150, 112, 40)
INK = (18, 16, 12)
CREAM = (250, 246, 236)
GREEN = (63, 199, 120)
RED = (232, 84, 84)
DIM = (0, 0, 0)

# 30-post rolling window for dedup
WINDOW = 30

# --------------------------------------------------------------------------- #
# Caption bank — on-lore, short, degen. No AI-slop phrasing.
#   Lore anchors: holiest cat on SOL, halo, the cone, blessing, pilgrimage,
#   sainthood, meowracles, the flock, higher timeframe.
# --------------------------------------------------------------------------- #
CAPTIONS: dict[str, list[str]] = {
    "classic": [
        ("the holiest cat on SOL", "kneel"),
        ("halo on", "cone secured"),
        ("saint popeyes", "watching your bags"),
        ("blessed be the flock", "amen degens"),
        ("one cat", "one faith"),
        ("the cone protects", "the halo provides"),
        ("meowracle incoming", "stay seated"),
        ("holy water only", "no paper hands"),
        ("purrfectly holy", "on solana"),
        ("the cat has spoken", "so it is"),
        ("worship the whiskers", "fear the dump? never"),
        ("nine lives", "nine green candles"),
        ("sanctified supply", "blessed float"),
        ("pray to the cone", "pump the halo"),
        ("thou shalt not sell", "sayeth the cat"),
        ("relic tier", "museum bound"),
        ("the pilgrimage is on", "walk toward the light"),
        ("chosen chain", "chosen cat"),
    ],
    "reaction": [
        "me watching popeyes hold the line",
        "chart red, faith greener",
        "when the cone tilts just right",
        "holders after one (1) green candle",
        "you: panic. the cat: purrs.",
        "seller remorse loading…",
        "the flock does not flinch",
        "halo still on, we good",
        "cat said hold so we hold",
        "another day another blessing",
        "sol validators bow to the cat",
        "him? oh that's just our saint",
        "cone up, doubt down",
        "no thoughts, only meow",
        "the dip? a test of faith",
        "gm to the holiest cat only",
        "screenshotting for the sermon later",
        "diamond paws, blessed heart",
    ],
    "milestone": [
        "181K AND CLIMBING",
        "NEW ATH — HALOS UP",
        "THE FLOCK GROWS",
        "1000 HOLDERS BLESSED",
        "CONE SECURED",
        "HIGHER TIMEFRAME, HIGHER POWER",
        "SAINTHOOD UNLOCKED",
        "GREEN CANDLE CANONIZED",
        "MEOWRACLE CONFIRMED",
        "THE CAT ASCENDS",
        "VOLUME OF THE FAITHFUL",
        "LIQUIDITY, BLESSED",
        "ANOTHER MILESTONE, ANOTHER MEOW",
        "PILGRIMS ARRIVING",
        "HALO AT ALL TIME HIGH",
        "THE COLLECTION PLATE IS FULL",
        "CHART SHAPED LIKE A HALO",
        "BELIEVERS ONLY FROM HERE",
    ],
    "chart_teaser": [
        "the numbers are blessed",
        "live from the pulpit",
        "read it and believe",
        "the cat's ledger, on-chain",
        "no faith required, just look",
        "holy candles only",
        "today's sermon: number go up",
        "the cone reports",
        "straight from the halo",
        "receipts, blessed and public",
        "the flock's report card",
        "meowmentum check",
        "gospel of the green tick",
        "the higher timeframe blesses us",
        "proof of purr",
        "on-chain and on-lore",
        "the collection plate, live",
        "saint popeyes' quarterly",
    ],
}

# Small lore-flavored tags for chart headers
CHART_TITLE = "SAINT POPEYES"
CHART_SUB = "holiest cat on SOL"


# --------------------------------------------------------------------------- #
# Fonts
# --------------------------------------------------------------------------- #
def font(path: Path, size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    """Load a truetype font; for the Oswald variable font, optionally pin a weight."""
    f = ImageFont.truetype(str(path), size)
    if weight is not None:
        try:
            f.set_variation_by_axes([weight])
        except Exception:
            pass  # static font or no such axis — default instance is fine
    return f


# --------------------------------------------------------------------------- #
# Dedup ledger
# --------------------------------------------------------------------------- #
def combo_hash(template: str, caption_key: str) -> str:
    return hashlib.sha1(f"{template}|{caption_key}".encode("utf-8")).hexdigest()


def load_ledger() -> list[dict]:
    if LEDGER_PATH.exists():
        try:
            return json.loads(LEDGER_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            print(f"[ledger] {LEDGER_PATH.name} unreadable — starting fresh")
    return []


def save_ledger(entries: list[dict]) -> None:
    LEDGER_PATH.write_text(json.dumps(entries, indent=2, ensure_ascii=False))


def recent_hashes(ledger: list[dict], window: int = WINDOW) -> set[str]:
    return {e["hash"] for e in ledger[-window:]}


def pick_caption(template: str, blocked: set[str]):
    """Pick a caption for `template` whose combo hash is not in `blocked`.

    Returns (caption_value, caption_key, combo_hash). caption_key is a stable
    string used for hashing/dedup; caption_value is what the template renders.
    Falls back to the least-recently-used if the whole bank is exhausted.
    """
    bank = CAPTIONS[template]
    candidates = []
    for item in bank:
        key = item[0] if isinstance(item, tuple) else item
        h = combo_hash(template, key)
        candidates.append((item, key, h))

    fresh = [c for c in candidates if c[2] not in blocked]
    pool = fresh if fresh else candidates
    if not fresh:
        print(f"[dedup] {template}: window exhausted, allowing a reuse")
    return random.choice(pool)


# --------------------------------------------------------------------------- #
# Dexscreener client + STEP 0 verification
# --------------------------------------------------------------------------- #
def fetch_dexscreener(ca: str, timeout: int = 20) -> dict | None:
    """GET the token's pairs. Returns parsed JSON dict, or None on any failure.

    Never raises upward and never fabricates — a failed/empty fetch is None.
    """
    url = DEX_ENDPOINT.format(ca=ca)
    req = urllib.request.Request(
        url, headers={"User-Agent": "popeyes-meme-engine/1.0", "Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                print(f"[dexscreener] HTTP {resp.status} — skipping chart")
                return None
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
        print(f"[dexscreener] fetch failed ({e.__class__.__name__}: {e}) — skipping chart")
        return None
    except json.JSONDecodeError as e:
        print(f"[dexscreener] bad JSON ({e}) — skipping chart")
        return None


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def verify_token(ca: str) -> dict | None:
    """STEP 0. Verify the candidate CA against required symbol/chain/dex.

    Prints resolved name / symbol / mcap / pair for eyeballing. Returns the
    matched pair dict on success, or None (and prints the mismatch) on failure.
    On None the caller MUST NOT render chart_teaser.
    """
    print("── STEP 0: token verification ──────────────────────────────")
    print(f"candidate CA : {ca}")
    data = fetch_dexscreener(ca)
    if not data:
        print("result       : NO RESPONSE / unreachable → chart disabled")
        print("action       : STOP — supply a reachable env or the correct CA.")
        return None

    pairs = data.get("pairs") or []
    if not pairs:
        print("result       : empty 'pairs' array → chart disabled")
        print("action       : STOP — CA resolves to no pairs; verify the address.")
        return None

    # Prefer a pair that satisfies all three constraints, richest liquidity first.
    def ok(p):
        bt = (p.get("baseToken") or {}).get("symbol", "")
        return (
            bt.lower() == REQUIRE_SYMBOL
            and (p.get("chainId") or "").lower() == REQUIRE_CHAIN
            and (p.get("dexId") or "").lower() == REQUIRE_DEX
        )

    matches = sorted(
        [p for p in pairs if ok(p)],
        key=lambda p: _num((p.get("liquidity") or {}).get("usd")) or 0.0,
        reverse=True,
    )

    if not matches:
        # Report what we actually got so the mismatch is eyeballable.
        top = pairs[0]
        bt = top.get("baseToken") or {}
        print("result       : MISMATCH")
        print(f"  expected   : symbol={REQUIRE_SYMBOL} chain={REQUIRE_CHAIN} dex={REQUIRE_DEX}")
        print(f"  got        : symbol={bt.get('symbol')!r} "
              f"chain={top.get('chainId')!r} dex={top.get('dexId')!r}")
        print("action       : STOP — do NOT render chart. Await correct CA.")
        return None

    pair = matches[0]
    bt = pair.get("baseToken") or {}
    mcap = _num(pair.get("marketCap")) or _num(pair.get("fdv"))
    print("result       : ✅ MATCH")
    print(f"  name       : {bt.get('name')}")
    print(f"  symbol     : {bt.get('symbol')}")
    print(f"  chain/dex  : {pair.get('chainId')} / {pair.get('dexId')}")
    print(f"  price USD  : {pair.get('priceUsd')}")
    print(f"  mcap       : {_fmt_usd(mcap) if mcap else 'n/a'}")
    print(f"  24h        : {pair.get('priceChange', {}).get('h24')}%")
    print(f"  pair addr  : {pair.get('pairAddress')}")
    print("  (eyeball vs screenshot: ~$181K, \"holiest cat on SOL\")")
    print("────────────────────────────────────────────────────────────")
    return pair


def chart_stats(pair: dict) -> dict:
    """Extract just the fields the chart_teaser renders. Live values only."""
    return {
        "price": pair.get("priceUsd"),
        "mcap": _num(pair.get("marketCap")) or _num(pair.get("fdv")),
        "vol24": _num((pair.get("volume") or {}).get("h24")),
        "chg24": _num((pair.get("priceChange") or {}).get("h24")),
    }


# --------------------------------------------------------------------------- #
# Formatting helpers
# --------------------------------------------------------------------------- #
def _fmt_usd(v: float | None) -> str:
    if v is None:
        return "n/a"
    if v >= 1_000_000:
        return f"${v/1_000_000:.2f}M"
    if v >= 1_000:
        return f"${v/1_000:.1f}K"
    return f"${v:,.0f}"


def _fmt_price(v) -> str:
    n = _num(v)
    if n is None:
        return "n/a"
    if n >= 1:
        return f"${n:,.4f}"
    # small-cap prices: show enough significant digits
    return f"${n:.8f}".rstrip("0").rstrip(".") if n > 0 else "$0"


def _fmt_pct(v: float | None) -> str:
    if v is None:
        return "n/a"
    return f"{'+' if v >= 0 else ''}{v:.1f}%"


# --------------------------------------------------------------------------- #
# Drawing primitives
# --------------------------------------------------------------------------- #
def load_mascot() -> Image.Image:
    if not MASCOT_PATH.exists():
        raise FileNotFoundError(
            f"mascot missing at {MASCOT_PATH} — vendor mascot.jpg next to the script"
        )
    return Image.open(MASCOT_PATH).convert("RGB")


def cover(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Center-crop + scale `img` to exactly fill `size` (CSS object-fit: cover)."""
    tw, th = size
    iw, ih = img.size
    scale = max(tw / iw, th / ih)
    nw, nh = int(iw * scale + 0.5), int(ih * scale + 0.5)
    img = img.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - tw) // 2, (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def gradient_v(size, top_rgba, bottom_rgba):
    """Vertical alpha gradient overlay (top→bottom)."""
    w, h = size
    grad = Image.new("RGBA", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        px = tuple(int(a + (b - a) * t) for a, b in zip(top_rgba, bottom_rgba))
        grad.putpixel((0, y), px)
    return grad.resize((w, h))


def wrap_text(draw, text, fnt, max_w) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for w_ in words:
        trial = f"{cur} {w_}".strip()
        if draw.textlength(trial, font=fnt) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def impact_text(draw, center_x, y, text, fnt, fill=CREAM, stroke=INK,
                stroke_w=None, anchor="ma"):
    """Draw one line of impact-style text with a heavy stroke."""
    if stroke_w is None:
        stroke_w = max(3, fnt.size // 12)
    draw.text((center_x, y), text, font=fnt, fill=fill, anchor=anchor,
              stroke_width=stroke_w, stroke_fill=stroke)


def draw_wrapped_block(draw, text, fnt, cx, y, max_w, line_gap=1.06,
                       fill=CREAM, stroke=INK, anchor="ma", upward=False):
    """Draw wrapped, centered impact text. Returns total block height."""
    lines = wrap_text(draw, text, fnt, max_w)
    asc, desc = fnt.getmetrics()
    lh = int((asc + desc) * line_gap)
    total = lh * len(lines)
    start = y - total if upward else y
    for i, ln in enumerate(lines):
        impact_text(draw, cx, start + i * lh, ln, fnt, fill=fill,
                    stroke=stroke, anchor=anchor)
    return total


# --------------------------------------------------------------------------- #
# Templates — each returns a finished RGB Image
# --------------------------------------------------------------------------- #
def render_classic(mascot, caption) -> Image.Image:
    top_text, bottom_text = caption
    base = cover(mascot, (W, H)).convert("RGBA")
    # darken top and bottom thirds for legibility
    base.alpha_composite(gradient_v((W, H // 3), (0, 0, 0, 165), (0, 0, 0, 0)))
    bottom_grad = gradient_v((W, H // 3), (0, 0, 0, 0), (0, 0, 0, 185))
    base.alpha_composite(bottom_grad, (0, H - H // 3))
    d = ImageDraw.Draw(base)
    f = font(FONT_ANTON, 96)
    draw_wrapped_block(d, top_text.upper(), f, W // 2, 48, W - 120)
    draw_wrapped_block(d, bottom_text.upper(), f, W // 2, H - 60, W - 120,
                       upward=True, anchor="ma")
    return base.convert("RGB")


def render_reaction(mascot, caption) -> Image.Image:
    base = cover(mascot, (W, H)).convert("RGBA")
    # solid caption bar across the bottom
    bar_h = 210
    bar = Image.new("RGBA", (W, bar_h), (12, 11, 9, 235))
    base.alpha_composite(bar, (0, H - bar_h))
    d = ImageDraw.Draw(base)
    # gold hairline above the bar
    d.rectangle([0, H - bar_h, W, H - bar_h + 5], fill=GOLD)
    f = font(FONT_OSWALD, 62, weight=600)
    draw_wrapped_block(d, caption, f, W // 2, H - bar_h + 34, W - 90,
                       fill=CREAM, stroke=(0, 0, 0), anchor="ma", line_gap=1.02)
    return base.convert("RGB")


def render_milestone(mascot, caption) -> Image.Image:
    base = cover(mascot, (W, H)).convert("RGBA")
    base.alpha_composite(gradient_v((W, H), (0, 0, 0, 60), (0, 0, 0, 150)))
    d = ImageDraw.Draw(base)
    # gold banner across the middle
    band_h = 240
    y0 = (H - band_h) // 2
    banner = Image.new("RGBA", (W, band_h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(banner)
    bd.rectangle([0, 0, W, band_h], fill=(14, 12, 9, 205))
    bd.rectangle([0, 0, W, 6], fill=GOLD)
    bd.rectangle([0, band_h - 6, W, band_h], fill=GOLD)
    base.alpha_composite(banner, (0, y0))
    # halo tag: "MILESTONE" flanked by short gold rules (font-safe, no glyphs)
    tag = font(FONT_OSWALD, 40, weight=500)
    tag_txt = "MILESTONE"
    tw = d.textlength(tag_txt, font=tag)
    ty = y0 + 50
    d.text((W // 2, y0 + 30), tag_txt, font=tag, fill=GOLD, anchor="ma")
    rule_gap, rule_len = 26, 70
    lx0 = W // 2 - tw / 2 - rule_gap
    d.line([lx0 - rule_len, ty, lx0, ty], fill=GOLD, width=3)
    rx0 = W // 2 + tw / 2 + rule_gap
    d.line([rx0, ty, rx0 + rule_len, ty], fill=GOLD, width=3)
    f = font(FONT_ANTON, 92)
    draw_wrapped_block(d, caption, f, W // 2, y0 + 92, W - 110, fill=GOLD_HI,
                       stroke=INK, anchor="ma")
    return base.convert("RGB")


def render_chart_teaser(mascot, caption, stats) -> Image.Image:
    """Composite LIVE stats into a gold frame. `stats` must be real (verified)."""
    # mascot fills the top, stats panel sits in a gold frame at the bottom
    base = cover(mascot, (W, H)).convert("RGBA")
    base.alpha_composite(gradient_v((W, H), (0, 0, 0, 40), (0, 0, 0, 120)))
    d = ImageDraw.Draw(base)

    # --- gold frame panel ---
    pad = 46
    panel_h = 430
    px0, py0 = pad, H - panel_h - pad
    px1, py1 = W - pad, H - pad
    panel = Image.new("RGBA", (px1 - px0, py1 - py0), (10, 9, 7, 232))
    base.alpha_composite(panel, (px0, py0))
    # double gold border
    d.rounded_rectangle([px0, py0, px1, py1], radius=26, outline=GOLD, width=6)
    d.rounded_rectangle([px0 + 12, py0 + 12, px1 - 12, py1 - 12],
                        radius=18, outline=GOLD_LO, width=2)

    # --- header ---
    cx = W // 2
    ht = font(FONT_ANTON, 58)
    d.text((cx, py0 + 34), CHART_TITLE, font=ht, fill=GOLD_HI, anchor="ma")
    hs = font(FONT_OSWALD, 34, weight=400)
    d.text((cx, py0 + 104), CHART_SUB, font=hs, fill=CREAM, anchor="ma")

    # --- stat rows ---
    label_f = font(FONT_OSWALD, 34, weight=500)
    value_f = font(FONT_OSWALD, 46, weight=600)
    rows = [
        ("PRICE", _fmt_price(stats.get("price")), CREAM),
        ("MCAP", _fmt_usd(stats.get("mcap")), CREAM),
        ("24H VOL", _fmt_usd(stats.get("vol24")), CREAM),
    ]
    chg = stats.get("chg24")
    rows.append(("24H", _fmt_pct(chg),
                 GREEN if (chg is not None and chg >= 0) else RED))

    row_y = py0 + 168
    row_h = (py1 - 24 - row_y) // len(rows)
    lx = px0 + 46
    rx = px1 - 46
    for i, (label, value, color) in enumerate(rows):
        yy = row_y + i * row_h + row_h // 2
        d.text((lx, yy), label, font=label_f, fill=GOLD, anchor="lm")
        d.text((rx, yy), value, font=value_f, fill=color, anchor="rm")
        if i < len(rows) - 1:
            gy = row_y + (i + 1) * row_h
            d.line([lx, gy, rx, gy], fill=(60, 50, 30, 255), width=1)

    # --- lore caption strip above the panel ---
    cap_f = font(FONT_OSWALD, 38, weight=500)
    d.text((cx, py0 - 20), caption, font=cap_f, fill=GOLD_HI, anchor="md",
           stroke_width=3, stroke_fill=INK)
    return base.convert("RGB")


# --------------------------------------------------------------------------- #
# Batch orchestration
# --------------------------------------------------------------------------- #
BASE_ROTATION = ["classic", "reaction", "milestone", "chart_teaser"]


def build_batch(count, available_templates, ledger):
    """Round-robin templates, choosing a non-repeating caption for each slot."""
    blocked = recent_hashes(ledger)
    plan = []
    ri = 0
    for _ in range(count):
        template = available_templates[ri % len(available_templates)]
        ri += 1
        item, key, h = pick_caption(template, blocked)
        blocked.add(h)  # avoid dup within the same batch too
        plan.append({"template": template, "item": item, "key": key, "hash": h})
    return plan


def stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def render_one(entry, mascot, stats):
    t = entry["template"]
    if t == "classic":
        return render_classic(mascot, entry["item"])
    if t == "reaction":
        return render_reaction(mascot, entry["item"])
    if t == "milestone":
        return render_milestone(mascot, entry["item"])
    if t == "chart_teaser":
        return render_chart_teaser(mascot, entry["item"], stats)
    raise ValueError(f"unknown template {t!r}")


# --------------------------------------------------------------------------- #
# Telegram (optional, env-gated, review-only)
# --------------------------------------------------------------------------- #
def telegram_push(paths, caption_prefix="popeyes batch — eyeball approval"):
    token = os.environ.get("TG_BOT_TOKEN")
    chat = os.environ.get("TG_CHAT_ID")
    if not token or not chat:
        return False  # not configured — silently stay local
    api = f"https://api.telegram.org/bot{token}/sendPhoto"
    ok = 0
    for p in paths:
        try:
            data, content_type = _multipart(
                {"chat_id": chat, "caption": f"{caption_prefix}: {Path(p).name}"},
                {"photo": (Path(p).name, Path(p).read_bytes(), "image/png")},
            )
            req = urllib.request.Request(api, data=data,
                                         headers={"Content-Type": content_type})
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status == 200:
                    ok += 1
        except Exception as e:
            print(f"[telegram] push failed for {Path(p).name}: {e}")
    print(f"[telegram] pushed {ok}/{len(paths)} for manual approval")
    return ok > 0


def _multipart(fields, files):
    boundary = "----popeyes" + hashlib.sha1(str(len(fields)).encode()).hexdigest()[:16]
    crlf = b"\r\n"
    body = bytearray()
    for name, value in fields.items():
        body += b"--" + boundary.encode() + crlf
        body += f'Content-Disposition: form-data; name="{name}"'.encode() + crlf + crlf
        body += str(value).encode() + crlf
    for name, (filename, content, ctype) in files.items():
        body += b"--" + boundary.encode() + crlf
        body += (f'Content-Disposition: form-data; name="{name}"; '
                 f'filename="{filename}"').encode() + crlf
        body += f"Content-Type: {ctype}".encode() + crlf + crlf
        body += content + crlf
    body += b"--" + boundary.encode() + b"--" + crlf
    return bytes(body), f"multipart/form-data; boundary={boundary}"


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main(argv=None):
    ap = argparse.ArgumentParser(description="$POPEYES meme engine")
    ap.add_argument("--count", type=int, default=4, help="how many memes to render")
    ap.add_argument("--template", choices=BASE_ROTATION,
                    help="force a single template instead of round-robin")
    ap.add_argument("--ca", default=CANDIDATE_CA, help="token contract address")
    ap.add_argument("--verify-only", action="store_true",
                    help="run STEP 0 verification and exit")
    ap.add_argument("--no-telegram", action="store_true",
                    help="never attempt telegram even if env is set")
    args = ap.parse_args(argv)

    OUT_DIR.mkdir(exist_ok=True)

    # STEP 0 — always verify first. Determines whether chart_teaser is allowed.
    pair = verify_token(args.ca)
    stats = chart_stats(pair) if pair else None
    chart_ok = stats is not None

    if args.verify_only:
        return 0 if chart_ok else 2

    # Available templates: drop chart_teaser if the token isn't verified/reachable.
    if args.template:
        if args.template == "chart_teaser" and not chart_ok:
            print("[batch] chart_teaser requested but token unverified → nothing to do")
            return 2
        available = [args.template]
    else:
        available = [t for t in BASE_ROTATION if t != "chart_teaser" or chart_ok]
        if not chart_ok:
            print("[batch] chart_teaser excluded from rotation (no live data)")

    mascot = load_mascot()
    ledger = load_ledger()
    plan = build_batch(args.count, available, ledger)

    written = []
    for i, entry in enumerate(plan, 1):
        img = render_one(entry, mascot, stats)
        name = f"{stamp()}_{i:02d}_{entry['template']}.png"
        path = OUT_DIR / name
        img.save(path, "PNG")
        written.append(str(path))
        ledger.append({
            "hash": entry["hash"],
            "template": entry["template"],
            "caption": entry["key"],
            "file": name,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        print(f"[render] {name}  ·  “{entry['key']}”")

    save_ledger(ledger)
    print(f"\n[done] {len(written)} PNG(s) → {OUT_DIR}/  (review manually before posting)")

    if not args.no_telegram:
        telegram_push(written)

    return 0


if __name__ == "__main__":
    sys.exit(main())
