---
title: "What went wrong with Sukhi Play 2.0, and why it's missing from the release page"
description: "Look for 2.0.0 on the releases page and it isn't there. Here's why, and the two other things that went wrong around the same release."
date: 2026-09-22
kind: story
topics: ["releases", "linux", "behind the scenes"]
points:
  - "There is no 2.0.0 because GitHub never lets a release use the same name twice. 2.0 came out as 2.0.1, with nothing changed but the number."
  - "The Linux snap in the Snap Store had never opened, on any computer. 2.0.2 is the same app, released to fix it."
  - "For about a day, three download buttons on this site led to a missing page."
  - "Each of the three now has a check that stops it happening again."
faq:
  - q: "Why is there no Sukhi Play 2.0.0 on the releases page?"
    a: "It was published and deleted, and GitHub keeps a release's name reserved forever once it has been used with immutable releases switched on. 2.0 was released as 2.0.1 instead, with nothing changed but the number."
  - q: "I installed Sukhi Play from the Snap Store and it did nothing. What should I do?"
    a: "Update it. Every version from 2.0.2 on opens. Snaps update themselves, and running sudo snap refresh sukhi-play in a terminal fetches the new one straight away."
  - q: "Was anything wrong with the app itself in 2.0.1?"
    a: "No. Only the snap's packaging was wrong. 2.0.2 is the same app again, released so the fixed snap could go out properly."
---

2.0 was the biggest release Sukhi Play had had: a catalogue of ready-made
sites, apps that work with no internet, and a rebuilt grown-up screen. It also
went wrong in three separate ways, and if you go looking for it on the
releases page, you won't find it.

## The version that isn't there

I published 2.0.0, and something about it wasn't right, so I deleted it to put
it out again. That's normally a two-minute job. This time GitHub said no.

I'd switched on a setting called immutable releases. It's a good setting: once
a release is out, nobody, me included, can quietly swap the files underneath
it, which is exactly what you want from something you install on your child's
computer. What I hadn't understood was the other half. Once a release has used
a name, the name is spent. Deleting the release doesn't give it back, and
neither does turning the setting off. I tried both, and a throwaway test name
went through without a murmur, just to make the point.

So 2.0 came out as 2.0.1. Nothing inside it changed, only the number. The rule
I follow now is short: the tag has to be right the first time, because there
isn't a second time.

## The snap that never opened

I'm less happy about this one. If you installed Sukhi Play from the Snap Store
on Ubuntu before 2.0.2, clicked it, and nothing happened, that wasn't you or
your computer. It had never opened, on any machine, since the day it went into
the store.

The snap is built from a ready-made template that comes wrapped twice, a
parcel inside a parcel. The build opened the outer one and packed the inner one
still sealed, with everything the snap needs to start shut away inside it. My
checks confirmed that a snap had been built and that its details were right,
and they were. None of them opened it.

2.0.2 is the same app as 2.0.1. It exists so the fixed snap could go out
through a normal release, rather than being slipped in underneath a version
that never worked. The build now installs the snap the way the Snap Store does
and opens it, and it refuses to upload one that doesn't start.

## The buttons that went nowhere

The last one was the smallest. When I tidied up the website's addresses, six
links on the download page kept an old form that pointed at pages which had
never existed. For about a day the Apple Silicon, Installer and .deb buttons
led to "page not found". The files themselves were fine; nobody could get to
them.

A test now opens every page of the site and follows every link the way a
browser would. The old one only looked at the links in the header. And a wrong
address now lands on a proper page of this site, not GitHub's error page with
no way back.

## What the three had in common

Each time, a check passed while checking the thing next to the real thing. The
snap was built, but nobody opened it. The links were tested, but only the ones
at the top of the page. Most of what changed since is a single habit: do what a
parent would do. Install it, open it, press the button.

If you ran into any of this, I'm sorry. And if something still doesn't work
for you, [tell me on GitHub](https://github.com/meSingh/sukhi-play/issues) with
your system and what you saw.
