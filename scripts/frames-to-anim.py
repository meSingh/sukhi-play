#!/usr/bin/env python3
"""Turns the demo's PNG frames into the files the website and README use.

Two formats, because they are read in different places. The website gets an
animated WebP, which is a fraction of the size at the same quality. The README
gets a GIF, because that is what renders everywhere GitHub is read, including
in the mobile apps and in Store listings that accept an animation at all.

Pillow only. ffmpeg is not assumed to be installed: this has to run on the
machine the app is built on, not just on a machine set up for video work.
"""
import sys
import os
import glob
from PIL import Image

FPS = 10
WIDTH = 960          # enough to read the interface, small enough to send


def compose(shell_path):
    """Puts the interface and the site back together.

    They are captured separately, because they are separate views. The site
    sits below the bar, and the bar's height is the difference between the two
    captures, so this does not have to know the layout a second time.
    """
    shell = Image.open(shell_path).convert("RGB")
    game_path = shell_path[:-4] + ".game.png"
    if not os.path.exists(game_path):
        return shell
    game = Image.open(game_path).convert("RGB")
    if game.width != shell.width:
        game = game.resize((shell.width, round(game.height * shell.width / game.width)),
                           Image.LANCZOS)
    if shell.height > game.height:
        # The interface was captured whole, with the site's area left blank.
        shell.paste(game, (0, shell.height - game.height))
        return shell
    # While a site is open the interface is only the bar, so the two are
    # stacked: bar on top, site below, which is how the window looked.
    canvas = Image.new("RGB", (shell.width, shell.height + game.height))
    canvas.paste(shell, (0, 0))
    canvas.paste(game, (0, shell.height))
    return canvas


def load(frames_dir):
    files = sorted(f for f in glob.glob(os.path.join(frames_dir, "f*.png"))
                   if not f.endswith(".game.png"))
    if not files:
        sys.exit("no frames found")
    # Every frame has to end up the same size. A frame captured at a different
    # size (a resize mid-recording) is fitted into the same box rather than
    # stretched, so nothing in the interface changes shape.
    first = Image.open(files[0])
    height = round(first.height * WIDTH / first.width)
    out = []
    for f in files:
        im = compose(f)
        if im.width != WIDTH:
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        if im.size != (WIDTH, height):
            scale = min(WIDTH / im.width, height / im.height)
            fitted = im.resize((max(1, round(im.width * scale)),
                                max(1, round(im.height * scale))), Image.LANCZOS)
            canvas = Image.new("RGB", (WIDTH, height), (255, 247, 236))
            canvas.paste(fitted, ((WIDTH - fitted.width) // 2, (height - fitted.height) // 2))
            im = canvas
        out.append(im)
    return out


def main():
    frames_dir, out_dir = sys.argv[1], sys.argv[2]
    frames = load(frames_dir)
    duration = round(1000 / FPS)
    print(f"[demo] {len(frames)} frames at {FPS}fps, {frames[0].width}x{frames[0].height}")

    webp = os.path.join(out_dir, "demo.webp")
    frames[0].save(webp, save_all=True, append_images=frames[1:],
                   duration=duration, loop=0, quality=72, method=4)

    # The GIF is for the README, where a reader is scrolling past rather than
    # studying it: half the frame rate and a smaller frame, which is the
    # difference between a file that loads on a phone and one that does not.
    # The palette is built once from the whole recording, because built per
    # frame the background shifts colour as scenes change.
    gif_w = 560
    gif_frames = [f.resize((gif_w, round(f.height * gif_w / f.width)), Image.LANCZOS)
                  for f in frames[::3]]
    palette = gif_frames[0].quantize(colors=64, method=Image.MEDIANCUT)
    gif = os.path.join(out_dir, "demo.gif")
    gif_frames[0].quantize(palette=palette).save(
        gif, save_all=True,
        append_images=[f.quantize(palette=palette) for f in gif_frames[1:]],
        duration=duration * 3, loop=0, optimize=True, disposal=2)

    still = os.path.join(out_dir, "demo-poster.png")
    frames[round(len(frames) * 0.22)].save(still, optimize=True)

    for path in (webp, gif, still):
        print(f"[demo] {os.path.basename(path)}  {os.path.getsize(path) / 1e6:.1f} MB")


main()
