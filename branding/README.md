# Branding

## Licensing — read this before forking

The **code** in this repository is MIT licensed. The **artwork is not.**

| Asset | Licence |
| --- | --- |
| `branding/character-sheet.png`, `branding/cutout-*.png`, `branding/sukhi-icon.png`, `build/icon.png`, `src/renderer/assets/mascot.png` | © the project owner. **All rights reserved.** Not covered by the MIT licence. |
| `branding/generate-mascot.py` and the placeholder it draws | MIT, like the rest of the code |

The Sukhi character is a personal character belonging to the project owner. It
is included here because this is his application. **If you fork this project and
distribute your own builds, replace the character artwork first** — see below.
You are welcome to the code; the character is not part of the offer.

This is the usual arrangement for open-source projects: the code is free, the
name and the mascot are not.

## How the icon is built

The icon is not drawn or generated. It is lifted straight out of the character
model sheet, so the artwork stays exactly as it was drawn:

```bash
python3 branding/build-icon.py biggrin   # the default
python3 branding/build-icon.py proud     # the calmer expression
```

The cut-out is done by **Adobe's background removal**, not by the script.
Hand-rolled colour keying leaves ragged edges around hair and shoulders; a
proper subject matte does not. The full cycle is:

```bash
# 1. crop the expression panel out of the sheet
python3 branding/build-icon.py --crop proud

# 2. run branding/panel-proud.png through Adobe image_remove_background,
#    save the result as branding/cutout-proud.png

# 3. composite the cut-out onto the navy tile
python3 branding/build-icon.py proud      # the shipped icon
python3 branding/build-icon.py biggrin    # the alternative expression
```

Step 3 alone is enough while a `cutout-*.png` already exists, which is the
normal case — the cut-outs are committed.

To use a different expression, add its coordinates to `PANELS` in the script.
They are fractions of the sheet's width and height: `(left, top, right, bottom)`.

## Replacing the artwork in a fork

Run the placeholder generator, which draws a neutral MIT-licensed mascot from
plain geometric shapes:

```bash
pip install Pillow
python3 branding/generate-mascot.py
```

That overwrites all three image paths with artwork you are free to use and
modify. Then change the product name in `package.json` and
`electron-builder.yml`.

## Using your own character instead

You need one square PNG, ideally **1024 × 1024**. Put it in three places:

| Path | Size | What it becomes |
| --- | --- | --- |
| `build/icon.png` | 1024 × 1024 | The application icon on every platform |
| `branding/sukhi-icon.png` | 1024 × 1024 | The master copy, kept for reference |
| `src/renderer/assets/mascot.png` | 512 × 512 | The loading screen and the tile-picker header |

`build/icon.png` should have a filled background with its own rounded corners
and transparency outside them — a fully transparent or fully square icon looks
wrong in a dock or taskbar.

electron-builder converts `build/icon.png` into `.icns` (macOS), `.ico`
(Windows) and the Linux PNG set at build time. You do not need to make those.

```bash
# macOS has a resizer built in
sips -z 512 512 my-character.png --out src/renderer/assets/mascot.png
```

Then `npm start` to look at it, and `npm run dist` to build installers with it.

## Colours

The palette lives in `src/renderer/styles.css` under `:root`.

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#0f172a` | Page background |
| `--bg-soft` | `#1e293b` | The top bar and cards |
| `--ink` | `#f8fafc` | Text |
| `--accent` | `#38bdf8` | The Back button, focus rings |
| `--danger` | `#f87171` | The close-app button |
