"""Builds memories.html: one clean photo wall, no years shown.
Edit REMOVE / WIDE / VENUES below, then run: python3 make_memories.py <repo dir>"""
import os, sys, glob, html
from PIL import Image
REPO = sys.argv[1]
Y = os.path.join(REPO, "assets/years")
REMOVE = {"1976-01", "2007-01", "2009-01", "2020-02"}          # by code from the numbered sheet
WIDE = {"2013-01", "2013-02", "2016-01", "2020-01", "2021-01"}  # invite graphics: full row, not cropped
VIDEOS = {"2024-ivy": ("assets/years/2024-ivy.mp4", "Troy’s 40th at IVY")}
VENUES = ["Watersedge", "Slide", "Dolphin Hotel", "The Beresford", "Arq", "Port Douglas",
          "Monopole", "The Bourbon", "W Melbourne", "Brown Alley", "Park Hyatt",
          "The Establishment", "Ivy", "Wentworth Bar"]

codes = sorted({os.path.splitext(os.path.basename(f))[0] for f in glob.glob(Y + "/*.webp")} | set(VIDEOS))
codes = [c for c in codes if c not in REMOVE]
tiles = []
for i, c in enumerate(codes):
    thumb = f"assets/years/thumbs/{c}.webp"
    w, h = Image.open(os.path.join(REPO, thumb)).size
    eager = i < 9
    load = 'loading="eager" fetchpriority="high"' if i < 3 else ('loading="eager"' if eager else 'loading="lazy"')
    if c in VIDEOS:
        src, label = VIDEOS[c]
        tiles.append(f'<button class="tile vid" type="button" data-i="{i}" data-video="{src}" data-poster="assets/years/{c}.jpg" aria-label="Play video: {html.escape(label)}">'
                     f'<img src="{thumb}" width="{w}" height="{h}" alt="" {load} decoding="async"><span class="play" aria-hidden="true"></span></button>')
    else:
        cls = "tile wide" if c in WIDE else "tile"
        alt = "Invitation from a past B.B.B.B" if c in WIDE else "Photo from a past B.B.B.B"
        tiles.append(f'<button class="{cls}" type="button" data-i="{i}" data-full="assets/years/{c}.webp" aria-label="Open photo {i+1}">'
                     f'<img src="{thumb}" width="{w}" height="{h}" alt="{alt}" {load} decoding="async"></button>')

venues = " ".join(f"<li>{html.escape(v)}</li>" for v in VENUES)
tpl = open(os.path.join(os.path.dirname(__file__), "memories.template.html"), encoding="utf-8").read()
out = tpl.replace("{{VENUES}}", venues).replace("{{TILES}}", "\n    ".join(tiles)).replace("{{COUNT}}", str(len(tiles)))
open(os.path.join(REPO, "memories.html"), "w", encoding="utf-8").write(out)
print(len(tiles), "tiles;", sum(c in WIDE for c in codes), "wide")
