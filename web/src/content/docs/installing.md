---
title: "Installing"
summary: "Every way to install Sukhi Play on macOS, Windows and Linux, and what to expect the first time it opens."
order: 1
group: "Getting started"
---

On Ubuntu and any other distribution with snap, this is the easiest way and it
updates itself:

```bash
sudo snap install sukhi-play
```

One thing to know about the snap: it runs under strict confinement, which is
what keeps its permissions restricted, and a confined snap is not allowed to
change desktop settings. So it does not borrow Alt+Tab and the Super key the
way the `.deb` and `.AppImage` do. Everything else is identical. If that layer
matters to you, use one of those instead.

On macOS, the two links below always point at the newest release. There is a
[dedicated macOS page](/macos/) covering which one to pick and the
first-launch warning.

| Platform | File |
| --- | --- |
| macOS (Apple Silicon) | **[Sukhi-Play-macOS-AppleSilicon.dmg](https://github.com/meSingh/sukhi-play/releases/latest/download/Sukhi-Play-macOS-AppleSilicon.dmg)** |
| macOS (Intel) | **[Sukhi-Play-macOS-Intel.dmg](https://github.com/meSingh/sukhi-play/releases/latest/download/Sukhi-Play-macOS-Intel.dmg)** |
| Windows 10 / 11 | **[Sukhi-Play-Windows-Setup.exe](https://github.com/meSingh/sukhi-play/releases/latest/download/Sukhi-Play-Windows-Setup.exe)**, or [portable](https://github.com/meSingh/sukhi-play/releases/latest/download/Sukhi-Play-Windows-Portable.exe) |
| Ubuntu / Debian | `.deb` |
| Other Linux | `.AppImage`, `chmod +x` then run |

Everything else is on the
**[latest release](https://github.com/meSingh/sukhi-play/releases/latest)**
page.

> **These builds are signed, but not notarised.** Notarising needs a paid
> Apple Developer account and an EV certificate is needed for Windows, both
> annual, and this is a free project. `SHA256SUMS.txt` is attached to every
> release if you want to check what you downloaded.
>
> **macOS** blocks the first launch with *"Apple could not verify Sukhi Play is
> free of malware"*. Control-clicking the app and choosing *Open* used to get
> past this, but macOS 15 removed that. The route is **System Settings** →
> **Privacy & Security** → **Open Anyway**, under *Security* at the bottom.
> Once per install. [Full walkthrough, with the one-line
> alternative](/macos/).
>
> **Windows** SmartScreen shows *"Windows protected your PC"*. Click **More
> info**, then **Run anyway** — the button only appears after More info.
> [Full walkthrough, including how to check the hash](/windows/).

Or run it from source:

```bash
git clone https://github.com/meSingh/sukhi-play.git
cd sukhi-play
npm install
npm start
```
