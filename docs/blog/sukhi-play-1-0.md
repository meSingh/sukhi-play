# Sukhi Play 1.0, a locked-down browser for small children

> Sukhi Play 1.0 is a free kiosk browser for macOS, Windows and Linux that shows a small child only the websites a grown-up chose, and nothing else.

By Mandeep Singh, 2026-09-12. Announcements. https://sukhiplay.com/blog/sukhi-play-1-0/

Sukhi Play 1.0 is out. It is a free desktop app for macOS, Windows and Linux that fills the screen with big tiles for the websites a grown-up picked, and lets a small child open those and nothing else. There is no account, nothing to pay, and closing it needs an adult.

## Why I built it

My son Sukhi is three. He wants to play games on the laptop, and he also presses every key and clicks every button he can reach. In practice that meant closed tabs, the odd deleted file, videos that autoplayed into something I had not chosen, adverts dressed up as play buttons, and eventually my own work vanishing behind a window he had opened by accident.

What I wanted was simple to say: hand him the laptop and stop watching over his shoulder. Sukhi Play is the thing I built so I could.

## What does Sukhi Play 1.0 do?

He gets a few big, colourful tiles. Each one is a website a grown-up has allowed, drawn as a bold colour and a simple shape, so there is nothing to read. Press a tile and the site opens across the whole screen, with a thin bar at the top: a large Back button and a small ✕ in the corner.

Everything else is switched off.

- **Other websites.** Each site carries a list of the only hosts it may load. Every other request is cancelled before it starts, which also stops advert networks nobody has heard of yet.
- **Adverts and trackers.** Around 110 known advert and tracker domains are blocked even on hosts a site is allowed to use, and the bar counts what it caught.
- **Popups and new windows.** None open. A link to an allowed page opens in place instead, so nothing looks broken.
- **Wandering off.** Links and redirects to anywhere off the list go nowhere.
- **Downloads, right-click and shortcuts.** 64 system shortcuts are held while the app is open, including Cmd+Tab and Alt+Tab, Mission Control and Spotlight. Games keep the keys they need: arrows, WASD, space, Enter and the rest.
- **The desktop.** The window covers the whole screen. On a Mac it follows across Spaces, so a three-finger swipe brings the window along instead of revealing what is behind it.

The [lockdown page](/docs/lockdown/) goes through each layer, and [what your child sees](/docs/what-child-sees/) shows the screens from their side.

## How does a grown-up get back out?

Press the ✕, or Ctrl+Shift+X (Cmd+Shift+X on a Mac), and hold the button for three seconds. Letting go early gets you nothing. The hold is timed by the app itself rather than by the web page, so no site can fake it. Once it unlocks, you choose: close Sukhi Play, or go back to the tiles.

In 1.0 you could also ask for a PIN after the hold, by setting one in a settings file. The small sum that can replace the hold came later, after my own son worked the hold out. [The grown-up gate](/docs/the-gate/) has the details.

## How do I set it up?

The first time it opens, it asks who is at the computer. A grown-up gets a walkthrough of about a minute: what the app does, choosing the first sites, practising the hold once so you know the feel of it, and handing over.

Nothing is switched on for you. 1.0 came with a short list of suggested sites, each one measured so it would actually work, but none of them enabled. To add your own, you type an address. The app opens the site once out of sight, watches everything it loads, and writes the list of allowed hosts itself, so you never need to know what a hostname is. [Adding sites](/docs/adding-sites/) walks through it.

## What can it not do?

It cannot stop someone switching the computer off, and it is not a substitute for a grown-up somewhere nearby. Some keys belong to the operating system and it will not hand them over; [the limits page](/docs/limits/) lists those rather than glossing over them.

macOS and Windows both show a warning the first time it opens, because I do not pay each year for the certificates that would quieten them. [Installing](/docs/installing/) says exactly what to press.

## Free, with the code in the open

There is no paid version and no account. Every line of code has been public from the first day, including the parts that decide what your child can reach, so none of this has to be taken on trust. 1.0 was released under the MIT licence. From 2.1 the licence changed to one for personal and family use, and [the reasons are here](/blog/new-licence/).

## What came after 1.0

[Play time limits](/blog/play-time-limits/) arrived in 1.0.15. [Sukhi Play 2.0](/blog/sukhi-play-2-0-catalogue/) added a catalogue of ready-made sites and apps that work with no internet, and [Sukhi Colouring](/blog/sukhi-colouring/) was the first app I made for it rather than borrowed.

If you have a small person who taps everything, [download Sukhi Play](/download/) and give it ten minutes.

## Questions parents ask

### Does Sukhi Play cost anything?

No. It is free, there is no account to create, and every line of the code is public.

### Which computers does Sukhi Play run on?

macOS on Apple Silicon and Intel, Windows 10 and 11, and Linux.

### What stops my child just closing it?

Closing needs a grown-up. You hold a button for three seconds, and a quick tap, which is every tap a small child makes, does nothing at all.
