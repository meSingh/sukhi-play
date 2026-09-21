---
title: "How the lockdown works"
summary: "Every layer between your child and the rest of the computer, and what each one actually does."
order: 7
group: "Under the bonnet"
---

Six independent layers, so no single mistake opens a hole.

**1. An allowlist per site.** Each entry lists the only hosts allowed to load
*anything at all*. Every other request is cancelled: image, script, frame, websocket. This layer does most of the work: it blocks ad networks nobody has
heard of yet, because they are not on the list.

**2. An ad and tracker blocklist.** ~110 known ad, tracker and popunder domains
plus URL patterns, checked *even on allowed hosts*. This catches ad code served
from a site's own CDN, which an allowlist alone cannot see.

**3. No new windows.** Every popup, `target="_blank"` and `window.open` is
denied. If the link was to an allowed page it opens in place instead, so nothing
appears broken.

**4. No navigating away.** Any attempt to move the page, a frame, or a redirect
to a non-allowlisted host is cancelled. Non-web schemes (`mailto:`, `steam:`,
`file:`) are refused, so no page can launch another program.

**5. No keyboard escapes, but games keep their keys.** A page-level filter
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
