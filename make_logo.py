"""Draw the MAGGOTS token logo. Run: python make_logo.py
Writes site/maggot.png (1024x1024) and site/maggot_512.png (512x512, for StonkFun upload)."""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

OUT = Path(__file__).parent / "site"
S = 1024
img = Image.new("RGB", (S, S), "#06070a")
d = ImageDraw.Draw(img)

# agar glow
glow = Image.new("RGB", (S, S), "#06070a")
gd = ImageDraw.Draw(glow)
gd.ellipse((140, 140, S - 140, S - 140), fill="#141a24")
glow = glow.filter(ImageFilter.GaussianBlur(90))
img = Image.blend(img, glow, 0.9)
d = ImageDraw.Draw(img)

# plate rim
d.ellipse((92, 92, S - 92, S - 92), outline="#1a1f28", width=4)
d.ellipse((116, 116, S - 116, S - 116), outline="#12161d", width=2)

# larva body: a fat tapered tube, drawn as overlapping circles along a gentle curve
import math
pts = []
for i in range(0, 101):
    t = i / 100
    x = 250 + t * 524
    y = 512 + math.sin(t * math.pi * 1.2) * 46
    r = 78 * (0.55 + 0.45 * math.sin(t * math.pi)) + 8
    pts.append((x, y, r))

# shadow
sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
sd = ImageDraw.Draw(sh)
for x, y, r in pts:
    sd.ellipse((x - r, y - r + 26, x + r, y + r + 26), fill=(0, 0, 0, 120))
sh = sh.filter(ImageFilter.GaussianBlur(22))
img.paste(sh, (0, 0), sh)
d = ImageDraw.Draw(img)

for x, y, r in pts:
    d.ellipse((x - r, y - r, x + r, y + r), fill="#e9dcb8")
# highlight stripe
for x, y, r in pts:
    d.ellipse((x - r * .55, y - r * .78, x + r * .55, y - r * .15), fill="#f6ecd0")
# segment lines
for i in range(8, 100, 12):
    x, y, r = pts[i]
    d.arc((x - r * .35, y - r, x + r * .35, y + r), 250, 470, fill="#b8a985", width=4)
# mouth hooks (anterior, left end)
x0, y0, r0 = pts[0]
d.line((x0 - 6, y0 - 10, x0 - 44, y0 - 26), fill="#3a3126", width=9)
d.line((x0 - 6, y0 + 10, x0 - 44, y0 + 26), fill="#3a3126", width=9)
# posterior spiracles (right end)
x1, y1, r1 = pts[-1]
d.ellipse((x1 - 4, y1 - 20, x1 + 10, y1 - 6), fill="#3a3126")
d.ellipse((x1 - 4, y1 + 6, x1 + 10, y1 + 20), fill="#3a3126")

img.save(OUT / "maggot.png")
img.resize((512, 512), Image.LANCZOS).save(OUT / "maggot_512.png")
print("wrote", OUT / "maggot.png", "and maggot_512.png")
