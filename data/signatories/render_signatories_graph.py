#!/usr/bin/env python3
"""Render coalition relationship overlay on the official NVIDIA 50-signatory image."""

from __future__ import annotations

import csv
import hashlib
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BASE_IMAGE = Path("/opt/cursor/artifacts/nvidia-signatories-base.png")
EDGES_CSV = Path("/workspace/data/signatories/signatories-edges-only.csv")
FULL_CSV = Path("/workspace/data/signatories/signatories-full-data.csv")
OUTPUT = Path("/opt/cursor/artifacts/signatories-investment-network.png")

GRID = [
    ["AI21", "AMD", "American Innovators Network", "AMP", "Andreessen Horowitz"],
    ["Arcee AI", "Arena", "Baseten", "Black Forest Labs", "Block"],
    ["Box", "Cisco", "Cloudflare", "Cohere", "CrowdStrike"],
    ["Dell Technologies", "DoorDash", "Emergence Capital", "Fireworks AI", "Genspark"],
    ["GitHub", "Google", "Hugging Face", "IBM", "Inferact"],
    ["Interconnects AI", "Linux Foundation", "Mariana Minerals", "Meta", "Microsoft"],
    ["Mistral", "Morph", "Mozilla", "Nebius", "Nous Research"],
    ["NVIDIA", "Ollama", "OpenAI", "OpenClaw", "Palantir"],
    ["Palo Alto Networks", "Periodic Labs", "Perplexity", "Prime Intellect", "Reflection"],
    ["Replit", "ServiceNow", "Telnyx", "Trajectory", "Y Combinator"],
]

SKIP_SUBTYPES = {"corporate_1hop_inbound", "external_investor_1hop"}

# Layout tuned to the 1092x1502 NVIDIA signatories artwork.
GRID_TOP = 568
GRID_BOTTOM = 1458
GRID_LEFT = 52
GRID_RIGHT = 1040

EDGE_COLOR = (30, 86, 200, 130)
EDGE_COLOR_2HOP = (30, 86, 200, 95)
AVATAR_BG = (255, 255, 255, 230)
LEADER_RING = (37, 99, 235, 255)
ORG_RING = (180, 83, 9, 255)


def build_positions(width: int, height: int) -> dict[str, tuple[float, float]]:
  rows, cols = len(GRID), len(GRID[0])
  cell_w = (GRID_RIGHT - GRID_LEFT) / cols
  cell_h = (GRID_BOTTOM - GRID_TOP) / rows
  pos: dict[str, tuple[float, float]] = {}
  for r, row in enumerate(GRID):
    for c, name in enumerate(row):
      cx = GRID_LEFT + (c + 0.5) * cell_w
      cy = GRID_TOP + (r + 0.5) * cell_h
      pos[name] = (cx, cy)
  return pos


def avatar_points(center: tuple[float, float]) -> tuple[tuple[float, float], tuple[float, float]]:
  cx, cy = center
  leader = (cx - 38, cy - 30)
  org = (cx + 38, cy + 30)
  return leader, org


def load_edges() -> list[dict]:
  edges: list[dict] = []
  seen: set[tuple] = set()

  with EDGES_CSV.open() as f:
    for row in csv.DictReader(f):
      if row["relationship_subtype"] in SKIP_SUBTYPES:
        continue
      if row["target_is_coalition_signatory"] != "yes":
        continue
      src = row["source_signatory"]
      tgt = row["target_signatory"]
      if not src or not tgt or src == tgt:
        continue

      if row["actor_type"] == "organization":
        kind = "corp"
        degree = row["degree"] or "1"
      else:
        kind = "leader"
        degree = row["degree"] or "1"

      key = (src, tgt, kind, degree)
      if key in seen:
        continue
      seen.add(key)
      edges.append(
        {
          "src": src,
          "tgt": tgt,
          "kind": kind,
          "degree": degree,
          "subtype": row["relationship_subtype"],
        }
      )

  with FULL_CSV.open() as f:
    for row in csv.DictReader(f):
      if row["record_type"] != "research_annotation":
        continue
      if row["relationship_subtype"] != "board_interlock_not_equity":
        continue
      src = row["source_signatory"]
      tgt = "Meta"
      if not src or src == tgt:
        continue
      key = (src, tgt, "leader", "gov")
      if key in seen:
        continue
      seen.add(key)
      edges.append(
        {
          "src": src,
          "tgt": tgt,
          "kind": "leader",
          "degree": "gov",
          "subtype": "board_interlock",
        }
      )

  return edges


def edge_style(edge: dict) -> tuple[tuple[int, int, int, int], bool, float]:
  if edge["degree"] in {"2", "gov"}:
    return EDGE_COLOR_2HOP, True, 1.6
  return EDGE_COLOR, False, 2.0


