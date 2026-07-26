#!/usr/bin/env python3
"""Tufte-style signatory relationship graphics: matrix, small multiples, hub panels."""

from __future__ import annotations

import csv
import hashlib
import math
import shutil
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib import colors as mcolors
from PIL import Image, ImageDraw, ImageFont

BASE_IMAGE = Path("/opt/cursor/artifacts/nvidia-signatories-base.png")
EDGES_CSV = Path("/workspace/data/signatories/signatories-edges-only.csv")
FULL_CSV = Path("/workspace/data/signatories/signatories-full-data.csv")
OUT_DIR = Path("/opt/cursor/artifacts")

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

SIGNATORIES = [name for row in GRID for name in row]
SKIP_SUBTYPES = {"corporate_1hop_inbound", "external_investor_1hop"}

GRID_TOP = 568
GRID_BOTTOM = 1458
GRID_LEFT = 52
GRID_RIGHT = 1040

CREAM = "#FFF9F2"
INK = "#1a1a1a"
MUTED = "#666666"

FAMILY_COLORS = {
    "corp": "#1d4ed8",
    "ceo_1hop": "#7c3aed",
    "ceo_2hop": "#c2410c",
    "gov": "#047857",
}

SHORT_NAMES = {
    "American Innovators Network": "AIN",
    "Andreessen Horowitz": "a16z",
    "Black Forest Labs": "BFL",
    "Dell Technologies": "Dell",
    "Emergence Capital": "Emergence",
    "Hugging Face": "HF",
    "Interconnects AI": "Interconnects",
    "Linux Foundation": "Linux Fdn",
    "Mariana Minerals": "Mariana",
    "Palo Alto Networks": "PANW",
    "Periodic Labs": "Periodic",
    "Prime Intellect": "Prime",
    "Nous Research": "Nous",
    "Y Combinator": "YC",
    "Fireworks AI": "Fireworks",
    "Arcee AI": "Arcee",
}

HUBS = [
    "NVIDIA",
    "Andreessen Horowitz",
    "Y Combinator",
    "Google",
    "Microsoft",
    "AMP",
]

PANELS = [
    ("corp", "Corporate / CVC equity", lambda e: e["family"] == "corp"),
    ("ceo_1hop", "CEO 1-hop", lambda e: e["family"] == "ceo_1hop"),
    ("ceo_2hop", "CEO 2-hop via fund", lambda e: e["family"] == "ceo_2hop"),
    ("gov", "Governance interlock", lambda e: e["family"] == "gov"),
]


def short_name(name: str) -> str:
    return SHORT_NAMES.get(name, name)


def edge_family(edge: dict) -> str:
    if edge["degree"] == "gov":
        return "gov"
    if edge["kind"] == "corp":
        return "corp"
    if edge["degree"] == "2":
        return "ceo_2hop"
    return "ceo_1hop"


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

            kind = "corp" if row["actor_type"] == "organization" else "leader"
            degree = row["degree"] or "1"
            key = (src, tgt, kind, degree)
            if key in seen:
                continue
            seen.add(key)
            edge = {
                "src": src,
                "tgt": tgt,
                "kind": kind,
                "degree": degree,
                "subtype": row["relationship_subtype"],
            }
            edge["family"] = edge_family(edge)
            edges.append(edge)

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
                    "family": "gov",
                }
            )

    return edges


def sorted_signatories(edges: list[dict]) -> list[str]:
    out_degree = Counter(e["src"] for e in edges)
    in_degree = Counter(e["tgt"] for e in edges)
    return sorted(
        SIGNATORIES,
        key=lambda s: (-(out_degree[s] + in_degree[s]), -out_degree[s], s),
    )


def build_positions() -> dict[str, tuple[float, float]]:
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


def write_hero() -> Path:
    out = OUT_DIR / "signatories-hero.png"
    shutil.copy2(BASE_IMAGE, out)
    return out


