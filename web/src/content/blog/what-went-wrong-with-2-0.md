---
title: "What went wrong with Sukhi Play 2.0, and what I changed"
description: "Three things went wrong around Sukhi Play 2.0: a version number I could not use, a Linux snap that never opened, and download buttons that led nowhere."
date: 2026-09-22
kind: story
topics: ["releases", "linux", "behind the scenes"]
faq:
  - q: "I installed Sukhi Play from the Snap Store and it did nothing. What should I do?"
    a: "Update it. Every version from 2.0.2 on opens. Snaps update themselves, and running sudo snap refresh sukhi-play in a terminal fetches the new one straight away."
  - q: "Was anything wrong with the app itself in 2.0.1?"
    a: "No. 2.0.1 is the 2.0 release under a different number, and only the snap's packaging was wrong. 2.0.2 is the same app again, released so the fixed snap could go out properly."
---

Three things went wrong around Sukhi Play 2.0. The release had to go out as 2.0.1 because GitHub would not let me use the name 2.0.0 a second time, the Ubuntu snap in the Snap Store had never actually opened, and six download buttons on this website led to a missing page. All three are fixed, and each one now has a check that should stop it happening again.

If you were one of the people who hit any of this, I am sorry. You tried something I made for your child and it did not work, and that is on me. Here is what happened: a sentence each, then a little more for the curious.

## Why is there no Sukhi Play 2.0.0?

**Short version:** with a certain GitHub setting on, a release name can only ever be used once, and I used it, deleted it, and then wanted it back.

Every release on GitHub hangs off a name called a tag, like `v2.0.0`. I had turned on immutable releases, which means that once a release is out, nobody, me included, can quietly swap the files underneath it. That is a good thing for something you download. I published 2.0.0, deleted it to put it out again, and found the name was gone.

I thought turning the setting off would free it, and briefly moved everything back to 2.0.0. It did not: GitHub still refused the name, while a test name made and deleted in the same session went through without complaint. So 2.0 shipped as 2.0.1. Only the number changed.

**What I changed:** release tags are now signed automatically on my machine, and my release instructions say plainly that a tag has to be right the first time, because a wrong one cannot be corrected, only replaced with the next number up.

## Why did the Sukhi Play snap not open on Ubuntu?

**Short version:** the snap is built from a ready-made template, and the step that should have unpacked it never ran, so the snap shipped with a sealed parcel inside instead of the start-up files that were in the parcel.

If you installed Sukhi Play from the Snap Store before 2.0.2, clicked it, and nothing happened, that was not you or your computer. It had never opened, on any machine, since it first went into the store.

For the curious: Sukhi Play is built with electron-builder, whose snap template comes as a tar file inside a 7z file. The build unwrapped the 7z and stopped, leaving the tar whole, and packed that into the snap. Opening the snap first runs a small script called `desktop-init.sh`, which was still inside the unopened tar, so it gave up before Sukhi Play got a chance to start. That is why nothing appeared and nothing was logged.

My checks confirmed that a snap had been built and that its details read correctly. Both passed on a snap that could not start.

**What I changed:**

- A step before the Linux build now unpacks the template properly. On Ubuntu 24.04 the snap installs and opens.
- The build now installs the snap and runs it, and fails if the Sukhi Play screen does not appear.
- That test installs it the way the Snap Store does, and checks that a page inside can draw 3D graphics, which Scratch needs.
- There is a way to push a fixed snap on its own, and it refuses to upload one it could not start.

2.0.2 exists because of this. The app inside is the same as 2.0.1; the new number let the working snap go out through the normal release, rather than being slipped in under a version that had never worked.

## Why did the download buttons not work?

**Short version:** when I moved the website to tidier addresses, six buttons on the download page kept an old kind of link that, from the new page, pointed at pages that had never existed.

For about a day, the Apple Silicon, Installer and .deb buttons on the [download page](/download/) went to "page not found". The files were fine all along; nobody was getting as far as them.

**What I changed:** a test now opens every page of the built site and follows every link the way a browser would. The old check only looked at the links in the header. And a wrong address now lands on a proper page of this site, with the four places you most likely wanted, instead of GitHub's own error page with no way back here.

## What the three have in common

Each time, a check passed that was checking something next to the real thing. The snap was built, but nobody opened it. The links were tested, but only the ones at the top. So most of what changed is one idea: test what a parent actually does. Install it, open it, press the button.

If something still does not work for you, please [open an issue on GitHub](https://github.com/meSingh/sukhi-play/issues) and tell me your system and what you saw. The [installing guide](/docs/installing/) covers each platform, and the current version is always on the [download page](/download/).
