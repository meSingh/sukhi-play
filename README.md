<div align="center">

<img src="branding/sukhi-icon.png" width="128" alt="Sukhi Play">

# Sukhi Play

**A locked-down browser that lets a small child open only the sites you choose — and nothing else.**

[![CI](https://github.com/OWNER/sukhi-play/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/sukhi-play/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/OWNER/sukhi-play?sort=semver)](https://github.com/OWNER/sukhi-play/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](https://github.com/OWNER/sukhi-play/releases/latest)

</div>

---

My three-year-old wants to play games. He also clicks every button on the
screen, which means ads, popups, new tabs, and eventually my work. This is the
thing I built so I could hand him the laptop and stop watching over his
shoulder.

He gets a few big colourful buttons. Everything else — other websites, popups,
new windows, downloads, keyboard shortcuts, the desktop — is switched off.
Closing it needs an adult.

## Install

Grab the file for your machine from the
**[latest release](https://github.com/OWNER/sukhi-play/releases/latest)**:

| Platform | File |
| --- | --- |
| macOS (Apple Silicon) | `.dmg` with `arm64` in the name |
| macOS (Intel) | `.dmg` with `x64` in the name |
| Windows 10 / 11 | `.exe` installer, or the portable `.exe` |
| Ubuntu / Debian | `.deb` |
| Other Linux | `.AppImage` — `chmod +x`, then run |

> **These builds are not signed.** macOS will refuse the first launch:
> right-click the app, choose *Open*, confirm. Windows SmartScreen will warn:
> *More info* → *Run anyway*. Certificates cost money every year and this is a
> free project. `SHA256SUMS.txt` is attached to every release if you want to
> check what you downloaded.

Or run it from source:

```bash
git clone https://github.com/OWNER/sukhi-play.git
cd sukhi-play
npm install
npm start
```

## First run: nothing is enabled

**Sukhi Play ships with an empty launcher on purpose.** It does not pick sites
for you and does not endorse any. You decide where it may go.

1. Start the app, press **For grown-ups**, hold the button for 3 seconds.
2. Press **Open that folder** to find `catalog.json`.
3. Add a site, set `"enabled": true`, restart.

```json
{
  "id": "my-games",
  "title": "Games",
  "url": "https://example.com/",
  "shape": "rocket",
  "color": "#3b82f6",
  "enabled": true,
  "allowHosts": ["example.com", "example-cdn.com"],
  "denyHosts": ["ads.example.com"]
}
```

Then check your allowlist is right:

```bash
npm run check -- --check=my-games
```

That opens the site, watches it, and prints every host it loaded and everything
that was cut, with example URLs. If the site looked broken, the report names the
host to add.

**Please read [DISCLAIMER.md](DISCLAIMER.md) before you add anything.** You are
responsible for complying with the terms of service of every site you enable.

| Field | Meaning |
| --- | --- |
| `id` | Unique short name, no spaces |
| `title` | Caption under the tile |
| `url` | The page that opens |
| `shape` | `star` `rocket` `ball` `blocks` `note` `leaf` `drop` `bolt` |
| `color` | Tile colour, `#rrggbb` |
| `allowHosts` | **Only** these hosts may load. `example.com` also covers `a.example.com`, never `evil-example.com` |
| `denyHosts` | Overrides `allowHosts` — for ad subdomains of an allowed domain |
| `enabled` | `true` to show the tile |

## What your child sees

1. **A loading screen.**
2. **The picker** — big square tiles, one per site, each a bold colour and a
   simple shape. No reading needed.
3. **The site**, with a thin bar on top: a large blue **Back** button and a small
   grey **✕** in the corner.

There is no fullscreen button. The app already covers the screen, and there is
nothing a child can press to shrink it.

## How the lockdown works

Six independent layers, so no single mistake opens a hole.

**1. An allowlist per site.** Each entry lists the only hosts allowed to load
*anything at all*. Every other request — image, script, frame, websocket — is
cancelled. This layer does most of the work: it blocks ad networks nobody has
heard of yet, because they are not on the list.

**2. An ad and tracker blocklist.** ~110 known ad, tracker and popunder domains
plus URL patterns, checked *even on allowed hosts*. This catches ad code served
from a site's own CDN — the case an allowlist alone cannot see.

**3. No new windows.** Every popup, `target="_blank"` and `window.open` is
denied. If the link was to an allowed page it opens in place instead, so nothing
appears broken.

**4. No navigating away.** Any attempt to move the page, a frame, or a redirect
to a non-allowlisted host is cancelled. Non-web schemes (`mailto:`, `steam:`,
`file:`) are refused, so no page can launch another program.

**5. No keyboard escapes — but games keep their keys.** A page-level filter
swallows modifier combinations, function keys, devtools and reload. A second
OS-level layer takes 64 shortcuts away from the window manager itself, including
`Cmd/Alt+Tab`, Mission Control and Spotlight.

What still reaches the game: **arrow keys, WASD and every other letter, the
digits, space, Enter, Escape, and Ctrl or Shift pressed on their own.** A
modifier held by itself is a game action; only a modifier *combined* with
another key is a shortcut. The page is given keyboard focus on load and whenever
it returns from the exit gate.

**6. Nothing else.** Downloads cancelled. Right-click, devtools and `alert()`
traps disabled. All permissions denied except fullscreen and pointer lock. No
app menu. Bad certificates never overridable. Its own browser profile, entirely
separate from yours.

## The window

The app does **not** use native fullscreen, deliberately. On macOS a
native-fullscreen app gets its own Space, and a three-finger swipe slides
straight past it to the desktop.

Instead the window is frameless, fixed, sized to the whole display, and kept at
`screen-saver` level so it sits above the Dock and menu bar. On macOS it also
joins every Space, so swiping brings the window along rather than revealing
what is behind it.

A site that asks for fullscreen with its own button still gets it — the bar
slides away and **Esc** brings it back.

## The grown-up gate

Press ✕, or **Ctrl+Shift+X** (**Cmd+Shift+X** on a Mac).

1. Press and hold the button for 3 seconds.
2. Choose: **Close Sukhi Play**, or **Back to the game list**.

Finishing the hold only *unlocks*. It does not decide anything by itself, so it
can never dump you back on the launcher when you meant to close the app. The
hold is **timed in the main process**, not the page — the animation is only for
you to look at.

Want more? Set a PIN in `settings.json` and you will be asked for it after the
hold:

```json
{ "gateMode": "pin", "pin": "4821" }
```

### Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `gateMode` | `"hold"` | `"hold"`, or `"pin"` to also require a PIN |
| `holdSeconds` | `3` | Seconds the exit button must be held (1–15) |
| `kiosk` | `true` | Cover the whole screen, no window chrome |
| `alwaysOnTop` | `true` | Keep the window above everything else |
| `refocusOnBlur` | `true` | Pull the window back if the child clicks away |
| `showBlockCounter` | `true` | Show "N ads blocked" in the bar |

`refocusOnBlur` switches itself off if it ever starts fighting another window,
so it can never make the machine unusable.

## What this cannot do

**Blocked at the OS level while the app is in front:** `Cmd/Alt+Tab`, `F1`–`F20`,
Mission Control and Spaces, Spotlight, the Start menu, `Cmd/Ctrl+Q W M H N T R P
S O F J L D U`, devtools shortcuts, zoom, `Alt+F4`. Released the moment the
window loses focus.

**Not blocked, on purpose:**

- **Force Quit** — `Cmd+Alt+Esc` on macOS, `Ctrl+Alt+Del` on Windows. Left alone
  so the machine can always be recovered. Do not add these.
- **The bare Windows / Command key.** The OS refuses to hand it over.

**Cannot be blocked by any application:**

- **Hardware media keys.** On a Mac, F-keys report as brightness, volume or
  Launchpad unless "Use F1, F2 as standard function keys" is on. The key never
  arrives as `F4`, so nothing can catch it.
- **Trackpad swipes between Spaces.** Handled by the window manager, never
  delivered to applications. The window follows onto the new Space, so your
  child still lands on Sukhi Play.

For a guarantee rather than a very good default, use a **separate user account**
for your child, or Windows **Assigned Access** (Settings → Accounts → Set up a
kiosk). Both are per-account and leave your own login untouched.

**This is not a substitute for supervision.** It reduces what a small child can
reach; it does not childproof a computer.

## Development

```bash
npm run dev      # no screen-covering, no OS shortcut capture
npm test         # unit tests
npm run check    # drive a real site, report what loaded and what was cut
npm run pack     # unpackaged build
npm run dist     # installers for the current platform
```

Use `npm run dev`, not `npm start`, while working. See
[CONTRIBUTING.md](CONTRIBUTING.md).

```
src/
  main/
    index.js       startup, IPC, the grown-up gate, --check mode
    windowing.js   the window, its two views, and the mode machine
    security.js    request filtering, navigation blocking, permissions
    hosts.js       host matching (label-aware, so lookalikes never match)
    blocklist.js   ad/tracker domains and URL patterns
    keyboard.js    which keys live and which die, inside the page
    shortcuts.js   takes 64 shortcuts off the OS while focused
    catalog.js     loads and sanitises catalog.json
    settings.js    loads and sanitises settings.json
  preload/
    shell.js       the only bridge between the UI and the app
    guest.js       runs in the page: hides leftover ad boxes
  renderer/        loading screen, tiles, bar, gate
```

The window holds two views: our own local UI and the site. The local UI is
always topmost, so the site can never paint over it, and showing the gate is
just a matter of growing our view to fill the window. The renderer runs
sandboxed under a strict CSP and can only reach the app through a handful of
named calls.

## Releasing

Tag it. CI builds all three platforms and publishes the installers.

```bash
npm version patch   # or minor / major
git push --follow-tags
```

The workflow refuses to publish if the tag and `package.json` disagree, or if
the tests fail.

## Licence

Code is [MIT](LICENSE). **The Sukhi character artwork is not** — it belongs to
the project owner. If you fork this and ship your own builds, replace it first;
`python3 branding/generate-mascot.py` swaps in an MIT placeholder. See
[branding/README.md](branding/README.md).

- [DISCLAIMER.md](DISCLAIMER.md) — what this is, and what you are responsible for
- [SECURITY.md](SECURITY.md) — reporting a kiosk escape
- [CONTRIBUTING.md](CONTRIBUTING.md) — the rules this project lives by