def render_matrix(edges: list[dict], order: list[str]) -> Path:
    idx = {name: i for i, name in enumerate(order)}
    cell_types: dict[tuple[int, int], set[str]] = defaultdict(set)
    for e in edges:
        cell_types[(idx[e["src"]], idx[e["tgt"]])].add(e["family"])

    n = len(order)
    matrix = [[0] * n for _ in range(n)]
    family_rank = {"corp": 4, "ceo_1hop": 3, "ceo_2hop": 2, "gov": 1}
    for (r, c), families in cell_types.items():
        matrix[r][c] = max(family_rank[f] for f in families)

    cmap = mcolors.ListedColormap([CREAM, FAMILY_COLORS["gov"], FAMILY_COLORS["ceo_2hop"],
                                   FAMILY_COLORS["ceo_1hop"], FAMILY_COLORS["corp"]])
    bounds = [-0.5, 0.5, 1.5, 2.5, 3.5, 4.5]
    norm = mcolors.BoundaryNorm(bounds, cmap.N)

    fig_w = 16
    fig_h = 14
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), facecolor=CREAM)
    ax.set_facecolor(CREAM)
    im = ax.imshow(matrix, cmap=cmap, norm=norm, aspect="equal")

    labels = [short_name(s) for s in order]
    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    ax.set_xticklabels(labels, rotation=90, fontsize=6.5, color=INK)
    ax.set_yticklabels(labels, fontsize=6.5, color=INK)
    ax.tick_params(length=0, pad=2)
    ax.set_xlabel("Investee / target signatory", fontsize=10, color=INK, labelpad=8)
    ax.set_ylabel("Investor / source signatory", fontsize=10, color=INK, labelpad=8)
    ax.set_title(
        "Cross-signatory relationship matrix (sorted by total connectivity)",
        fontsize=13,
        color=INK,
        pad=12,
        loc="left",
        fontweight="normal",
    )

    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.grid(False)

    legend_patches = [
        mpatches.Patch(color=FAMILY_COLORS["corp"], label="Corporate / CVC"),
        mpatches.Patch(color=FAMILY_COLORS["ceo_1hop"], label="CEO 1-hop"),
        mpatches.Patch(color=FAMILY_COLORS["ceo_2hop"], label="CEO 2-hop"),
        mpatches.Patch(color=FAMILY_COLORS["gov"], label="Governance"),
    ]
    ax.legend(handles=legend_patches, loc="upper right", frameon=False, fontsize=8)

  # marginal totals
    out_counts = [sum(1 for e in edges if e["src"] == s) for s in order]
    in_counts = [sum(1 for e in edges if e["tgt"] == s) for s in order]
    with_ties = sum(1 for o, i in zip(out_counts, in_counts) if o or i)
    isolated = n - with_ties
    note = (
        f"{len(edges)} relationships · {with_ties} signatories with ties · {isolated} isolated"
    )
    fig.text(0.02, 0.01, note, fontsize=8, color=MUTED)

    out = OUT_DIR / "signatories-matrix.png"
    fig.savefig(out, dpi=180, facecolor=CREAM, bbox_inches="tight", pad_inches=0.35)
    plt.close(fig)
    return out


def render_family_matrices(edges: list[dict], order: list[str]) -> Path:
    idx = {name: i for i, name in enumerate(order)}
    labels = [short_name(s) for s in order]
    n = len(order)

    fig, axes = plt.subplots(2, 2, figsize=(16, 14), facecolor=CREAM)
    fig.suptitle(
        "Relationship families (small multiples)",
        fontsize=13,
        color=INK,
        x=0.02,
        ha="left",
        fontweight="normal",
    )

    for ax, (family, title, _) in zip(axes.flat, PANELS):
        ax.set_facecolor(CREAM)
        matrix = [[0] * n for _ in range(n)]
        for e in edges:
            if e["family"] != family:
                continue
            matrix[idx[e["src"]]][idx[e["tgt"]]] = 1
        ax.imshow(matrix, cmap=mcolors.ListedColormap([CREAM, FAMILY_COLORS[family]]),
                  vmin=0, vmax=1, aspect="equal")
        ax.set_xticks(range(n))
        ax.set_yticks(range(n))
        ax.set_xticklabels(labels, rotation=90, fontsize=5, color=INK)
        ax.set_yticklabels(labels, fontsize=5, color=INK)
        ax.tick_params(length=0, pad=1)
        ax.set_title(title, fontsize=10, color=INK, loc="left", pad=6)
        for spine in ax.spines.values():
            spine.set_visible(False)

    fig.subplots_adjust(wspace=0.25, hspace=0.45, top=0.94, bottom=0.08, left=0.08, right=0.98)
    out = OUT_DIR / "signatories-matrix-multiples.png"
    fig.savefig(out, dpi=180, facecolor=CREAM, bbox_inches="tight", pad_inches=0.3)
    plt.close(fig)
    return out


