# Sukhi Play 2.0: a catalogue, and apps that work offline

> Sukhi Play 2.0 adds a one-tap catalogue of sites, three apps inside the download that work with no internet, and a rebuilt grown-up screen.

By Mandeep Singh, 2026-09-21. Announcements. https://sukhiplay.com/blog/sukhi-play-2-0-catalogue/

Sukhi Play 2.0 is out. It adds a catalogue of sites a parent can switch on with one tap, three apps that come inside the download and work with no internet at all, and a grown-up screen rebuilt from the ground up. It shipped as 2.0.1, and then 2.0.2 the next day, for reasons I have written up separately.

## What is the catalogue?

It is a list of sites known to work in Sukhi Play, on its own tab of the grown-up screen. Each one is grouped by category and says on its card whether it has no adverts, has adverts that Sukhi Play filters, or has adverts that are left showing. Tap one and it arrives on your child's tile screen with the hosts it needs already filled in.

At 2.0 there were nine: Scratch, PBS Kids, NASA Space Place, Starfall, National Geographic Kids, ABCya, Toy Theater, Poki and Chrome Music Lab.

The same list is published on this site as [the catalogue](/catalogue/). Both are built from one file, so the page and the app cannot drift apart. A site you want that is not in it can still be added by typing its address.

Writing the list out in public showed up three mistakes in what had been shipping, and I fixed them rather than quietly moving on:

- **Toy Theater's note said it carries no advertising.** It does. A test now checks that every ad-supported site says so.
- **National Geographic Kids shipped with ad filtering on.** Its terms forbid interfering with how the site works, so it now ships with filtering off, and its note says why. Your child still cannot leave the site.
- **YouTube Kids came out.** It had the most restrictive terms of anything on the list. It returned in 2.1, with ad filtering off.

The catalogue is not a list of recommendations. It says which sites work, not which are good for your child, and Sukhi Play is not connected to any of them.

## Which apps work without the internet?

Until now everything in Sukhi Play needed a connection. Open it on a train, or in a house with poor broadband, and you got a screen of tiles that all failed. So 2.0 ships three apps inside the download:

- **Colouring**, an open-source colouring book, since replaced by [Sukhi Colouring](/blog/sukhi-colouring/): colour in animals, flowers and rockets, or just draw.
- **Keyboard**, Magic Smash by Evandro Meneses: press any key and something happens.
- **First Games**, Little Explorer by pazarman: counting, colours, shapes and animals, with no reading needed.

All three are open source under MIT, and their authors are credited in the notices that ship with them. They are the only things Sukhi Play switches on for you in a fresh install, because they are files on your own disk with no network behind them and nobody's terms to agree to. Each one can read its own files and nothing else: not the internet, and not another app's files. Websites are still yours to add.

A picture your child saves from the colouring book lands in a **Sukhi Play** folder inside your Pictures folder, and they see "Picture saved" instead of nothing happening.

The colouring book has since been replaced by one I wrote myself, [Sukhi Colouring](/blog/sukhi-colouring/).

## What changed on the grown-up screen?

It is now a page with four tabs: **Play time**, **Installed apps**, **Catalogue** and **Settings**. Every panel scrolls. Before this, the Save button on the add-a-site form could sit below the bottom of the window with no way to reach it, which made adding a site impossible rather than awkward.

- **Play time** takes any number of minutes up to four hours, with the old presets as shortcuts.
- **More time** is its own thing. When a session ends your child can ask, and a grown-up can grant fifteen minutes, an hour or the rest of the day, for that session only. Your usual limit does not change. [Play time limits](/blog/play-time-limits/) has more.
- **The stop screen** has a way for a grown-up to close the app without granting anything.
- **The way in** is a choice of two cards: hold the button, or answer a small sum. The sum now replaces the hold rather than following it.
- **Both exits** are in the header and say where they go: back to the play zone, or quit Sukhi Play.
- **Tiles** are always one of sixteen shapes in a colour you pick. Sites' own icons are gone, because they are other people's trademarks.
- **While a site loads**, your child sees a screen in that tile's colour and shape instead of a blank rectangle, which to a small child looks exactly like broken.

## Why 2.0.1, and then 2.0.2?

The version number 2.0.0 was used once and could not be used again, and the Ubuntu snap turned out not to open. Nothing in the app changed between 2.0.1 and 2.0.2. The whole story is in [what went wrong with 2.0](/blog/what-went-wrong-with-2-0/).

## Try it

[Download Sukhi Play](/download/), or browse [the catalogue](/catalogue/) first to see what you could switch on. [Adding sites](/docs/adding-sites/) covers everything else.

## Questions parents ask

### Is there a Sukhi Play 2.0.0?

No. 2.0.0 was published and withdrawn, and GitHub will not let that name be used twice, so the 2.0 release is 2.0.1. 2.0.2 followed a day later to fix the Ubuntu snap; the app itself did not change.

### Do the apps inside the download need the internet?

No. They are files on your own computer and they are not allowed to reach the internet at all, so they work on a train, in the car, or when the broadband is having a bad day.

### Does being in the catalogue mean a site has been checked for children?

No. The catalogue is a list of sites known to work in Sukhi Play, with the hosts each one needs. I do not check what they show, so have a look yourself before you switch one on.
