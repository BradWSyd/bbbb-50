"""Builds memories.html: one clean photo wall, no years shown.
Edit REMOVE / WIDE / VIDEOS / YOUTUBE below, then run: python3 make_memories.py <repo dir>"""
import os, sys, glob, html
from PIL import Image
REPO = sys.argv[1]
Y = os.path.join(REPO, "assets/years")
REMOVE = {"1976-01", "2007-01", "2009-01", "2013-02", "2016-01", "2020-02"}  # by code from the numbered sheet
WIDE = {"2013-01", "2013-02", "2016-01", "2020-01", "2021-01"}  # invite graphics: full row, not cropped
VIDEOS = {  # code: (mp4, label). Poster is assets/years/<code>.jpg, thumb is thumbs/<code>.webp
    "2018-v1": ("assets/years/2018-v1.mp4", "Video from a past B.B.B.B"),
    "2018-v2": ("assets/years/2018-v2.mp4", "Video from a past B.B.B.B"),
    "2019-v1": ("assets/years/2019-v1.mp4", "Video from a past B.B.B.B"),
    "2022-v1": ("assets/years/2022-v1.mp4", "Video from a past B.B.B.B"),
    "2023-v1": ("assets/years/2023-v1.mp4", "Video from a past B.B.B.B"),
    "2024-v1": ("assets/years/2024-v1.mp4", "Video from a past B.B.B.B"),
    "2024-v2": ("assets/years/2024-v2.mp4", "Video from a past B.B.B.B"),
}
YOUTUBE = {  # code: (YouTube id, label). Plays in the page, no trip to YouTube
    "2025-yt": ("NfplQbyGHl4", "RÜFÜS DU SOL: The Best Birthday Concert Ever"),
}

codes = sorted({os.path.splitext(os.path.basename(f))[0] for f in glob.glob(Y + "/*.webp")} | set(VIDEOS) | set(YOUTUBE))
codes = [c for c in codes if c not in REMOVE]
tiles = []
for i, c in enumerate(codes):
    eager = i < 9
    load = 'loading="eager" fetchpriority="high"' if i < 3 else ('loading="eager"' if eager else 'loading="lazy"')
    if c in YOUTUBE:
        yid, label = YOUTUBE[c]
        tiles.append(f'<button class="tile vid yt" type="button" data-i="{i}" data-youtube="{yid}" aria-label="Play video: {html.escape(label)}">'
                     f'<img src="https://i.ytimg.com/vi/{yid}/maxresdefault.jpg" width="1280" height="720" alt="" {load} decoding="async" '
                     f'onerror="this.onerror=null;this.src=\'https://i.ytimg.com/vi/{yid}/hqdefault.jpg\';this.classList.add(\'hq\')">'
                     f'<span class="play" aria-hidden="true"></span></button>')
        continue
    thumb = f"assets/years/thumbs/{c}.webp"
    w, h = Image.open(os.path.join(REPO, thumb)).size
    if c in VIDEOS:
        src, label = VIDEOS[c]
        tiles.append(f'<button class="tile vid" type="button" data-i="{i}" data-video="{src}" data-poster="assets/years/{c}.jpg" aria-label="Play video: {html.escape(label)}">'
                     f'<img src="{thumb}" width="{w}" height="{h}" alt="" {load} decoding="async"><span class="play" aria-hidden="true"></span></button>')
    else:
        cls = "tile wide" if c in WIDE else "tile"
        alt = "Invitation from a past B.B.B.B" if c in WIDE else "Photo from a past B.B.B.B"
        tiles.append(f'<button class="{cls}" type="button" data-i="{i}" data-full="assets/years/{c}.webp" aria-label="Open photo {i+1}">'
                     f'<img src="{thumb}" width="{w}" height="{h}" alt="{alt}" {load} decoding="async"></button>')

tpl = open(os.path.join(os.path.dirname(__file__), "memories.template.html"), encoding="utf-8").read()
out = tpl.replace("{{TILES}}", "\n    ".join(tiles)).replace("{{COUNT}}", str(len(tiles)))
open(os.path.join(REPO, "memories.html"), "w", encoding="utf-8").write(out)
print(len(tiles), "tiles;", sum(c in WIDE for c in codes), "wide")
