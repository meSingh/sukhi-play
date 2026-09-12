# Disclaimer

**Short version:** Sukhi Play is a general-purpose kiosk browser. It ships with
no website enabled. Whoever installs it chooses which sites their child may
open, and is responsible for that choice.

*This document is not legal advice. If you are shipping this commercially or are
worried about a specific site, talk to a lawyer.*

---

## What this software is

Sukhi Play is a locked-down web browser for young children. A parent lists the
sites their own child is allowed to visit, and the app refuses everything else:
other sites, popups, new windows, downloads, and browser keyboard shortcuts.

It is a **parental control tool that runs on the user's own computer**, under
the user's own control, showing content to the user's own child. It is not a
service, it does not host anyone's content, and it does not redistribute
anything.

## No affiliation with any website

Sukhi Play is **not affiliated with, endorsed by, sponsored by, or connected to
any website, game, or company** whose site a user chooses to open with it.

All trademarks, service marks, product names, and company names are the
property of their respective owners. Where such a name appears in this project's
documentation, it is used only to describe or identify that site factually —
nominative use — and implies no relationship of any kind.

The project is not named after, branded after, or designed around any third
party's service. No third party's logo, artwork, or trademark appears in the
application, its icon, or its user interface.

## No site is enabled by default

**The application ships with an empty launcher.** Example configurations are
included in the documentation and in `config/catalog.json`, all marked
`"enabled": false`. Nothing loads until a parent explicitly turns an entry on or
writes their own.

This is deliberate. The maintainers do not select, endorse, recommend, or
curate any destination. The person who installs the software decides where it
may go, exactly as they would by typing an address into any other browser.

## About content blocking

Sukhi Play blocks requests to hosts that a parent has not allowed, and to a
built-in list of advertising and tracking domains.

- It runs **locally, on the user's own device**, on content the user has already
  chosen to request. This is the same category of thing as any browser content
  blocker or a browser's built-in tracking protection.
- It **does not** circumvent paywalls, defeat DRM, bypass authentication,
  strip copyright management information, or access anything a normal browser
  visitor could not.
- It **does not** modify, repackage, mirror, or redistribute anyone's content.
- It makes **no automated requests** of its own beyond what the page the child
  opened asks for. There is no crawling, scraping, or bulk access.

Blocking advertisements is a widely used and, in several jurisdictions,
judicially upheld user choice. That said, **using a blocker may conflict with a
given website's terms of service.** Terms vary by site and change over time.

**It is the user's responsibility to read and comply with the terms of service
of any website they configure.** If a site's terms forbid content blocking and
you wish to respect that, either do not add that site or widen its `allowHosts`
so its advertising loads. The choice is yours and the responsibility is yours.

## Please support the sites you value

Free games and educational sites are usually paid for by advertising. If your
child enjoys a site regularly, please consider supporting it — a subscription,
a purchase, an ad-supported session on your own device, or a direct
contribution. Blocking ads on a site you rely on has a real cost to the people
who make it.

## Children's privacy

Sukhi Play collects nothing, sends nothing, and has no telemetry, analytics,
accounts, or network services of its own. It stores settings and browser data
locally in the operating system's standard application-data folder, in a
browser profile kept separate from your own.

Websites a parent enables may themselves collect data and set cookies. Sukhi
Play cannot change what a third-party site does once it is allowed to load.
Parents are responsible for reviewing the privacy practices of any site they
enable, particularly with regard to laws protecting children's data such as
COPPA and the GDPR.

## No warranty

Sukhi Play is provided "as is", without warranty of any kind, as set out in the
[MIT License](LICENSE).

**This software is not a substitute for adult supervision.** It reduces what a
small child can reach; it does not make a computer childproof. Web content can
change at any moment, blocking is imperfect, and some operating-system controls
cannot be intercepted by any application. Do not rely on it as the only thing
standing between your child and the internet.

## For website operators

If you operate a site and have a concern about this project, please open an
issue or contact the maintainers. We will engage in good faith, and we are
willing to remove any example configuration that names your service.
