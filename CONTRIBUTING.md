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

It runs the app twice against throwaway profiles, because the interesting
states do not coexist: onboarding only exists before setup, and the tile screen
only has anything on it after. The seeded profile is built from
`config/suggestions.json`, so the screenshots always show real titles, colours
and hosts.

Motion is frozen before each capture. The tiles carry a float animation on a
staggered delay and a small per-tile rotation, so an unfrozen capture catches
each tile at its own phase.

To add a state, add an entry to `shotScript()` in `src/main/index.js` with a
name and a caption. `docs/screenshots/captions.json` is the manifest, and
`scripts/make-metainfo.js` generates the software-centre screenshot list from
it, so a new capture reaches Linux stores without a second edit.

## Adding a site to the docs

Don't add enabled entries to `config/catalog.json`. If you want to document a
site that works well, put it in the README's examples table with the
`allowHosts` you verified with `npm run check`, and leave the decision to the
person installing it.

## Reporting a problem

Include your OS and version, how you installed it, what you expected, what
happened, and anything the terminal printed if you ran it from source.

For anything security-related, see [SECURITY.md](SECURITY.md) instead.

## Licence

Contributions are accepted under the [MIT Licence](LICENSE). Note that the
character artwork is **not** MIT, so see [branding/README.md](branding/README.md)
before touching anything in `branding/` or `build/`.
