# Sukhi Play on Windows

## Download

Both links always give you the newest release. Windows 10 and 11, 64-bit.

| | |
| --- | --- |
| **Installer** (recommended) | [Sukhi-Play-Windows-Setup.exe](https://github.com/meSingh/sukhi-play/releases/latest/download/Sukhi-Play-Windows-Setup.exe) |
| **Portable** (no install, runs from anywhere) | [Sukhi-Play-Windows-Portable.exe](https://github.com/meSingh/sukhi-play/releases/latest/download/Sukhi-Play-Windows-Portable.exe) |

Sukhi Play is not in the Microsoft Store and is not distributed or endorsed by
Microsoft. It is a free project you download directly.

## Windows will warn you, and that is expected

When you run it, Windows shows a blue box:

> **Windows protected your PC**
> Microsoft Defender SmartScreen prevented an unrecognised app from starting.

To continue, click **More info**, then **Run anyway**.

The button only appears after you click More info, which is easy to miss. There
is no way to remove the warning without buying a code signing certificate, which
costs a few hundred pounds a year and has to be renewed. This is a free project,
so it is not signed.

SmartScreen is reacting to the app being unrecognised, not to anything it found.
Reputation is earned by download volume, so this warning fades on its own once
enough people have installed a given version, and comes back with each new
release.

If you would rather not take that on trust, every release ships
`SHA256SUMS.txt`, and you can build the app yourself from source. Instructions
are in the [README](../README.md#development).

### Checking the download yourself

In PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 "$HOME\Downloads\Sukhi-Play-Windows-Setup.exe"
```

Compare the result with the line for that file in `SHA256SUMS.txt` on the
[release page](https://github.com/meSingh/sukhi-play/releases/latest).

## Antivirus

Some antivirus products quarantine unsigned Electron applications on sight,
usually with a generic name like `Unsafe.AI_Score` or `Wacatac`. That is a
heuristic firing on the shape of the file, not a detection of anything specific.

If it happens, check the hash above first. If it matches, the file is what was
built from this repository, and you can allow it in your antivirus. If it does
not match, delete it and tell us at
[github.com/meSingh/sukhi-play/issues](https://github.com/meSingh/sukhi-play/issues).

## What to expect once it is running

Sukhi Play covers the whole screen, including the taskbar, and holds the
keyboard shortcuts a child might hit, including Alt+Tab and the Windows key.
That is the point of it, and it is all released the moment the app quits.

To quit, press **Close** and hold the button for three seconds.

If the interface ever fails to appear, the lockdown releases itself after twelve
seconds and you get an ordinary closable window. A kiosk that breaks has to
break open, not locked.

> **Windows is the least tested of the three platforms.** It builds in CI and
> the test suite runs there, but far fewer people have actually used it than
> macOS or Linux. Please report anything that looks wrong.
