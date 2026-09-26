---
title: "Sukhi Play 1.0: the laptop I could finally hand to my three-year-old"
description: "Why I built a browser my son can't get out of, what the first version did, and the two days it took to make it work on every computer."
date: 2026-09-12
kind: announcement
topics: ["releases", "kiosk browser", "toddlers"]
image: "/screenshots/01-launcher.png"
imageAlt: "The child's screen in Sukhi Play: large colourful tiles, one for each website a grown-up has allowed, and nothing else"
imageCaption: "A few big tiles, one for each site a grown-up chose. Nothing to read, and nothing else to find."
points:
  - "Sukhi Play is a free app for macOS, Windows and Linux that fills the screen with the websites a grown-up picked, and nothing else."
  - "A child can press every key and click every button. Other sites, popups, downloads and shortcuts are switched off."
  - "Getting out takes a button held for three seconds. Every tap a toddler makes is a quick one."
  - "The first version went out on 12 September 2026, and took thirteen releases over two days to settle."
faq:
  - q: "Does Sukhi Play cost anything?"
    a: "No. It is free, there is no account to create, and every line of the code is public."
  - q: "Which computers does Sukhi Play run on?"
    a: "macOS on Apple Silicon and Intel, Windows 10 and 11, and Linux. Older Intel Macs on macOS 10.15 to 12 have a build of their own."
  - q: "What stops my child just closing it?"
    a: "Closing needs a grown-up. You hold a button for three seconds, and a quick tap, which is every tap a small child makes, does nothing at all."
---

My son wanted to play games on my laptop. He was three, and he also clicked
every button on the screen, which meant adverts, popups, new tabs, and
eventually my work. So every time he played, I sat beside him and watched his
hands instead of the game.

What I wanted was small. A screen with the few sites I had chosen, as big
buttons he could press without reading, and nothing else. Something I could
hand over and then actually walk away from. So I built it, and named it after
him.

## What he gets

A handful of big, colourful tiles. Each one is a website I allowed, drawn as a
colour and a simple shape, because he can't read the names yet. He presses
one and the site fills the screen, with a thin bar at the top holding a big
Back button.

Everything else is switched off. Links to other sites go nowhere, popups and
new windows never open, downloads are refused, and the keyboard shortcuts that
switch apps or close windows are taken away while Sukhi Play is in front.
Adverts are blocked too, and the bar quietly counts how many it caught.

## What I get

One rule: to leave, hold a button for three seconds.

![Sukhi Play asking a grown-up to hold a button for three seconds before it closes](/screenshots/05-closing-needs-a-grownup.png "Closing asks for a three-second hold. It is timed by the app, not the page, so no website can fake it.")

A toddler's tap is always quick, so it never gets through by accident. Adding
a site is just as simple on my side: I type its address, Sukhi Play opens it
out of sight, watches what it needs to load, and works out the rest. I never
have to know what a hostname is.

## The first two days

I made the code public at ten to two in the afternoon on 12 September, and 1.0
was out by five. At two the next morning I was still fixing it.

Almost everything broke somewhere. On some Macs, macOS refused to open it and
called it damaged. On Linux, full screen came out the wrong size and the top
bar slid under the edge of the screen. The Snap Store rejected the first
upload. On Windows the taskbar stayed visible until I found a way to cover it
too. And older Intel Macs on macOS 10.15 wouldn't open it at all, so they got
a build of their own.

It took thirteen releases over those two days to settle. None of that was
glamorous, but it's the reason the download works now.

## What it doesn't do

It isn't a babysitter. Nothing stops a finger on the power button, and every
computer keeps a way to force an app to quit, on purpose, so it can always be
recovered. Some keys belong to the operating system and no app can take them.
I've written [the full list](/docs/limits/) down rather than pretend otherwise.

It is also free, with no account, and every line of the code is public,
including the parts that decide what your child can reach. It came out under
the MIT licence; from 2.1 that [changed to one for families](/blog/new-licence/).

## What came next

[Play time](/blog/play-time-limits/) followed nine days later, so the screen
could end a session by itself. [2.0](/blog/sukhi-play-2-0-catalogue/) brought
a catalogue of ready-made sites, and [Sukhi Colouring](/blog/sukhi-colouring/)
was the first app I made for it myself.

If you have a small person who presses everything, [download Sukhi Play](/download/)
and give it ten minutes.
