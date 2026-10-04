import { getCountries, getStations, shuffle, type Station } from './radioBrowser';
import { countryAt, type Coords, type World } from './world';

export interface RoundStations {
  country: string;
  // Playable stations in that country, in play order. Later ones stand in if a stream won't play.
  stations: Station[];
}

// Countries need a few listed stations before they're worth trying: most small listings have no
// geotagged https streams at all.
const MIN_LISTED = 10;

// Each country plays one of its few most popular stations. A random pick from the whole listing
// mostly turned up small online-only streams heavy on promos and ads; the popular ones are far
// more often the real broadcasters people actually tune in to.
const TOP_STATIONS = 5;

export function coords(s: Station): Coords {
  return [s.geo_long!, s.geo_lat!];
}

// A station's coordinates are user-submitted, so only keep ones that actually land inside the
// country it's filed under. Otherwise the "right answer" could be somewhere else entirely.
function located(world: World, country: string, stations: Station[]) {
  return stations.filter((s) => s.geo_lat != null && s.geo_long != null && (s.geo_lat || s.geo_long) && countryAt(world, coords(s)) === country);
}

// The country's top stations by votes and by plays, merged (alternating, so both lists count) and
// shuffled so the same country doesn't always play the same station.
async function popular(world: World, country: string) {
  const [byVotes, byPlays] = await Promise.all([getStations(country, 'votes'), getStations(country, 'clickcount')]);
  const merged = new Map<string, Station>();
  for (let i = 0; i < Math.max(byVotes.length, byPlays.length); i++) {
    for (const s of [byVotes[i], byPlays[i]]) if (s) merged.set(s.stationuuid, s);
  }
  return shuffle(located(world, country, [...merged.values()]).slice(0, TOP_STATIONS));
}

// Picks `rounds` different countries uniformly at random (so it isn't wall-to-wall US and German
// stations) and some of each one's most popular playable stations.
export async function pickRounds(world: World, rounds: number): Promise<RoundStations[]> {
  const candidates = shuffle(
    (await getCountries()).filter((c) => c.stationcount >= MIN_LISTED && world.codes.has(c.iso_3166_1)).map((c) => c.iso_3166_1),
  );

  const picked: RoundStations[] = [];
  while (picked.length < rounds && candidates.length) {
    const batch = candidates.splice(0, rounds - picked.length);
    const results = await Promise.all(
      batch.map(async (country) => ({ country, stations: await popular(world, country).catch(() => []) })),
    );
    picked.push(...results.filter((r) => r.stations.length));
  }
  if (picked.length < rounds) throw new Error('Not enough stations');
  return picked;
}
