# Guess FM

A random radio station from somewhere in the world starts playing. Drop a pin on the country you
think it's from. Wrong guesses tell you how far off you were and which way to head. Three rounds,
five guesses each.

This is the 2026 rebuild of the 2022 [Guess FM](https://github.com/andrewlpmcneill/guess-fm) by
Andrew McNeill, Jimmy Chuk and Seamus McGill, with the same look but a new set of sources:

| | 2022 | Now |
|---|---|---|
| Stations | Radio Garden's private API, seeded into Postgres | [Radio Browser](https://www.radio-browser.info), a free, public-domain, community-run directory that welcomes third-party apps |
| Audio | Proxied through Radio Garden's servers | Straight from each broadcaster's own stream |
| Map | Google Maps (API key) | Natural Earth 1:50m countries drawn with d3-geo, no key |
| Guess checking | Mapbox reverse geocoding on an Express server | Point-in-polygon in the browser |
| Stats | Postgres | `localStorage` |

It's a static site with no backend, no API keys and no accounts.

## Develop

```sh
nvm use        # Node 24
npm install
npm run dev
```

`npm run build` writes a static site to `dist/`. Every push to `main` builds it and publishes it to
GitHub Pages (`.github/workflows/deploy.yml`), so it's served under `/guess-fm/` until a custom domain
is set, then from the root.

`npm run map` regenerates `public/world.json` from the `world-atlas` package, keyed by ISO alpha-2
country codes to match Radio Browser.

`npm run cities` regenerates `public/cities.json` from Natural Earth's populated places, used to name
the city a station is in at the end of each round.

## Being a good API citizen

Radio Browser is run by volunteers. The app spreads requests across the mirrors listed at
`all.api.radio-browser.info`, fetches just a few countries' stations per game, and reports each
play to `/json/url/{uuid}` as the API docs ask, which keeps its popularity rankings useful.

## Fonts

- **LCD Bold**, the radio display: copyright © 1977, 1999 Samuel Reynolds, freeware, available from
  <http://www.spinwardstars.com/scrfonts/>. Served as the original, unmodified `LCDBOLD.ttf`, with its
  license in `public/fonts/LCDBOLD-license.txt`.
- **Wild World**, headings: by [Abdullah Mosad](https://www.behance.net/abdullahneon), free for personal
  and commercial use.
