import { distanceKm } from './geo';
import type { Coords } from './world';

type City = [name: string, country: string, lon: number, lat: number, population: number];

// A station filed in a suburb should still read as the city people know, so the biggest place
// within METRO_KM wins. Failing that, the nearest place within NEARBY_KM. Beyond that, no name.
const METRO_KM = 30;
const NEARBY_KM = 100;

let cities: Promise<City[]> | undefined;

export function loadCities() {
  cities ??= fetch(`${import.meta.env.BASE_URL}cities.json`)
    .then((r) => r.json() as Promise<City[]>)
    .catch(() => {
      cities = undefined; // try again next time
      return [];
    });
  return cities;
}

// The city a point is in or near, within the given country.
export function cityNear(list: City[], point: Coords, country: string): string | undefined {
  let metro: { name: string; pop: number } | undefined;
  let nearest: { name: string; km: number } | undefined;
  for (const [name, code, lon, lat, pop] of list) {
    if (code !== country) continue;
    const km = distanceKm(point, [lon, lat]);
    if (km <= METRO_KM && (!metro || pop > metro.pop)) metro = { name, pop };
    if (km <= NEARBY_KM && (!nearest || km < nearest.km)) nearest = { name, km };
  }
  return metro?.name ?? nearest?.name;
}
