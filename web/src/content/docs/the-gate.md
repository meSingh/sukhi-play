---
title: "The grown-up gate"
summary: "The hold, the sum, and everything that sits behind them."
order: 5
group: "Using it"
---

Press ✕, or **Ctrl+Shift+X** (**Cmd+Shift+X** on a Mac).

**Grown-ups** opens the portal. **Close** quits. Either way you hold a button
for 3 seconds first, and the gate says which one you asked for.

The hold is **timed in the main process**, not the page. The animation is only
for you to look at, and letting go early gets you nothing.

## The sum, instead of the hold

If your child ever works the hold out, switch **Getting in here** on the
Settings tab from *Hold* to *Sum*. You are then asked a small addition instead,
and holding the button stops opening anything at all -- it is one way in or the
other, never both.

Wrong answers get a fresh sum, and three of them in a row lock the gate for ten
seconds.

## The grown-up screen

Four tabs: **Play time**, **Installed apps**, **Catalogue** and **Settings**.
Quitting is in the corner rather than buried in a menu. Besides adding and
editing apps:

- **Check for updates** asks GitHub whether a newer release exists and links to
  it. It reports only. Nothing is downloaded or installed, because a kiosk that
  can rewrite itself is a worse problem than one that is out of date.
- **Reset Sukhi Play to factory settings** wipes every app and setting and
  restarts into the walkthrough. It asks twice and cannot be undone.

> A `.deb` or `.dmg` you installed by hand is not tracked by your system's app
> store, so it will never offer you an update. That is how manual packages
> work rather than a fault in this app. Use **Check for updates** and download
> the new one.

A PIN is also available, for anyone who would rather type one. Unlike the sum,
it comes *after* the hold rather than instead of it:

```json
{ "gateMode": "pin", "pin": "4821" }
```

### Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `gateMode` | `"hold"` | `"hold"`, `"sum"` to answer an addition instead, or `"pin"` to also require a PIN after the hold |
| `holdSeconds` | `3` | Seconds the exit button must be held (1–15) |
| `kiosk` | `true` | Cover the whole screen, no window chrome |
| `alwaysOnTop` | `true` | Keep the window above everything else |
| `refocusOnBlur` | `true` | Pull the window back if the child clicks away |
| `showBlockCounter` | `true` | Show "N ads blocked" in the bar |
| `onboarded` | `false` | Set to `false` to see the first-run walkthrough again |
| `borrowDesktopShortcuts` | `true` | Linux/GNOME only. Switch the desktop's Alt+Tab and Super key off while the app runs, then restore them |

`refocusOnBlur` switches itself off if it ever starts fighting another window,
so it can never make the machine unusable.
