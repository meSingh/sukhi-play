# Branding

## Licensing: read this before forking

The **code** in this repository is MIT licensed. The **artwork is not.**

| Asset | Licence |
| --- | --- |
| `branding/cutout-*.png`, `branding/sukhi-icon.png`, `build/icon.png`, `build/icons/*.png`, `src/renderer/assets/mascot.png` | © Mandeep Singh. **All rights reserved.** Not covered by the MIT licence. |
| `branding/generate-mascot.py` and the placeholder it draws | MIT, like the rest of the code |

The Sukhi character is a personal character belonging to Mandeep Singh. It
is included here because this is his application. **If you fork this project and
distribute your own builds, replace the character artwork first.** See below.
You are welcome to the code; the character is not part of the offer.

This is the usual arrangement for open-source projects: the code is free, the
name and the mascot are not.

## How the icon is built

The icon is not drawn or generated. It is lifted straight out of the character
model sheet, so the artwork stays exactly as it was drawn:

```bash
python3 branding/build-icon.py           # rebuilds from the kept cut-out
python3 branding/build-icon.py proud     # the calmer expression
```

Only the finished cut-out lives here, not the model sheet it came from. The
cut-out itself was made with a proper subject matte rather than colour keying,
which leaves ragged edges around hair and shoulders. The full cycle, if you are
starting from a sheet of your own:

```bash
# 1. crop the expression panel out of the sheet
python3 branding/build-icon.py --crop proud

# 2. run branding/panel-proud.png through Adobe image_remove_background,
#    save the result as branding/cutout-proud.png

# 3. composite the cut-out onto the navy tile
python3 branding/build-icon.py proud      # the shipped icon
python3 branding/build-icon.py proud      # the shipped icon
```

Step 3 alone is enough while a `cutout-*.png` already exists, which is the
normal case, because the cut-outs are committed.

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
and transparency outside them. A fully transparent or fully square icon looks
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

The child's screens and the grown-up's screens are deliberately different: warm
daylight and saturated colour for the child, quiet white cards for the parent.
A parent should be able to tell whose screen they are looking at from across the
room.

**The child's world**

| Token | Value | Used for |
| --- | --- | --- |
| `--sky-top` / `--sky-mid` / `--sky-low` | `#7FD4FF` → `#BFEBFF` → `#FFF6E9` | The sky gradient behind everything |
| `--hill` | `#7BD9A6` | The soft green horizon |
| `--ink` | `#16354F` | Lettering, a deep blue rather than pure black |

**The play palette.** Tile colours, assigned automatically so no two tiles next
to each other match.

| Token | Value |
| --- | --- |
| `--blue` | `#2E8FE8` |
| `--yellow` | `#FFC43D` |
| `--coral` | `#FF7A6B` |
| `--mint` | `#2FCF9B` |
| `--grape` | `#9B7DF5` |
| `--pink` | `#FF8FC7` |

Tile lettering is **not** fixed to white. `inkFor()` in
`src/renderer/app.js` measures each tile colour's luminance and picks black or
white, whichever is readable. A yellow tile with white text looks fine in a
palette and is unreadable on screen. Any colour a parent chooses is handled.

**Depth.** Everything the child touches has a chunky offset shadow (`--drop`)
that shrinks when pressed, so buttons feel like physical objects rather than
flat rectangles.
