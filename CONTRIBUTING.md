# Contributing

Thanks for looking. This started as one parent trying to hand a laptop to a
3-year-old without worrying, and it is useful to other people in the same spot.

## Getting set up

```bash
git clone https://github.com/meSingh/sukhi-play.git
cd sukhi-play
npm install
npm run dev      # dev mode: no screen-covering, no OS shortcut capture
npm test
```

Use `npm run dev`, not `npm start`, while working. `npm start` covers the whole
screen, sits above everything, and takes 64 keyboard shortcuts off the OS,
which is correct for a child and miserable for a developer.

## The rules this project lives by

Please keep these in mind; a change that breaks one of them will be sent back.

1. **Games must keep their keys.** Arrow keys, WASD, space, digits, and Ctrl or
   Shift pressed on their own have to reach the page. A modifier held *by
   itself* is a game action, not a shortcut. Breaking this makes games
   unplayable, which is the bug users notice first.
2. **Nothing ships enabled.** `config/catalog.json` must have no entry with
   `enabled: true`. CI fails the build otherwise. See [DISCLAIMER.md](DISCLAIMER.md)
   for why this matters.
3. **The allowlist is the primary defence**, not the ad blocklist. If you find
   yourself adding domains to `blocklist.js` to fix a leak, ask whether the
   allowlist should have caught it.
4. **The exit gate is checked in the main process.** Never move a security
   decision into the renderer. The page animates; `src/main/index.js` decides.
5. **No telemetry, no analytics, no network calls of our own.** Ever.
6. **Don't add a dependency without a good reason.** The app currently has zero
   runtime dependencies and that is a feature.

## Before you open a pull request

```bash
npm test        # unit tests
npm run check   # drives a real site and reports what loaded and what was cut
```

`npm run check` needs a network connection and an enabled catalog entry, so it
is not part of CI. Run it locally if you touched request filtering, navigation,
or the window.

## Regenerating the screenshots

The images in `docs/screenshots/` are captured from the real application, not
mocked up, so they go stale whenever the interface changes. One command
regenerates all of them:

```bash
npm run shots
npm run metainfo   # refresh the AppStream list that software centres read
```

On Linux add `--no-sandbox` to any local Electron run: the bundled
`chrome-sandbox` is not root-owned in `node_modules`, so a fresh clone aborts
before it starts. It has no effect on layout or geometry.

It runs the app twice against throwaway profiles, because the interesting
states do not coexist: onboarding only exists before setup, and the tile screen
only has anything on it after. The seeded profile is built from
`config/suggestions.json`, so the screenshots always show real titles, colours
and hosts.

Motion is frozen before each capture, via `document.getAnimations()` and the
Web Animations API. The tiles carry a float animation on a staggered delay, so
an unfrozen capture catches each at its own phase.

Do not freeze it by injecting a `<style>` element. The renderer's CSP is
`style-src 'self'`, which blocks one, and the injecting side cannot tell: the
only sign is a violation in the renderer log. An earlier version did that, so
nothing was frozen for several releases while the code looked correct. A few
pixels of label variation survives the freeze and is meant to: each tile also
carries a small CSS rotation, which changes its bounding box.

To add a state, add an entry to `shotScript()` in `src/main/index.js` with a
name and a caption. `docs/screenshots/captions.json` is the manifest, and
`scripts/make-metainfo.js` generates the software-centre screenshot list from
it, so a new capture reaches Linux stores without a second edit.

## Adding a site to the docs

Don't add enabled entries to `config/catalog.json`. If you want to document a
site that works well, put it in the README's examples table with the
`allowHosts` you verified with `npm run check`, and leave the decision to the
person installing it.

## Releasing

```bash
npm version patch   # or minor / major
git push --follow-tags
```

CI builds all three platforms and publishes the installers. It refuses to
publish if the tag and `package.json` disagree, or if the tests fail.

**The tag must be signed.** `npm version` creates an annotated tag, and an
annotated tag carries its own signature instead of inheriting the commit's --
so an unsigned one shows as *Unverified* on GitHub even when every commit under
it is signed. Releases here are immutable and tag creation is restricted, which
together mean a tag name cannot be reused once it has been published. This has
to be right the first time:

```bash
git config tag.gpgsign true   # once per clone
```

## Reporting a problem

Include your OS and version, how you installed it, what you expected, what
happened, and anything the terminal printed if you ran it from source.

For anything security-related, see [SECURITY.md](SECURITY.md) instead.

## Licence and your contribution

Sukhi Play is free for individuals and families to use, change and share,
and never for commercial use. The terms are the
[Sukhi Play Personal Use Licence](LICENSE).

Improvements are very welcome, and the way they reach everyone is by coming
back here. So, by submitting a contribution -- a pull request, a patch, or code
or artwork attached to an issue -- you:

1. confirm it is your own work, or that you have the right to submit it;
2. grant Mandeep Singh a perpetual, worldwide, non-exclusive, royalty-free,
   irrevocable licence to use, copy, change, distribute, sublicense and
   relicense your contribution, under any terms, including terms other than
   this project's licence; and
3. agree that it may be included in Sukhi Play and its apps without further
   permission or payment.

You keep the copyright in what you wrote. If you would rather not agree to
this, say so before you send anything and it will not be merged.

The Sukhi character artwork is not covered by the licence at all, so see
[branding/README.md](branding/README.md) before touching anything in
`branding/` or `build/`.
