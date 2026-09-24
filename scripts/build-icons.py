#!/usr/bin/env python3
"""
The app icons: Sukhi grinning out of his red engine on a sky and grass tile.

    python3 scripts/build-icons.py

Writes public/icon-192.png, icon-512.png, the maskable pair (the same picture
kept inside the middle 80%, which is all a maskable icon promises to show),
apple-touch-icon.png and favicon-64.png. Drawn at 1024 and scaled down.
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, '..', 'public')
FACE = os.path.join(HERE, '..', 'src', 'assets', 'sukhi', 'grin.webp')


def picture(size, inset=1.0, rounded=True):
    s = 1024
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle((0, 0, s, s), radius=220, fill='#DDF0FF')
    else:
        d.rectangle((0, 0, s, s), fill='#DDF0FF')
    k = inset
    o = (1 - k) * s / 2
    P = lambda x, y: (o + x * k, o + y * k)
    # Grass, and the track along it.
    d.rectangle((0, o + 700 * k, s, s), fill='#BDE59A') if not rounded else d.rounded_rectangle((0, o + 700 * k, s, s), radius=220, fill='#BDE59A')
    if rounded:
        d.rectangle((0, o + 700 * k, s, o + 900 * k), fill='#BDE59A')
    d.rectangle((*P(0, 760), *P(1024, 840)), fill='#C99A6B')
    d.rectangle((*P(0, 772), *P(1024, 786)), fill='#6B4A2F')
    d.rectangle((*P(0, 814), *P(1024, 828)), fill='#6B4A2F')
    # The engine: boiler, cab, chimney, wheels.
    d.rounded_rectangle((*P(150, 520), *P(640, 760)), radius=int(60 * k), fill='#E8453C')
    d.rounded_rectangle((*P(560, 380), *P(860, 760)), radius=int(50 * k), fill='#C7322B')
    d.rounded_rectangle((*P(220, 400), *P(310, 530)), radius=int(20 * k), fill='#1E2A5A')
    for cx in (290, 700):
        d.ellipse((*P(cx - 80, 690), *P(cx + 80, 850)), fill='#1E2A5A')
        d.ellipse((*P(cx - 30, 740), *P(cx + 30, 800)), fill='#FFC93C')
    # Sukhi, grinning out of the cab.
    face = Image.open(FACE).convert('RGBA')
    fh = int(460 * k)
    fw = int(fh * face.width / face.height)
    face = face.resize((fw, fh), Image.LANCZOS)
    im.alpha_composite(face, (int(o + 712 * k - fw / 2), int(o + 90 * k)))
    return im.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(PUBLIC, exist_ok=True)
    picture(192).save(os.path.join(PUBLIC, 'icon-192.png'))
    picture(512).save(os.path.join(PUBLIC, 'icon-512.png'))
    picture(64).save(os.path.join(PUBLIC, 'favicon-64.png'))
    picture(180, rounded=False).convert('RGB').save(os.path.join(PUBLIC, 'apple-touch-icon.png'))
    picture(192, inset=0.8, rounded=False).save(os.path.join(PUBLIC, 'icon-maskable-192.png'))
    picture(512, inset=0.8, rounded=False).save(os.path.join(PUBLIC, 'icon-maskable-512.png'))
    print('icons written to public/')


if __name__ == '__main__':
    main()
