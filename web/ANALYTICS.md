# What the website counts, and how to read it

The site sends Google Analytics a few events besides the usual page views. They
come from one listener, `src/components/Track.astro`, so a new button is
counted without anyone wiring it up. Nothing is sent unless the visitor's
consent choice has loaded Analytics (`src/components/Consent.astro`). Visitors
in Europe who have not said yes, and anyone with Do Not Track or Global Privacy
Control switched on, are never counted. The numbers are a floor, not a census.

## The events

| Event | When | The question it answers |
| --- | --- | --- |
| `download_click` | A button heading for a download: a platform card, the header's Download menu, a `?get=` link, the Snap Store | Which button starts people on the way to a download |
| `download_start` | A release file is requested: the countdown on a platform page finishing, *Download now*, or a direct file link | How many downloads actually begin. **This is the one to mark as a key event.** |
| `download_cancel` | *Cancel* on the countdown | Who changed their mind |
| `open_app` | A link into a playground app (`/playground/<app>/`) | Which apps get opened, and from where |
| `ui_click` | Everything else: menus, GitHub, docs links, FAQ questions, demo buttons | What else gets used |

Every event carries these parameters:

| Parameter | Example | Meaning |
| --- | --- | --- |
| `link_group` | `download`, `store`, `playground`, `github`, `outbound`, `nav`, `footer`, `docs`, `same page`, `page link`, `control`, `question`, `checksums` | The kind of thing pressed. The grouping to report on. |
| `link_text` | `Apple Silicon` | The words on the button |
| `section` | `hero`, `header`, `header download menu`, `footer`, `Introducing Jazz's Studio` | Where on the page it was: a named part, or the heading it sat under |
| `link_url` | `https://github.com/.../Sukhi-Play-Linux.deb` | Where it went, without any query string |

And, where they apply:

| Parameter | On | Example |
| --- | --- | --- |
| `platform` | download events | `macos`, `windows`, `linux` |
| `variant` | download events | `apple-silicon`, `intel`, `installer`, `portable`, `deb`, `appimage`, `snap`, `choose` (a platform page, not a file yet) |
| `file_name` | `download_start` | `Sukhi-Play-macOS-AppleSilicon.dmg` |
| `method` | `download_start` | `countdown`, `now`, `retry`, `link` |
| `from_path` | countdown events | `/` — the page on this site where the visitor picked it |
| `app` | `open_app` | `studio`, `colouring` |
| `recommended` | the home page's platform cards | `yes` when it was the card marked *Your computer* |
| `open` | FAQ questions | `opened` or `closed` |

The page itself (address, title, the site that sent the visitor) is on every
event already; Analytics adds it.

## Setting it up in Analytics, once

Do this soon after the site is published. **Custom dimensions only collect from
the moment they are created**; nothing sent before then is recoverable.

1. **Register the parameters.** Admin → Data display → Custom definitions →
   *Create custom dimension*, scope **Event**, one for each:
   `link_group`, `section`, `platform`, `variant`, `method`, `from_path`, `app`,
   `recommended`. Use the parameter name as the dimension name, so the two are
   never confused. `link_text`, `link_url` and `file_name` are usually offered
   already (Analytics collects them for its own link tracking); if a report
   does not list them, register them the same way.
2. **Mark the downloads as a key event.** Admin → Data display → Events. The
   events appear in the list within a day of the first one being sent. Switch
   on *Mark as key event* for `download_start`, and for `open_app` if the
   playground matters as much.
3. **Leave Enhanced measurement on.** It still sends its own `click` and
   `file_download` events; they do no harm and the reports below ignore them.
4. **Leave out your own testing.** Admin → Data streams → the stream →
   Configure tag settings → Define internal traffic, with your home IP address,
   then Admin → Data settings → Data filters, and set the *Internal traffic*
   filter to Active. Anything recorded from `localhost` can be filtered out in
   an exploration with *Hostname does not exactly match localhost*.

## Reading it

**Did anyone download it, and for what?** Reports → Engagement → Events →
`download_start`. Add the `platform` or `variant` dimension with the + above
the table.

**Which button did it?** Explore → *Free form*.

- Dimensions: Event name, `link_group`, `section`, `link_text`, Page path and screen class.
- Rows: `section`, then `link_text`. Values: Event count, Total users.
- Filter: Event name exactly matches `download_click` (or `open_app`).

**Where the downloads came from.** A second Free form, or the same one with
different rows: Rows *Session source / medium* (or *Session default channel
group*), Values *Key events* with `download_start` chosen. This is where a
link in a forum post or a search engine shows up as the start of a download.

**The whole journey.** Explore → *Funnel exploration*:

1. `page_view` (any page)
2. `download_click`
3. `download_start`

Break it down by *Device category* or *Session source / medium* to see where
people drop out.

**Checking it works.** Reports → Realtime, then press a button on
sukhiplay.com with Analytics allowed; the event appears within a minute. For
the parameters themselves, Admin → DebugView shows each event as it arrives
when the browser has the *Google Analytics Debugger* extension switched on.

## Downloads from GitHub, counted by GitHub

GitHub counts every download of every release file but shows the number
nowhere on its own pages. `scripts/downloads.mjs` at the root of the repository
reads the count:

```bash
node scripts/downloads.mjs
```

It is a running total with no dates, so the *Count downloads* workflow
(`.github/workflows/downloads.yml`) runs it every Monday and adds a row to
`downloads.csv` on the `stats` branch. The difference between two rows is the
downloads in between; the run's summary page has the table. Every request
counts, including repeats and automated checks such as winget's, so treat it
as an upper bound, and the website's `download_start` count as a lower one.

The Snap Store keeps its own numbers, weekly active installs by version and
country, at snapcraft.io → *My snaps* → sukhi-play → *Metrics*.
