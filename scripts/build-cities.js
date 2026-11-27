// Builds public/cities.json: Natural Earth 1:10m populated places (public domain), trimmed to
// [name, ISO 3166-1 alpha-2, longitude, latitude, population] so the recap can name the city a
// station is in. Run with `npm run cities`.
import { writeFileSync } from 'node:fs';

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';

// Places Natural Earth leaves without an ISO code, filed the way world.json and Radio Browser file them.
const UNCODED = { Kosovo: 'XK', Somaliland: 'SO', 'Northern Cyprus': 'CY' };

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`${SOURCE}: HTTP ${res.status}`);
const { features } = await res.json();

const round = (n) => Math.round(n * 1000) / 1000; // ~100 m, plenty for naming a city
const cities = [];
for (const { properties: p } of features) {
  const code = /^[A-Z]{2}$/.test(p.iso_a2) ? p.iso_a2 : UNCODED[p.adm0name];
  if (!code) continue;
  cities.push([p.name, code, round(p.longitude), round(p.latitude), Math.max(p.pop_max, p.pop_min, 0)]);
}

writeFileSync(new URL('../public/cities.json', import.meta.url), JSON.stringify(cities));
console.log(`cities.json: ${cities.length} places`);
