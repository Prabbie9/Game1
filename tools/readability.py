# Readability + exposure proxies for captures (LOOK/FUN gate). python3 tools/readability.py img...
# - crushed%: pixels with luma < 2/255; clipped%: luma > 253/255
# - roadContrast: mean local RMS contrast (16px blocks) in the lower 55% of frame (where road/obstacles are)
# - edgeDensity: share of lower-half pixels with Sobel magnitude > 0.08 (edges you can steer by)
import sys, json
from PIL import Image, ImageFilter
import statistics as st
for p in sys.argv[1:]:
    im = Image.open(p).convert('L'); w, h = im.size
    px = list(im.getdata()); n = len(px)
    crushed = sum(1 for v in px if v < 2) / n * 100; clipped = sum(1 for v in px if v > 253) / n * 100
    low = im.crop((0, int(h * 0.45), w, h))
    lw, lh = low.size; lp = low.load(); cons = []
    for by in range(0, lh - 16, 16):
        for bx in range(0, lw - 16, 16):
            vals = [lp[x, y] / 255 for y in range(by, by + 16, 2) for x in range(bx, bx + 16, 2)]
            m = sum(vals) / len(vals)
            cons.append((sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5 / (m + 0.05))
    edges = low.filter(ImageFilter.FIND_EDGES); ed = list(edges.getdata())
    print(json.dumps({'img': p.split('/')[-1], 'meanLuma': round(sum(px) / n / 255, 3), 'crushedPct': round(crushed, 2), 'clippedPct': round(clipped, 2),
                      'roadContrast': round(sum(cons) / len(cons), 3), 'edgeDensityPct': round(sum(1 for v in ed if v > 20) / len(ed) * 100, 2)}))
