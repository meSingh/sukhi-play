---
title: "If it ever locks you out"
summary: "Getting back in when the gate will not open, on every platform."
order: 11
group: "When things go wrong"
---

The app is built to **fail open**. If the launcher does not appear within 12
seconds, or its window crashes, everything unlocks by itself: the 64 keyboard
shortcuts are handed back for the rest of the session, always-on-top and screen
covering are switched off, the window becomes an ordinary one you can close, and
a plain message explains what happened. A kiosk with no visible exit gate must
not also be holding `Cmd+Q`.

If you still need to get out:

- **Force Quit.** `Cmd+Alt+Esc` on macOS, `Ctrl+Alt+Del` on Windows. Never
  captured, on purpose.
- **From a terminal**, if you can reach one: `pkill -f "Sukhi Play"`

When testing changes, give any run a hard deadline so it cannot take over the
machine:

```bash
SUKHI_EXIT_AFTER=15 npm start    # quits itself after 15 seconds
npm run dev                      # no screen covering, no shortcut capture
```