def control_points(
  start: tuple[float, float], end: tuple[float, float], edge_id: str
) -> tuple[tuple[float, float], tuple[float, float]]:
  sx, sy = start
  ex, ey = end
  dx, dy = ex - sx, ey - sy
  dist = math.hypot(dx, dy) or 1.0
  nx, ny = -dy / dist, dx / dist
  h = int(hashlib.md5(edge_id.encode()).hexdigest(), 16)
  sign = 1 if h % 2 else -1
  spread = 0.18 + (h % 17) / 80
  offset = sign * dist * spread
  mx, my = (sx + ex) / 2, (sy + ey) / 2
  c1 = (sx + dx * 0.25 + nx * offset, sy + dy * 0.25 + ny * offset)
  c2 = (sx + dx * 0.75 + nx * offset, sy + dy * 0.75 + ny * offset)
  return c1, c2


def cubic_bezier(t: float, p0, p1, p2, p3):
  u = 1 - t
  x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
  y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
  return (x, y)


def draw_arrow(draw: ImageDraw.ImageDraw, tip, prev, color, width: float):
  tx, ty = tip
  px, py = prev
  ang = math.atan2(ty - py, tx - px)
  size = 7 + width
  left = (tx - size * math.cos(ang - 0.45), ty - size * math.sin(ang - 0.45))
  right = (tx - size * math.cos(ang + 0.45), ty - size * math.sin(ang + 0.45))
  draw.polygon([tip, left, right], fill=color[:3])


def draw_edge(draw: ImageDraw.ImageDraw, start, end, edge: dict):
  edge_id = f"{edge['src']}|{edge['tgt']}|{edge['kind']}|{edge['degree']}"
  color, dashed, width = edge_style(edge)
  c1, c2 = control_points(start, end, edge_id)
  points = [cubic_bezier(t / 48, start, c1, c2, end) for t in range(49)]

  if dashed:
    for i in range(0, len(points) - 1, 2):
      draw.line([points[i], points[i + 1]], fill=color, width=int(width), joint="curve")
  else:
    draw.line(points, fill=color, width=int(width), joint="curve")

  draw_arrow(draw, points[-1], points[-4], color, width)


EMOJI_FONT_PATH = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
EMOJI_FONT_SIZE = 109


def emoji_image(symbol: str, size: int = 18) -> Image.Image:
  font = ImageFont.truetype(EMOJI_FONT_PATH, EMOJI_FONT_SIZE)
  canvas = Image.new("RGBA", (EMOJI_FONT_SIZE, EMOJI_FONT_SIZE), (0, 0, 0, 0))
  draw = ImageDraw.Draw(canvas)
  tw, th = draw.textbbox((0, 0), symbol, font=font)[2:]
  draw.text(
    ((EMOJI_FONT_SIZE - tw) / 2, (EMOJI_FONT_SIZE - th) / 2 - 4),
    symbol,
    font=font,
    embedded_color=True,
  )
  return canvas.resize((size, size), Image.Resampling.LANCZOS)


def draw_avatar(
  overlay: Image.Image,
  point: tuple[float, float],
  symbol: str,
  ring_color: tuple[int, int, int, int],
):
  x, y = point
  r = 13
  draw = ImageDraw.Draw(overlay, "RGBA")
  bbox = (x - r, y - r, x + r, y + r)
  draw.ellipse(bbox, fill=AVATAR_BG, outline=ring_color, width=2)
  icon = emoji_image(symbol, size=16)
  overlay.paste(icon, (int(x - 8), int(y - 8)), icon)


def main():
  base = Image.open(BASE_IMAGE).convert("RGBA")
  positions = build_positions(*base.size)
  edges = load_edges()

  overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
  draw = ImageDraw.Draw(overlay, "RGBA")

  for edge in edges:
    if edge["src"] not in positions or edge["tgt"] not in positions:
      continue
    leader_pt, org_pt = avatar_points(positions[edge["src"]])
    _, target_org = avatar_points(positions[edge["tgt"]])
    start = org_pt if edge["kind"] == "corp" else leader_pt
    draw_edge(draw, start, target_org, edge)

  for center in positions.values():
    leader_pt, org_pt = avatar_points(center)
    draw_avatar(overlay, leader_pt, "👤", LEADER_RING)
    draw_avatar(overlay, org_pt, "🏢", ORG_RING)

  out = Image.alpha_composite(base, overlay).convert("RGB")
  out.save(OUTPUT, format="PNG", optimize=True)
  print(f"Wrote {OUTPUT} ({out.size[0]}x{out.size[1]}) with {len(edges)} edges")


if __name__ == "__main__":
  main()