def control_points(start, end, edge_id: str):
    sx, sy = start
    ex, ey = end
    dx, dy = ex - sx, ey - sy
    dist = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / dist, dx / dist
    h = int(hashlib.md5(edge_id.encode()).hexdigest(), 16)
    sign = 1 if h % 2 else -1
    offset = sign * dist * (0.12 + (h % 11) / 90)
    c1 = (sx + dx * 0.25 + nx * offset, sy + dy * 0.25 + ny * offset)
    c2 = (sx + dx * 0.75 + nx * offset, sy + dy * 0.75 + ny * offset)
    return c1, c2


def cubic_bezier(t, p0, p1, p2, p3):
    u = 1 - t
    return (
        u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
        u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
    )


def draw_hub_marker(
    overlay: Image.Image,
    point: tuple[float, float],
    label: str,
    *,
    scale: float = 1.0,
):
    x, y = point
    draw = ImageDraw.Draw(overlay, "RGBA")
    r = int(18 * scale) if scale < 1 else 22
    draw.ellipse((x - r, y - r, x + r, y + r), outline=(220, 38, 38, 255), width=4)
    draw.ellipse((x - r + 5, y - r + 5, x + r - 5, y + r - 5), outline=(220, 38, 38, 120), width=2)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", max(10, int(12 * scale)))
    tw = draw.textlength(label, font=font)
    pad = 4
    tag_w, tag_h = tw + pad * 2, 14
    tag_x, tag_y = x - tag_w / 2, y - r - tag_h - 4
    draw.rounded_rectangle(
        (tag_x, tag_y, tag_x + tag_w, tag_y + tag_h),
        radius=3,
        fill=(220, 38, 38, 230),
    )
    draw.text((tag_x + pad, tag_y + 1), label, fill="white", font=font)


def draw_edges_on_base(
    base: Image.Image,
    edges: list[dict],
    *,
    scale: float = 1.0,
    width: int = 4,
    dashed_families: set[str] | None = None,
    highlight_src: str | None = None,
) -> Image.Image:
    dashed_families = dashed_families or {"ceo_2hop", "gov"}
    positions = build_positions()
    w, h = base.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    if scale != 1.0:
        positions = {k: (v[0] * scale, v[1] * scale) for k, v in positions.items()}

    for edge in edges:
        if edge["src"] not in positions or edge["tgt"] not in positions:
            continue
        start = positions[edge["src"]]
        end = positions[edge["tgt"]]
        color_hex = FAMILY_COLORS[edge["family"]]
        rgb = tuple(int(color_hex[i:i + 2], 16) for i in (1, 3, 5))
        alpha = 235 if edge["src"] == highlight_src else 190
        color = (*rgb, alpha)
        edge_id = f"{edge['src']}|{edge['tgt']}|{edge['family']}"
        c1, c2 = control_points(start, end, edge_id)
        points = [cubic_bezier(t / 40, start, c1, c2, end) for t in range(41)]
        stroke = width + (1 if edge["src"] == highlight_src else 0)

        if edge["family"] in dashed_families:
            for i in range(0, len(points) - 1, 2):
                draw.line([points[i], points[i + 1]], fill=color, width=stroke, joint="curve")
        else:
            draw.line(points, fill=color, width=stroke, joint="curve")

        tx, ty = points[-1]
        px, py = points[-4]
        ang = math.atan2(ty - py, tx - px)
        size = 8 + stroke
        left = (tx - size * math.cos(ang - 0.45), ty - size * math.sin(ang - 0.45))
        right = (tx - size * math.cos(ang + 0.45), ty - size * math.sin(ang + 0.45))
        draw.polygon([points[-1], left, right], fill=color[:3])

    if highlight_src and highlight_src in positions:
        draw_hub_marker(overlay, positions[highlight_src], short_name(highlight_src), scale=scale)

    return Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")


