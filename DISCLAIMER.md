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
documentation, it is used only to describe or identify that site factually,
which is nominative use, and implies no relationship of any kind.

The project is not named after, branded after, or designed around any third
party's service. No third party's logo, artwork, or trademark appears in the
application, its icon, or its user interface.

## No site is enabled by default

**The application ships with an empty launcher.** Nothing loads until a parent
explicitly adds a site. This is enforced in continuous integration: a build
fails if the shipped catalog enables anything.

### About the suggestions list

The app includes a list of **suggested site profiles** a parent can add with one
tap. To be precise about what that is and is not:

- A profile is **compatibility data**: the hostnames a site needs in order to
  function, measured by visiting it once and recording what it loaded. It is a
  factual description of how a site is put together, in the same way a browser
  compatibility table is.
- **Nothing in the list is enabled, installed, bundled, or pre-configured.** It
  is inert until a parent chooses an entry.
- **No listed site is affiliated with, endorsed by, or a partner of this
  project**, and this project claims no relationship with any of them. Equally,
  this project does not endorse any listed site. Naming a site is not a
  recommendation of its content; parents should look at what their own child is
  using.
- **Ad filtering is on by default**, here and for any site a parent adds. It
  runs on the parent's own machine, on content they asked for, and it is the
  reason most people install this.
- **Where a site's terms explicitly forbid interfering with how it works, the
  profile ships with filtering switched off** (`blockAds: false`), so the site
  runs exactly as its operator intends, and the profile's note says so. Today
  that is the National Geographic Kids profile, which Disney's terms cover.
- Every profile is a switch in the grown-up screen. A parent who disagrees with
  either choice can change it for any site, at any time.
- The list is **bundled with the release**, not fetched at runtime. A children's
  kiosk that downloads a list of destinations at start-up is a
  configuration-injection path; whoever controlled that list would control where
  children are sent.

The same list is published at
<https://sukhiplay.com/catalogue.html>, generated from the same
file, so what is written here describes what is on that page too.

**If you operate a listed site and would like your profile removed, open an
issue and we will remove it.** No argument required.

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
child enjoys a site regularly, please consider supporting it with a subscription,
a purchase, an ad-supported session on your own device, or a direct
contribution. Blocking ads on a site you rely on has a real cost to the people
who make it.

## Children's privacy

Sukhi Play has **no telemetry, no analytics, and no accounts.** It does not
report anything about you, your child, or your usage to anyone, and the
maintainers receive nothing.

It stores settings and browser data locally in the operating system's standard
application-data folder, in a browser profile kept separate from your own.

For completeness, the app does make network requests in exactly three
situations, all of them initiated by you:

1. **Opening a site** your child selected, which is the whole point of the program.
2. **Checking a site** when you use *Add a site*. It loads that address once,
   records the hostnames it requests, and discards the page.
3. **Asking GitHub whether a newer version exists**, and only when you press
   *Check for updates*.

There is no fourth. Nothing is contacted at start-up, on a schedule, or in the
background. Favicons are never fetched: tiles wear this project's own shapes,
so no third party's mark is downloaded, stored or displayed.

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
