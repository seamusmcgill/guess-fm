import { geoArea, geoBounds, geoCentroid, geoContains } from 'd3-geo';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

export type Coords = [lon: number, lat: number];

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  label: string; // Natural Earth's short map label, e.g. "Dem. Rep. Congo"
  shape: Feature<Polygon | MultiPolygon>;
  labelAt: Coords; // centroid of the largest landmass, so France's label isn't pulled toward Guiana
  bounds: [Coords, Coords];
}

export interface World {
  countries: Country[];
  codes: Set<string>;
}

let world: Promise<World> | undefined;

// Largest polygon of a (multi)polygon, by spherical area.
function mainland(shape: Feature<Polygon | MultiPolygon>): Feature<Polygon> {
  const g = shape.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const parts = polys.map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } }) as Feature<Polygon>);
  return parts.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
}

export function loadWorld() {
  world ??= fetch(`${import.meta.env.BASE_URL}world.json`) // BASE_URL is /guess-fm/ on GitHub Pages, / on a custom domain
    .then((r) => r.json() as Promise<Topology<{ countries: GeometryCollection<{ name: string }> }>>)
    .then((topo) => {
      const fc = feature(topo, topo.objects.countries);
      const countries = fc.features.map((f) => {
        const shape = f as Feature<Polygon | MultiPolygon, { name: string }>;
        return {
          code: String(f.id),
          label: shape.properties.name,
          shape,
          labelAt: geoCentroid(mainland(shape)) as Coords,
          bounds: geoBounds(shape) as [Coords, Coords],
        };
      });
      return { countries, codes: new Set(countries.map((c) => c.code)) };
    });
  return world;
}

function inBounds([lon, lat]: Coords, [[w, s], [e, n]]: [Coords, Coords]) {
  if (lat < s || lat > n) return false;
  return w <= e ? lon >= w && lon <= e : lon >= w || lon <= e; // bounds that cross the antimeridian
}

// The country containing a point, or undefined for the sea.
export function countryAt(w: World, point: Coords) {
  return w.countries.find((c) => inBounds(point, c.bounds) && geoContains(c.shape, point))?.code;
}

const names = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string) {
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}
