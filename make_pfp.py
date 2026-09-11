"""Point-cloud larva in the flybrain pfp style: sparse white / pale-blue stipple on pure black, side view,
lit from the upper front so the tube reads as a body, bright rim, segment rings.
Run: python make_pfp.py  ->  launch/pfp_maggot.png (1024), launch/pfp_maggot_400.png, launch/banner_maggot.png (1500x500), launch/banner_black.png"""
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

random.seed(3013)
OUT = Path(__file__).parent / "launch"; OUT.mkdir(exist_ok=True)
SEGS = 11

def radius(t):
    base = 0.30 * math.sin(math.pi * (0.05 + 0.90 * t)) ** 0.8 + 0.03
    ridge = 1 + 0.035 * math.cos(t * math.pi * 2 * SEGS)
    return base * ridge

def spine(t):  # z offset of the body axis: a gentle banana curve, head slightly down
    return 0.09 * math.sin(math.pi * t) - 0.05 * t ** 3

def surface_points(n):
    pts = []
    for _ in range(n):
        t = random.random(); x = -1 + 2 * t
        th = random.random() * 2 * math.pi
        r = radius(t)
        # surface normal (ignoring taper): radial direction
        ny, nz = math.cos(th), math.sin(th)
        pts.append((x, r * ny, r * nz + spine(t), ny, nz, "body"))
    # segment rings: a denser line of dots at each boundary
    for k in range(1, SEGS):
        t = k / SEGS
        for _ in range(260):
            th = random.random() * 2 * math.pi
            r = radius(t) * 0.985
            pts.append((-1 + 2 * t + random.gauss(0, 0.003), r * math.cos(th), r * math.sin(th) + spine(t), math.cos(th), math.sin(th), "ring"))
    # mouth hooks: two short curved spikes at the head, drawn bright so they read on black
    for sgn in (1, -1):
        for _ in range(420):
            u = random.random()
            x = 1.0 + u * 0.09 * (1 - 0.5 * u); y = sgn * (0.02 + u * 0.015); z = spine(1.0) - 0.01 - u * 0.11 * u
            pts.append((x + random.gauss(0, 0.003), y + random.gauss(0, 0.003), z + random.gauss(0, 0.003), 0.0, 1.0, "hook"))
    # posterior spiracles at the tail
    for sgn in (1, -1):
        for _ in range(260):
            u = random.random()
            pts.append((-1.0 - u * 0.025 + random.gauss(0, 0.003), sgn * 0.04 + random.gauss(0, 0.004), spine(0) + 0.03 + u * 0.015 + random.gauss(0, 0.004), 0.0, 1.0, "spir"))
    # anterior spiracles: little fans on the sides behind the head
    for sgn in (1, -1):
        for _ in range(160):
            u = random.random()
            pts.append((0.80 + random.gauss(0, 0.008), sgn * (radius(0.9) * 0.95 + u * 0.04), spine(0.9) + 0.06 + u * 0.04 + random.gauss(0, 0.004), sgn * 1.0, 0.3, "spir"))
    return pts

def render(size, pts, scale, cx, cy, yaw=-0.25, tilt=0.30, dot=1):
    W, H = size
    img = Image.new("RGB", size, (0, 0, 0)); d = ImageDraw.Draw(img)
    glow = Image.new("RGB", size, (0, 0, 0)); g = ImageDraw.Draw(glow)
    cy_, sy_ = math.cos(yaw), math.sin(yaw); ct, st = math.cos(tilt), math.sin(tilt)
    # light from upper front-left, view along +depth
    L = (-0.35, 0.55, 0.75); Ln = math.sqrt(sum(c * c for c in L)); L = tuple(c / Ln for c in L)
    proj = []
    for (x, y, z, ny, nz, kind) in pts:
        # rotate about the vertical axis (yaw), then tilt the camera down (tilt)
        X = x * cy_ - y * sy_; Y = x * sy_ + y * cy_            # Y = depth toward viewer
        Z = z * ct - Y * st; Yd = z * st + Y * ct
        nX = -ny * sy_; nY = ny * cy_; nZ = nz                   # normal, same rotation (x-component of normal is ~0)
        nZ2 = nZ * ct - nY * st; nY2 = nZ * st + nY * ct
        proj.append((Yd, X, Z, nX, nY2, nZ2, kind))
    proj.sort(key=lambda p: p[0])
    for (depth, X, Z, nX, nY, nZ, kind) in proj:
        px = cx + X * scale; py = cy - Z * scale
        dn = max(0.0, min(1.0, (depth + 0.4) / 0.8))
        if kind in ("body", "ring"):
            lam = max(0.0, nX * L[0] + nY * L[1] + nZ * L[2])          # lambert
            rim = (1 - abs(nY)) ** 3                                     # facing sideways = silhouette
            b = 0.30 + 0.70 * lam + 0.55 * rim
            if kind == "ring": b = min(1.0, b + 0.25)
            b *= 0.55 + 0.45 * dn
            if nY < -0.15 and kind == "body": b *= 0.45                  # back-facing surface stays fainter
            b = max(0.0, min(1.0, b))
            col = (int(40 + 215 * b), int(55 + 200 * b), int(75 + 180 * b))
            big = random.random() < 0.10 and b > 0.6
        elif kind == "hook":
            col = (170, 195, 215); big = False
        else:
            col = (200, 225, 240); big = False
        sz = dot + (1 if big else 0)
        if sz <= 1: d.point((px, py), fill=col)
        else: d.rectangle((px, py, px + sz - 1, py + sz - 1), fill=col)
        if kind != "hook" and random.random() < 0.05 and col[0] > 150: g.point((px, py), fill=(40, 70, 95))
    glow = glow.filter(ImageFilter.GaussianBlur(5))
    return ImageChops.add(img, glow)

pts = surface_points(13000)
S = 1024
pfp = render((S, S), pts, scale=S * 0.38, cx=S * 0.50, cy=S * 0.52, dot=2)
pfp.save(OUT / "pfp_maggot.png")
render((400, 400), pts, scale=400 * 0.38, cx=200, cy=208, dot=1).save(OUT / "pfp_maggot_400.png")
banner = render((1500, 500), pts, scale=180, cx=1500 * 0.80, cy=500 * 0.55, dot=1)
banner.save(OUT / "banner_maggot.png")
Image.new("RGB", (1500, 500), (0, 0, 0)).save(OUT / "banner_black.png")
print("wrote pfp_maggot.png, pfp_maggot_400.png, banner_maggot.png, banner_black.png in", OUT)
