// Builds public/world.json: Natural Earth 1:50m countries (via world-atlas, public domain), with each
// shape keyed by its ISO 3166-1 alpha-2 code so it matches Radio Browser's `countrycode`.
// Run with `npm run map` after bumping world-atlas.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import countries from 'i18n-iso-countries';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));

// Shapes world-atlas leaves without an ISO numeric id. Radio Browser files Kosovo under XK, and
// stations in the breakaway regions under the country they're recognised as part of.
const UNNUMBERED = { Kosovo: 'XK', Somaliland: 'SO', 'N. Cyprus': 'CY' };

const geometries = topo.objects.countries.geometries;
let dropped = 0;
topo.objects.countries.geometries = geometries.filter((g) => {
  const code = g.id ? countries.numericToAlpha2(g.id) : UNNUMBERED[g.properties.name];
  if (!code) {
    dropped++;
    return false;
  }
  g.id = code;
  return true;
});

writeFileSync(new URL('../public/world.json', import.meta.url), JSON.stringify(topo));
console.log(`world.json: ${topo.objects.countries.geometries.length} countries (${dropped} unassigned shapes dropped)`);
