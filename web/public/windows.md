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
keyboard shortcuts a child might hit: Alt+Tab, the function keys, Alt+F4, the
browser shortcuts, and Print Screen. All of it is released the moment the app
quits.

**The Windows key is the exception.** Windows does not let an application
take it, on its own or in almost any combination, so pressing it opens the
Start menu over the kiosk. Holding the key properly would mean a low-level
keyboard hook or a registry change, and this app makes neither.

Instead it does what you would do: it presses Escape. While the lockdown is on,
a helper watches for the Start menu, Search and the quick settings panel,
closes whichever one appeared and brings the kiosk back to the front, in about
a quarter of a second. Your child sees a flash and nothing else. Any other
window is left alone, so a dialog you opened never has keys sent into it.

The helper is a PowerShell child process that starts with the lockdown and
stops with the app. Nothing is installed and nothing on the machine is changed.
Running the app with `--start-probe` presses the Windows key a few times and
reports whether the menu was closed each time; `--key-probe` reports which keys
Windows hands over on your system.

To quit, press **Close** and hold the button for three seconds.

If the interface ever fails to appear, the lockdown releases itself after twelve
seconds and you get an ordinary closable window. A kiosk that breaks has to
break open, not locked.

If the taskbar is still visible over the app, that is a bug and not a setting.
Close Sukhi Play, then run this in PowerShell:

```powershell
& (gci "$env:LOCALAPPDATA\Programs" -Recurse -Filter "Sukhi Play.exe")[0].FullName --cover-probe
```

It measures every way of covering the screen and records what the window
manager did with each, which is the only reliable way to tell a window that is
the wrong size from one that is being drawn under the taskbar. The report is
saved as `sukhi-play-cover-probe.txt` on your Desktop; attach it to a bug
report. An installed app on Windows usually prints nothing to PowerShell, so the
file is the part that matters.

> **Windows is the least tested of the three platforms.** It builds in CI and
> the test suite runs there, but far fewer people have actually used it than
> macOS or Linux. Please report anything that looks wrong.
