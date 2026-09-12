#!/usr/bin/env python3
"""
Builds the Sukhi Play app icon from the character model sheet.

The character is never redrawn or regenerated - one expression panel is lifted
straight out of the sheet and composited onto the app's navy tile, so the
artwork stays exactly as it was drawn.

The cut-out itself is done by Adobe's background removal, not here. Hand-rolled
keying leaves ragged edges around hair and shoulders; a proper subject matte
does not.

    # 1. crop the panel you want
    python3 branding/build-icon.py --crop proud

    # 2. run branding/panel-<name>.png through Adobe image_remove_background
    #    and save the result as branding/cutout-<name>.png

    # 3. composite it onto the tile
    python3 branding/build-icon.py proud      # the shipped icon
    python3 branding/build-icon.py biggrin    # the alternative

Requires Pillow:  pip install Pillow
"""
from PIL import Image, ImageDraw, ImageFilter
import sys, os

SHEET = 'branding/character-sheet.png'

# Where each expression sits on the sheet, as fractions of its size.
PANELS = {
    'biggrin': (0.272, 0.2425, 0.501, 0.3465),   # #2  Big Grin
    'proud':   (0.508, 0.6075, 0.738, 0.7115),   # #15 Proud
}

NAVY = (15, 23, 42, 255)
GLOW = (37, 78, 190, 255)


def crop_panel(which):
    """Step 1: pull one panel out of the sheet, ready for background removal."""
    l, t, r, b = PANELS[which]
    sheet = Image.open(SHEET).convert('RGB')
    W, H = sheet.size
    panel = sheet.crop((int(W * l), int(H * t), int(W * r), int(H * b)))
    # Upscale first so the matte has plenty of resolution to work with.
    panel = panel.resize((panel.width * 3, panel.height * 3), Image.LANCZOS)
    out = f'branding/panel-{which}.png'
    panel.save(out)
    print(f'wrote {out}  {panel.size}')
    print('Now run it through Adobe image_remove_background and save the result')
    print(f'as branding/cutout-{which}.png, then re-run without --crop.')


def build(which, size=1024):
    """Step 3: set the cut-out character on the app tile."""
    cut = Image.open(f'branding/cutout-{which}.png').convert('RGBA')
    cut = cut.crop(cut.getchannel('A').getbbox())   # trim the empty margin

    SS = 2
    canvas = size * SS
    radius = int(canvas * 0.225)

    tile = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle([0, 0, canvas - 1, canvas - 1],
                                           radius=radius, fill=NAVY)

    glow = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    gr = canvas * 0.34
    ImageDraw.Draw(glow).ellipse(
        [canvas / 2 - gr, canvas * 0.47 - gr, canvas / 2 + gr, canvas * 0.47 + gr], fill=GLOW)
    tile.alpha_composite(glow.filter(ImageFilter.GaussianBlur(canvas * 0.06)))

    # Fill most of the tile width, sitting low so the top knot keeps some air
    # and the shoulders run off the bottom edge like a portrait.
    target_w = int(canvas * 0.78)
    scale = target_w / cut.width
    cut = cut.resize((target_w, int(cut.height * scale)), Image.LANCZOS)
    tile.alpha_composite(cut, ((canvas - cut.width) // 2, int(canvas * 0.10)))

    # Re-cut the corners so nothing overhangs the tile.
    mask = Image.new('L', (canvas, canvas), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, canvas - 1, canvas - 1],
                                           radius=radius, fill=255)
    tile.putalpha(Image.composite(tile.getchannel('A'),
                                  Image.new('L', tile.size, 0), mask))

    icon = tile.resize((size, size), Image.LANCZOS)
    os.makedirs('src/renderer/assets', exist_ok=True)
    icon.save('build/icon.png')
    icon.save('branding/sukhi-icon.png')
    icon.resize((512, 512), Image.LANCZOS).save('src/renderer/assets/mascot.png')
    print(f'built icon from the "{which}" cut-out')
    print('  build/icon.png                  1024x1024')
    print('  branding/sukhi-icon.png         1024x1024')
    print('  src/renderer/assets/mascot.png   512x512')


args = sys.argv[1:]
if args and args[0] == '--crop':
    crop_panel(args[1] if len(args) > 1 else 'proud')
else:
    build(args[0] if args else 'proud')
