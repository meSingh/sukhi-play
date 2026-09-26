---
title: "Why toddlers bash the keyboard, and a safe place to let them"
description: "Toddlers bash keys because every press does something and they copy you. On a normal computer that hits shortcuts; a locked-down screen makes it safe."
date: 2026-09-26
kind: guide
topics: ["keyboards", "toddlers", "laptops"]
image: "/screenshots/04-catalogue.png"
imageAlt: "The catalogue on Sukhi Play's grown-up screen, with Magic Smash, the keyboard playground, first in the list and marked works offline"
faq:
  - q: "Can my toddler close Sukhi Play by bashing the keyboard?"
    a: "Not with the usual shortcuts; closing needs a button held for three seconds. The Force Quit keys are left working on purpose so a grown-up can always recover the computer, but they open a window of options rather than closing anything by themselves."
  - q: "Does the keyboard playground need the internet?"
    a: "No. Magic Smash comes inside the download as files on your own computer, so it works offline and has no adverts."
  - q: "Why does the Start menu flash up on Windows?"
    a: "Windows will not hand the Windows key to an application. Sukhi Play watches for the Start menu, closes it and brings its own window back, in about a quarter of a second."
  - q: "Can my toddler change the brightness or volume on a Mac?"
    a: "Yes. The top row of keys controls brightness and volume unless they are set to act as standard function keys, and no app can catch them. Set both before you hand the laptop over."
---

Toddlers bash the keyboard because every press makes something happen, and because they have watched you use it all day. On a normal computer those presses land on shortcuts that close windows, switch apps and change settings. The answer is not to take the keyboard away, but to give them a screen where pressing everything is safe.

My son Sukhi, at around three, pressed every key and clicked every button he could reach. Sukhi Play started as a screen where pressing all of them was fine.

## Why does my toddler bash the keyboard?

No study needed for this one, just a few afternoons of watching:

- **Cause and effect.** Press a key, something changes. A keyboard has more buttons than anything else in the house, and they all click.
- **Copying you.** They have seen grown-ups typing for as long as they can remember. The keyboard is obviously where the important things happen.
- **Whole hands.** A small child does not press one key. They press five, with a flat palm, often twice.

That last one is the problem.

## Why is keyboard bashing risky on a normal computer?

Because shortcuts are combinations, and a palm on the keyboard makes combinations all the time. A few that toddlers find without trying:

- **Cmd+W or Ctrl+W** closes the tab, and **Cmd+Q** or **Alt+F4** closes the whole program.
- **Cmd+Tab or Alt+Tab** switches to whatever else you had open.
- **The Windows key** opens the Start menu.
- **Ctrl+P or Cmd+P** starts printing.
- **Shift pressed five times** on Windows asks about turning on Sticky Keys.

A silicone keyboard cover does not help here. It keeps crumbs out, but every key underneath still presses.

## What is a safe way to let a toddler bash the keyboard?

For free, with nothing to install: open a blank document, make the text enormous, and let them press away while you sit next to them. Letters appear, which is exactly the point, and you can name them as they go. The catch is that every shortcut still works, so you have to be the lockdown.

An old keyboard that is not plugged into anything is also a perfectly good toy for copying you.

If you want them to play on their own, the keys themselves need to be made safe.

## How does Sukhi Play make keyboard bashing safe?

Two layers, described in [how the lockdown works](/docs/lockdown/):

1. **Inside the page**, a filter swallows modifier combinations, function keys, developer tools and reload.
2. **At the operating system**, while the app is in front, it takes 64 shortcuts away from the computer itself, including Cmd+Tab and Alt+Tab, Mission Control, Spotlight, the common Cmd and Ctrl shortcuts such as Q, W, T, N and P, Alt+F4, the function keys, zoom and screenshots.

What still reaches the game is what a game needs: arrow keys, every letter, the digits, space, Enter, Escape, and Ctrl or Shift pressed on their own. A modifier held by itself is a game action. Only a modifier combined with another key counts as a shortcut, so leaning on Ctrl and W together closes nothing.

## What can Sukhi Play not block?

Some keys belong to the computer, not to any app. [What this cannot do](/docs/limits/) is the full list, but for a keyboard-basher these are the ones to know:

- **Force Quit** (Cmd+Option+Esc on a Mac, Ctrl+Alt+Delete or Ctrl+Shift+Esc on Windows) is left alone on purpose, so a grown-up can always recover the machine. These open a window rather than closing anything, but you may need to press Cancel.
- **The Windows key** opens the Start menu over the app. Sukhi Play closes the Start menu, Search and quick settings as soon as they appear, in about a quarter of a second, but Windows keeps its own Windows-key combinations for itself.
- **A Mac's top row** controls brightness and volume unless it is set to act as standard function keys. No app can catch those, so set the volume and brightness first.
- **On Linux**, Sukhi Play switches off the desktop's own Alt+Tab and Super key while it runs on GNOME, and puts them back afterwards. On other desktops, choose an Xorg session for its keyboard layer to work, and note the Snap version does not do this at all.

And no app can stop someone pressing the power button.

## Is there something inside Sukhi Play made for bashing keys?

Yes. The **Keyboard** tile, switched on from the start, is **Magic Smash**, an open-source keyboard playground by Evandro Meneses that comes inside the download. Press any key and something happens: the key appears big on the screen with a burst of colour, and a gentle sound if you have it on, in themes from space to the ocean to animals.

It works with no internet and has no adverts, because it is a set of files on your own computer. Next to it are **First Games**, Little Explorer by pazarman, with counting, colours, shapes and animals and no reading needed, and **Colouring**, the colouring book that comes with Sukhi Play. [The catalogue](/catalogue/) lists all of them.

## A few habits that help

1. **Save and close your own work first.** Always, whatever is running.
2. **Turn the volume down** before a keyboard game, not after.
3. **Sit with them the first few times.** Naming the letters they press turns bashing into a game you play together.
4. **Keep drinks well away.**

For the wider picture, [how to let a toddler use your laptop without losing your work](/blog/toddler-laptop-without-losing-work/) covers separate accounts and the rest, and [how I set up Sukhi Play for my three-year-old](/blog/setting-up-sukhi-play-for-a-toddler/) goes through the first sessions. It is free for macOS, Windows and Linux on [the download page](/download/).