def render_grid_multiples(edges: list[dict]) -> Path:
    base_full = Image.open(BASE_IMAGE).convert("RGB")
    panel_w, panel_h = base_full.size[0] // 2, base_full.size[1] // 2
    canvas = Image.new("RGB", (base_full.size[0], base_full.size[1] + 80), CREAM)
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 28)
    label_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    draw.text((36, 18), "Signatory grid by relationship family", fill=INK, font=title_font)

    for i, (family, title, pred) in enumerate(PANELS):
        col, row = i % 2, i // 2
        subset = [e for e in edges if pred(e)]
        panel_base = base_full.resize((panel_w, panel_h), Image.Resampling.LANCZOS)
        panel = draw_edges_on_base(panel_base, subset, scale=0.5, width=3)
        x0 = col * panel_w
        y0 = 80 + row * panel_h
        canvas.paste(panel, (x0, y0))
        draw.text((x0 + 12, y0 + 8), f"{title} ({len(subset)})", fill=INK, font=label_font)

    out = OUT_DIR / "signatories-grid-multiples.png"
    canvas.save(out, format="PNG", optimize=True)
    return out


def render_hub_panels(edges: list[dict]) -> Path:
    base_full = Image.open(BASE_IMAGE).convert("RGB")
    panel_w, panel_h = base_full.size[0] // 2, base_full.size[1] // 2
    canvas = Image.new("RGB", (panel_w * 3, panel_h * 2 + 80), CREAM)
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 28)
    label_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    draw.text((36, 18), "Hub-centric ego networks (outbound only)", fill=INK, font=title_font)

    for i, hub in enumerate(HUBS):
        col, row = i % 3, i // 3
        subset = [e for e in edges if e["src"] == hub]
        panel_base = base_full.resize((panel_w, panel_h), Image.Resampling.LANCZOS)
        panel = draw_edges_on_base(panel_base, subset, scale=0.5, width=4, highlight_src=hub)
        x0 = col * panel_w
        y0 = 80 + row * panel_h
        canvas.paste(panel, (x0, y0))
        draw.text(
            (x0 + 12, y0 + 8),
            f"{short_name(hub)} → {len(subset)} ties",
            fill=INK,
            font=label_font,
        )

    out = OUT_DIR / "signatories-hub-networks.png"
    canvas.save(out, format="PNG", optimize=True)
    return out


def render_marginal_counts(edges: list[dict], order: list[str]) -> Path:
    base = Image.open(BASE_IMAGE).convert("RGBA")
    w, h = base.size
    margin = 56
    canvas = Image.new("RGB", (w + margin * 2, h), CREAM)
    canvas.paste(base.convert("RGB"), (margin, 0))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
    positions = build_positions()

    out_counts = Counter(e["src"] for e in edges)
    in_counts = Counter(e["tgt"] for e in edges)

    for name, (cx, cy) in positions.items():
        out_n = out_counts[name]
        in_n = in_counts[name]
        if out_n:
            draw.text((8, int(cy) - 5), str(out_n), fill=FAMILY_COLORS["corp"], font=font)
        if in_n:
            draw.text((w + margin + 10, int(cy) - 5), str(in_n), fill=MUTED, font=font)

    title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
    draw.text((8, 12), "out", fill=FAMILY_COLORS["corp"], font=title_font)
    draw.text((w + margin + 10, 12), "in", fill=MUTED, font=title_font)

    out_path = OUT_DIR / "signatories-marginal-counts.png"
    canvas.save(out_path, format="PNG", optimize=True)
    return out_path


def main():
    edges = load_edges()
    order = sorted_signatories(edges)
    outputs = [
        write_hero(),
        render_matrix(edges, order),
        render_family_matrices(edges, order),
        render_grid_multiples(edges),
        render_hub_panels(edges),
        render_marginal_counts(edges, order),
    ]
    for path in outputs:
        print(f"Wrote {path} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
