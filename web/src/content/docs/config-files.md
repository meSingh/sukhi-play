---
title: "Editing by hand"
summary: "The configuration files, for anyone who would rather use a text editor."
order: 9
group: "Under the bonnet"
---

Everything above writes to `catalog.json`, which you can edit directly if you prefer.

| Field | Meaning |
| --- | --- |
| `id` | Unique short name, no spaces |
| `title` | Caption under the tile |
| `url` | The page that opens |
| `shape` | `star` `rocket` `ball` `blocks` `note` `leaf` `drop` `bolt` |
| `color` | Tile colour, `#rrggbb` |
| `allowHosts` | **Only** these hosts may load. `example.com` also covers `a.example.com`, never `evil-example.com` |
| `denyHosts` | Overrides `allowHosts`, for ad subdomains of an allowed domain |
| `blockAds` | `false` leaves the site's advertising alone |
| `enabled` | `true` to show the tile |

Check your work from a terminal:

```bash
npm run probe -- --probe=https://example.com   # what hosts does this site need?
npm run check -- --check=my-games              # does my profile actually work?
```
