// Radio Browser (https://www.radio-browser.info) is a free, community-run, public-domain directory of
// internet radio that welcomes third-party apps. Streams play straight from each broadcaster's own
// server; nothing here goes through any other directory or player.

export interface Station {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  countrycode: string;
  state: string;
  codec: string;
  hls: number;
  geo_lat: number | null;
  geo_long: number | null;
}

interface Country {
  iso_3166_1: string;
  stationcount: number;
}

// Used when the server list can't be fetched. The API asks clients to spread load across mirrors.
const FALLBACK_SERVERS = ['de1.api.radio-browser.info', 'de2.api.radio-browser.info'];
const TIMEOUT_MS = 8000;

let servers: Promise<string[]> | undefined;

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function listServers() {
  servers ??= fetch('https://all.api.radio-browser.info/json/servers', { signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then((r) => r.json() as Promise<{ name: string }[]>)
    .then((list) => {
      const names = shuffle([...new Set(list.map((s) => s.name))]);
      return names.length ? names : shuffle(FALLBACK_SERVERS);
    })
    .catch(() => shuffle(FALLBACK_SERVERS));
  return servers;
}

// Tries each mirror in turn. A mirror that fails is moved to the back so later calls skip it.
async function get<T>(path: string): Promise<T> {
  const list = await listServers();
  for (let attempt = 0; attempt < list.length; attempt++) {
    const host = list[0];
    try {
      const res = await fetch(`https://${host}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // fall through to the next mirror
    }
    list.push(list.shift()!);
  }
  throw new Error('Radio Browser is unreachable');
}

export function getCountries() {
  return get<Country[]>('/json/countries');
}

export function getStats() {
  return get<{ stations: number; countries: number; languages: number }>('/json/stats');
}

// Only stations a browser can play from an https page with no extra libraries: plain https streams
// (no HLS) in a codec every major browser decodes, that passed Radio Browser's last check.
const PLAYABLE_CODECS = new Set(['MP3', 'AAC', 'AAC+']);

// A country's playable stations, most popular first: by listener votes, or by plays through
// Radio Browser apps.
export async function getStations(countrycode: string, order: 'votes' | 'clickcount'): Promise<Station[]> {
  const q = new URLSearchParams({
    countrycode,
    has_geo_info: 'true',
    is_https: 'true',
    hidebroken: 'true',
    order,
    reverse: 'true',
    limit: '40',
  });
  const stations = await get<Station[]>(`/json/stations/search?${q}`);
  return stations.filter((s) => s.hls === 0 && PLAYABLE_CODECS.has(s.codec) && streamUrl(s));
}

export function streamUrl(s: Station) {
  return [s.url_resolved, s.url].find((u) => u?.startsWith('https://')) ?? '';
}

// Radio Browser asks apps to report a play so its popularity rankings stay useful.
export function reportPlay(s: Station) {
  get(`/json/url/${s.stationuuid}`).catch(() => {});
}
