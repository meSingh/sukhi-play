<div align="center">

<img src="branding/sukhi-icon.png" width="128" alt="Sukhi Play">

# Sukhi Play

**A locked-down browser that lets a small child open only the sites you choose — and nothing else.**

[![CI](https://github.com/YOURNAME/sukhi-play/actions/workflows/ci.yml/badge.svg)](https://github.com/YOURNAME/sukhi-play/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/YOURNAME/sukhi-play?sort=semver)](https://github.com/YOURNAME/sukhi-play/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](https://github.com/YOURNAME/sukhi-play/releases/latest)

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
**[latest release](https://github.com/YOURNAME/sukhi-play/releases/latest)**:

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
git clone https://github.com/YOURNAME/sukhi-play.git
cd sukhi-play
npm install
npm start
```

## First run: you choose what he can open

**Sukhi Play ships with an empty launcher.** It does not pick sites for you. But
it does make picking easy — you never need to work out hostnames yourself.

Open the grown-up screen (**For grown-ups**, hold 3 seconds) → **Add or remove
games**. Three tabs:

### Suggestions — one tap

A bundled list of sites other parents use, grouped by category, each labelled
**no ads** or **has ads**. Tap *Add* and it appears on the tile screen.

Nothing here is installed, enabled, or endorsed by this project, and none of
these sites is connected to it. Read [DISCLAIMER.md](DISCLAIMER.md).

| | Site | |
| --- | --- | --- |
| Creative | Scratch | MIT, non-profit, no advertising |
| Learning | Blockly Games | Open source puzzles that teach programming |
| Learning | NASA Space Place | US government, no advertising |
| Learning | Starfall | Letters, phonics, early reading |
| Learning | Nat Geo Kids | Animals and photography |
| Learning | ABCya | Educational games by grade, ad-supported |
| Games | PBS Kids | US public broadcasting, made for pre-schoolers |
| Games | Toy Theater | Simple educational games |
| Games | Poki | Large free game portal, ad-supported |
| Video | YouTube Kids | Ad filtering **off** by design — see below |

### Add a site — type a domain, it works the rest out

Type `pbskids.org`. The app opens it once, watches every request it makes, and
tells you:

```
Found 1 host. 2 looked like advertising or tracking and will be blocked.
  pbskids.org
```

Give the tile a name, press **Add**. It fetches the site's favicon for the tile
and writes the allowlist for you. This is the same machinery as `npm run check`,
driven from the interface.

### My games — turn things on and off

Toggle each tile on or off, or remove it.

### About YouTube Kids

That profile ships with **ad filtering switched off** on purpose. Some sites are
explicit in their terms about not interfering with their advertising, and
YouTube is the clearest example. You do not need ad blocking there anyway — what
you need is *containment*, and that still applies in full: your child cannot
leave the site, open a popup, or reach anything else.

`blockAds: false` is available on any site you add, if you would rather leave it
as its operator intended.

**youtube.com itself is deliberately not suggested.** Recommendations, comments
and autoplay make it unsuitable for a small child. Use YouTube Kids, and set the
age profile up inside YouTube Kids first.

## Editing by hand

Everything above writes to `catalog.json`, which you can edit directly — the
grown-up screen has a button that opens the folder.

| Field | Meaning |
| --- | --- |
| `id` | Unique short name, no spaces |
| `title` | Caption under the tile |
| `url` | The page that opens |
| `shape` | `star` `rocket` `ball` `blocks` `note` `leaf` `drop` `bolt` |
| `color` | Tile colour, `#rrggbb` |
| `allowHosts` | **Only** these hosts may load. `example.com` also covers `a.example.com`, never `evil-example.com` |
| `denyHosts` | Overrides `allowHosts` — for ad subdomains of an allowed domain |
| `blockAds` | `false` leaves the site's advertising alone |
| `enabled` | `true` to show the tile |

Check your work from a terminal:

```bash
npm run probe -- --probe=https://example.com   # what hosts does this site need?
npm run check -- --check=my-games              # does my profile actually work?
```

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
npm run probe -- --probe=https://example.com   # derive an allowlist for a site
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
    library.js     the parent's site list, and the bundled suggestions
    probe.js       visits a site once and works out the allowlist it needs
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
