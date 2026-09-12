# Sukhi Play on macOS

## Download

Both links always give you the newest release.

| Your Mac | Download |
| --- | --- |
| **Apple Silicon** (M1, M2, M3, M4 and later) | [Sukhi-Play-macOS-AppleSilicon.dmg](https://github.com/meSingh/sukhi-play/releases/latest/download/Sukhi-Play-macOS-AppleSilicon.dmg) |
| **Intel** | [Sukhi-Play-macOS-Intel.dmg](https://github.com/meSingh/sukhi-play/releases/latest/download/Sukhi-Play-macOS-Intel.dmg) |

Not sure which you have? Apple menu, then **About This Mac**. If the **Chip**
line says *Apple* anything, take Apple Silicon. If it says **Processor** and
mentions Intel, take Intel.

Open the `.dmg`, drag **Sukhi Play** into **Applications**, then read the next
section before you try to open it, because the first launch will be refused.

Sukhi Play is not in the Mac App Store and is not distributed or endorsed by
Apple. It is a free project you download directly.

## The first launch is blocked, and that is expected

The first time you open it, macOS shows:

> **"Sukhi Play.app" Not Opened**
> Apple could not verify "Sukhi Play.app" is free of malware that may harm your
> Mac or compromise your privacy.

Only **Done** and **Move to Bin** are offered. Do not click Move to Bin.

This happens because the app is **signed but not notarised**. Notarising means
uploading each build to Apple to be scanned, which requires a paid Apple
Developer account. This is a free project, so that step is skipped, and macOS
cannot tell the difference between "nobody paid for notarisation" and "nobody
checked this at all". It says the strongest thing it can.

If you would rather not take that on trust, every release includes
`SHA256SUMS.txt`, and you can build the app yourself from source in about two
minutes. Instructions are in the [README](../README.md#development).

### Letting it open

1. Click **Done** on the warning. You have to try opening it once for the next
   step to appear.
2. Open **System Settings**, then **Privacy & Security**.
3. Scroll to the bottom, to the **Security** section. There is a line saying
   *"Sukhi Play.app" was blocked to protect your Mac*.
4. Click **Open Anyway**, authenticate, then confirm **Open**.

You do this once per installation. Afterwards it opens normally.

On macOS 14 and earlier you could Control-click the app and choose **Open**
instead. macOS 15 removed that, so on macOS 15 and later the System Settings
route above is the only one in the interface.

### The one-line alternative

If you are comfortable in Terminal, clearing the quarantine flag skips the
dialog entirely:

```bash
xattr -dr com.apple.quarantine "/Applications/Sukhi Play.app"
```

That flag is what macOS attaches to anything downloaded from a browser.
Removing it tells macOS you trust this particular file. It does the same thing
as Open Anyway, with fewer clicks.

## What to expect once it is running

Sukhi Play covers the whole screen, including the menu bar and the Dock, and
holds the keyboard shortcuts a child might hit. That is the point of it, and it
is all released the moment the app quits.

On macOS it uses "simple" fullscreen rather than creating a new Space, so a
three-finger swipe cannot slide the desktop out from underneath it, and there is
no green button to shrink it back into a window.

To quit, press **Close** and hold the button for three seconds. Nothing else
gets you out, which is deliberate.

If the interface ever fails to appear, the lockdown releases itself after twelve
seconds and you get an ordinary closable window. A kiosk that breaks has to
break open, not locked.

## If something goes wrong

Run the diagnostic and include the output in a bug report:

```bash
npm run diagnose
```

It prints the window and display geometry, the measured bar position and the
session details, then quits, with the lockdown switched off so it never takes
over your screen.

Report problems at
[github.com/meSingh/sukhi-play/issues](https://github.com/meSingh/sukhi-play/issues).
