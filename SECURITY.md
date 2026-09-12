# Security

## What this software is protecting against

Sukhi Play keeps a small child inside a set of sites their parent chose. The
threats it takes seriously are:

- a child reaching a website the parent did not allow
- a page opening a new window, tab, or another application
- a page navigating itself somewhere off the allowlist
- a child closing the app or escaping to the desktop
- advertising and tracking loading inside an allowed page

It is **not** a sandbox against a determined attacker, and it is not a substitute
for supervision.

## Reporting a vulnerability

If you find a way to escape the kiosk, reach a non-allowlisted host, or get past
the exit gate, please report it privately first:

- Use GitHub's **Report a vulnerability** button under the Security tab, or
- open an issue that says only "security report, please make contact" with no
  details, and wait to be contacted.

Please do not post a working escape publicly before it is fixed — the people
running this have small children using it right now.

Include what you did, what happened, your OS, and the app version. A short video
or a reproducible set of steps is ideal.

You can expect an acknowledgement within about a week. This is a volunteer
project, so please be patient.

## Things that are already known and are not vulnerabilities

These are documented limits, not bugs:

- **`Cmd+Alt+Esc` / `Ctrl+Alt+Del` still work.** Left alone deliberately, so the
  machine can always be recovered if the app stops responding.
- **The bare Windows / Command key.** The OS refuses to hand it to any
  application.
- **Hardware media keys**, including F-keys on a Mac that report as brightness,
  volume, or Launchpad. These never reach any application.
- **Trackpad gestures between Spaces on macOS.** Handled by the window manager
  and not delivered to applications. The window follows onto the new Space, so
  the child still lands on Sukhi Play.
- **An allowed site changing what it shows.** Blocking is by host and URL
  pattern, not by inspecting content.

For a guarantee stronger than this, use an OS-level kiosk: Assigned Access on
Windows, or a separate user account on macOS and Linux.

## Supported versions

The most recent release gets fixes. This is a small project; there are no
long-term support branches.
