#!/usr/bin/env python3
"""
Draws the placeholder Sukhi Play mascot.

This is ORIGINAL placeholder artwork built from plain geometric shapes so the
project has a usable icon out of the box. It is intentionally generic.

To use your own character art instead, see branding/README.md - you do not need
to run this script at all.

    python3 branding/generate-mascot.py

Requires Pillow:  pip install Pillow
"""
from PIL import Image, ImageDraw, ImageFilter
import os

S, SS = 1024, 4          # final size, supersample factor
W = S * SS

NAVY      = (15, 23, 42, 255)
GLOW      = (37, 78, 190, 255)
SKIN      = (238, 197, 159, 255)
SKIN_SHAD = (214, 170, 130, 255)
HAIR      = (26, 26, 32, 255)
SHIRT     = (125, 200, 240, 255)
CHEEK     = (240, 154, 148, 120)
INK       = (38, 30, 28, 255)

def rounded_mask(size, pad, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=255)
    return m

def draw_mascot(with_background=True):
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad, radius = 40 * SS, 210 * SS

    if with_background:
        d.rounded_rectangle([pad, pad, W - pad, W - pad], radius=radius, fill=NAVY)
        glow = Image.new('RGBA', (W, W), (0, 0, 0, 0))
        r = 330 * SS
        ImageDraw.Draw(glow).ellipse([W/2 - r, W/2 - r, W/2 + r, W/2 + r], fill=GLOW)
        glow = glow.filter(ImageFilter.GaussianBlur(24 * SS))
        img.alpha_composite(glow)
        img.putalpha(Image.composite(img.getchannel('A'),
                                     Image.new('L', img.size, 0),
                                     rounded_mask(W, pad, radius)))
        d = ImageDraw.Draw(img)

    cx = W / 2
    head_cy, head_r = W * 0.50, W * 0.26

    # Shoulders / shirt, behind the head.
    sh_w, sh_top = W * 0.44, W * 0.785
    d.rounded_rectangle([cx - sh_w, sh_top, cx + sh_w, W * 0.95],
                        radius=int(W * 0.14), fill=SHIRT)

    # Ears.
    er = head_r * 0.26
    for side in (-1, 1):
        d.ellipse([cx + side * head_r * 0.95 - er, head_cy - er * 0.6,
                   cx + side * head_r * 0.95 + er, head_cy + er * 1.2], fill=SKIN_SHAD)

    # Face.
    d.ellipse([cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r], fill=SKIN)

    # Patka: a rounded covering over the top of the head, with a small top knot.
    cap_r = head_r * 1.02
    d.pieslice([cx - cap_r, head_cy - cap_r, cx + cap_r, head_cy + cap_r],
               start=182, end=358, fill=HAIR)
    band_w = head_r * 0.995
    d.rectangle([cx - band_w, head_cy - head_r * 0.30, cx + band_w, head_cy - head_r * 0.17], fill=HAIR)
    knot_r = head_r * 0.30
    d.ellipse([cx - knot_r, head_cy - head_r * 1.28,
               cx + knot_r, head_cy - head_r * 1.28 + knot_r * 2], fill=HAIR)

    # Eyes.
    eye_dx, eye_dy, eye_r = head_r * 0.38, head_r * 0.10, head_r * 0.115
    for side in (-1, 1):
        d.ellipse([cx + side * eye_dx - eye_r, head_cy + eye_dy - eye_r,
                   cx + side * eye_dx + eye_r, head_cy + eye_dy + eye_r], fill=INK)
        gr = eye_r * 0.34
        d.ellipse([cx + side * eye_dx - gr + eye_r * 0.3, head_cy + eye_dy - gr - eye_r * 0.25,
                   cx + side * eye_dx + gr + eye_r * 0.3, head_cy + eye_dy + gr - eye_r * 0.25],
                  fill=(255, 255, 255, 235))

    # Cheeks.
    ch_r = head_r * 0.17
    for side in (-1, 1):
        d.ellipse([cx + side * head_r * 0.56 - ch_r, head_cy + head_r * 0.34 - ch_r,
                   cx + side * head_r * 0.56 + ch_r, head_cy + head_r * 0.34 + ch_r], fill=CHEEK)

    # Smile.
    mw, my = head_r * 0.34, head_cy + head_r * 0.40
    d.arc([cx - mw, my - mw * 0.75, cx + mw, my + mw * 0.95],
          start=15, end=165, fill=INK, width=int(head_r * 0.085))

    return img.resize((S, S), Image.LANCZOS)

os.makedirs('build', exist_ok=True)
os.makedirs('branding', exist_ok=True)
os.makedirs('src/renderer/assets', exist_ok=True)

draw_mascot(True).save('build/icon.png')
print('wrote build/icon.png              (app icon, 1024x1024)')

flat = draw_mascot(False)
flat.save('branding/mascot.png')
print('wrote branding/mascot.png         (transparent, 1024x1024)')

flat.resize((512, 512), Image.LANCZOS).save('src/renderer/assets/mascot.png')
print('wrote src/renderer/assets/mascot.png  (in-app, 512x512)')
