---
title: "Adding and removing sites"
summary: "Take one from the catalogue, or paste any address and let the app work out what it needs."
order: 3
group: "Using it"
---

**Sukhi Play does not pick websites for you.** What it ships enabled is the
three apps that live inside the download -- [Sukhi Colouring](/docs/sukhi-colouring/),
a keyboard playground and first games -- because those are files on your own
disk with no network behind them and nobody's terms to accept. Every website is yours to
add, and you never need to work out hostnames yourself.

Open the grown-up screen (**Grown-ups**, hold 3 seconds). Four tabs: play time,
installed apps, the catalogue, and settings.

### The catalogue, in one tap

Sites that are known to work, grouped by category and labelled **no ads**,
**ads filtered** or **ads showing**. Tap one and it arrives on the tile screen
with the hosts it needs already filled in.

The list is not reproduced here: it would drift the moment it changed, and it
has. It lives at **[sukhiplay.com/catalogue](https://sukhiplay.com/catalogue/)**
and in [config/suggestions.json](https://github.com/meSingh/sukhi-play/blob/main/config/suggestions.json), which is the one file
both the app and the site are built from.

Nothing in it is endorsed by this project, and none of those sites is connected
to it. Read [DISCLAIMER.md](https://github.com/meSingh/sukhi-play/blob/main/DISCLAIMER.md).

### Create a custom app: type an address and it works out the rest

Type `pbskids.org`. The app opens it once, watches every request it makes, and
tells you:

```
Found 1 host. 2 looked like advertising or tracking and will be blocked.
  pbskids.org
```

Give the tile a name, press **Save**, and it writes the allowlist for you. This
is the same machinery as `npm run check`, driven from the interface. Pick one of
the sixteen shapes and a colour for the tile: a site's own favicon is its
trademark, and this project has no licence to put one on a tile or in a
release.

### Your apps: turn things on and off

Each app is a card shaped like the tile your child sees. The switch in its
corner decides whether it appears on their screen, and tapping the card opens
everything else: name, picture, colour, address, allowed hosts and ad filtering,
with Delete at the bottom.

<div align="center">
<img src="/screenshots/02-parent-portal.png" width="760" alt="The grown-up screen: tabs for play time, installed apps, the catalogue and settings, with a card and an on/off switch for each app">
</div>

### Leaving a site as its operator intended

Some sites say plainly in their terms that you may not interfere with their
advertising. `blockAds: false` is available on any site you add, for exactly
that case. Containment still applies in full: your child cannot leave the site,
open a popup, or reach anything else.

**youtube.com is deliberately not in the catalogue.** Recommendations, comments
and autoplay make it unsuitable for a small child.
