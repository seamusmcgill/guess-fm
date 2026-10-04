import { getCountries, getStations, type Station } from './radioBrowser';
import { countryAt, type Coords, type World } from './world';

export interface RoundStations {
  country: string;
  // Playable stations in that country, best first. Later ones stand in if a stream won't play.
  stations: Station[];
}

// Countries need a few listed stations before they're worth trying: most small listings have no
// geotagged https streams at all.
const MIN_LISTED = 10;

export function coords(s: Station): Coords {
  return [s.geo_long!, s.geo_lat!];
}

// A station's coordinates are user-submitted, so only keep ones that actually land inside the
// country it's filed under. Otherwise the "right answer" could be somewhere else entirely.
function located(world: World, country: string, stations: Station[]) {
  return stations.filter((s) => s.geo_lat != null && s.geo_long != null && (s.geo_lat || s.geo_long) && countryAt(world, coords(s)) === country);
}

// Picks `rounds` different countries uniformly at random (so it isn't wall-to-wall US and German
// stations) and some playable stations in each.
export async function pickRounds(world: World, rounds: number): Promise<RoundStations[]> {
  const candidates = (await getCountries())
    .filter((c) => c.stationcount >= MIN_LISTED && world.codes.has(c.iso_3166_1))
    .map((c) => c.iso_3166_1)
    .sort(() => Math.random() - 0.5);

  const picked: RoundStations[] = [];
  while (picked.length < rounds && candidates.length) {
    const batch = candidates.splice(0, rounds - picked.length);
    const results = await Promise.all(
      batch.map(async (country) => ({ country, stations: located(world, country, await getStations(country).catch(() => [])) })),
    );
    picked.push(...results.filter((r) => r.stations.length));
  }
  if (picked.length < rounds) throw new Error('Not enough stations');
  return picked;
}
