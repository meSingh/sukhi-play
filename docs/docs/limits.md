# What this cannot do

> The honest list of what Sukhi Play does not protect against, written down rather than glossed over.

**Blocked at the OS level while the app is in front:** `Cmd/Alt+Tab`, `F1`–`F20`,
Mission Control and Spaces, Spotlight, `Cmd/Ctrl+Q W M H N T R P S O F J L D U`,
devtools shortcuts, zoom, `Alt+F4`, and screen capture (`Print Screen` and its
variants, `Cmd+Shift+3/4/5/6`). Released the moment the window loses focus.

**Not blocked, on purpose:**

- **Force Quit.** `Cmd+Alt+Esc` on macOS, `Ctrl+Alt+Del` on Windows, and
  `Ctrl+Shift+Esc`. Left alone so the machine can always be recovered. Do not
  add these.

**Held a different way, because Windows will not hand it over:**

- **The Windows key.** A bare `Super` accelerator is rejected by Electron
  outright, and Windows refuses `Super+D`, `Super+E`, `Super+R`, `Super+L`,
  `Super+Tab`, `Super+Shift+S` and the rest when asked for them. Only
  `Super+V`, `Super+Plus` and `Super+-` are handed over, and those are taken.

  So pressing it opens the Start menu over the kiosk, and asking for focus back
  does nothing: Windows refuses a foreground request from a background process,
  and Start is drawn above every application window regardless of always-on-top.

  What works is Escape. While the lockdown is on, a PowerShell helper watches
  for the Start menu, Search and the quick settings panel, presses Escape on
  whichever appeared and brings the window back to the front, measured at about
  a quarter of a second. Any other foreground window is left alone, so keys are
  never sent into a dialog. The helper starts with the lockdown and stops with
  the app; nothing is installed and nothing on the machine is changed.

  Run `npm run start-probe` to watch it happen, and `npm run key-probe` to
  re-measure which keys this OS hands over.

**On Linux the desktop's own shortcuts are borrowed, not blocked.** Alt+Tab and
the Super key belong to GNOME rather than to any application, and under
**Wayland**, the default on current Ubuntu, an application cannot intercept keys
at all: Electron's global shortcuts are an X11 facility, and on Wayland they
report success and catch nothing.

So on a GNOME session Sukhi Play switches those bindings off in GNOME's own
settings while it runs, and puts them back exactly as they were when it quits.
25 of them, including Alt+Tab, the Super key, workspace switching and the
screenshot keys.

Every original value is written to disk before anything changes, so a crash
cannot leave you without Alt+Tab: the next start finds the backup and restores
from it. Set `borrowDesktopShortcuts` to `false` in `settings.json` if you would
rather it left your desktop alone.

On a desktop other than GNOME, choose **Xorg** at the login screen (the gear on
the password field) for the in-app layer to work at all. The app says which
session it found:

```
[gnome] borrowed 25 desktop shortcuts, including Alt+Tab and the Super key
[gnome] originals saved to ..., restored when this app quits
```

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