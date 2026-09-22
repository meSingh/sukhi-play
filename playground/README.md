# Playground

Small applications for small children. Each one works on its own, in any
browser, and each one also ships inside [Sukhi Play](https://sukhiplay.com) as
an app that needs no internet connection.

That is the whole idea. A parent should be able to open one of these on a
phone, on a school laptop, or inside a locked-down kiosk, and get the same
thing. Nothing here has an account, a sign-in, a tracker, or a way to reach the
rest of the web.

## What lives here

| App | What it is | Status |
| --- | --- | --- |
| [`coloring/`](coloring) | **Sukhi Coloring** — put pictures on the page, move them about, color them in. | In progress |

More will follow. Each is added here first, grows until it is worth its own
release, and then moves to its own repository and comes back as a submodule.

## Why a playground rather than a folder of vendored code

Sukhi Play used to carry other people's built output under `vendor/`, rebuilt
from a pinned upstream commit and bent into shape by a patch file at build
time. That works for shipping somebody else's app unchanged. It stops working
the moment you want to change anything: every change becomes another
string-match patch, and every upstream commit breaks them.

These are ours. They can be changed.

## The rules each app follows

- **Works with no connection.** No fonts, scripts, or images from anywhere else.
- **Works on a phone.** Down to 320px, with controls a small hand can hit.
- **No emoji in the interface.** Every icon is drawn as SVG and ships with the
  app. An emoji is a font the machine may not have, and a missing glyph is an
  empty rectangle where a child was looking for a button.
- **Nothing is collected.** No analytics, no storage beyond this browser, no
  requests off the page.
- **Two ways in.** Every control a child uses is reachable by touch and by
  keyboard, and reversible — nothing a three-year-old presses should leave them
  somewhere they cannot get back from.
- **Credit is kept.** Where an app is derived from someone else's, the source is
  named in its README, its licence, and on its own About screen.

## Mounting one inside Sukhi Play

Until an app has a remote it lives here untracked — the parent repository
ignores `playground/*/` so it cannot be swallowed by a `git add -A`. Once it has
one:

```bash
git submodule add https://github.com/<org>/<app>.git playground/<app>
```

The Sukhi Play build then treats it the way it treats any bundled app: build the
app, copy its output, serve it over the private `sukhiplay://` scheme with no
network and no reach into any other app's files.
