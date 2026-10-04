import { geoMercator, geoPath } from 'd3-geo';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Coords, World } from '../lib/world';
import Icon from './Icon';

// The same palette as the original's styled Google Map.
// Land #292621, water #6E6E80, borders #D27478, labels light on a dark halo.

const MAX_LAT = 85; // Web Mercator's usual cut-off, as Google Maps uses
const LABEL_PX_PER_CHAR = 7;

interface Props {
  world: World | null;
  pin: Coords | null;
  onPin: (at: Coords) => void;
}

export default function WorldMap({ world, pin, onPin }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);

  useLayoutEffect(() => {
    const el = svgRef.current!;
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // At zoom 1 the whole world spans the map's width.
  const projection = useMemo(
    () => geoMercator().scale(size.width / (2 * Math.PI)).translate([size.width / 2, size.width / 2]),
    [size.width],
  );

  const shapes = useMemo(() => {
    if (!world || !size.width) return [];
    const path = geoPath(projection);
    return world.countries.map((c) => {
      const [[x0], [x1]] = path.bounds(c.shape);
      return { code: c.code, label: c.label, d: path(c.shape) ?? '', at: projection(c.labelAt)!, span: x1 - x0 };
    });
  }, [world, projection, size.width]);

  // Labels go biggest-country first, so when two collide the bigger one keeps its name.
  const byArea = useMemo(() => [...shapes].sort((a, b) => b.span - a.span), [shapes]);

  useEffect(() => {
    const { width, height } = size;
    if (!width) return;
    const top = projection([0, MAX_LAT])![1];
    const bottom = projection([0, -MAX_LAT])![1];
    const minK = Math.max(1, height / (bottom - top));
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([minK, 60])
      .translateExtent([[0, top], [width, bottom]])
      .clickDistance(4)
      .on('zoom', (e: { transform: ZoomTransform }) => setT(e.transform));
    zoomRef.current = z;
    const sel = select(svgRef.current!).call(z);
    // Open on the whole world, nudged north where most of the land (and radio) is.
    const [, cy] = projection([0, 25])!;
    z.translateTo(sel, width / 2, cy);
    z.scaleTo(sel, minK);
    return () => {
      sel.on('.zoom', null);
    };
  }, [projection, size]);

  const zoomBy = (factor: number) => {
    const z = zoomRef.current;
    if (z) select(svgRef.current!).transition().duration(250).call(z.scaleBy, factor);
  };

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = svgRef.current!.getBoundingClientRect();
    const [x, y] = t.invert([e.clientX - r.left, e.clientY - r.top]);
    const at = projection.invert?.([x, y]);
    if (at && Math.abs(at[1]) <= MAX_LAT) onPin(at as Coords);
  };

  const labels = useMemo(() => {
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const out: { code: string; label: string; x: number; y: number }[] = [];
    for (const s of byArea) {
      const w = s.label.length * LABEL_PX_PER_CHAR;
      if (s.span * t.k < w * 1.1) continue;
      const [x, y] = t.apply(s.at);
      if (x < -w || x > size.width + w || y < -20 || y > size.height + 20) continue;
      const box = { x0: x - w / 2, x1: x + w / 2, y0: y - 9, y1: y + 9 };
      if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
      placed.push(box);
      out.push({ code: s.code, label: s.label, x, y });
    }
    return out;
  }, [byArea, t, size]);

  const pinAt = pin && t.apply(projection(pin)!);

  return (
    <div className="map">
      <svg ref={svgRef} onClick={onClick} role="application" aria-label="World map. Click to drop your pin.">
        <g transform={t.toString()}>
          {shapes.map((s, i) => (
            <path key={`${s.code}-${i}`} d={s.d} className="land" />
          ))}
        </g>
        <g className="labels">
          {labels.map((l) => (
            <text key={l.code + l.label} x={l.x} y={l.y}>
              {l.label}
            </text>
          ))}
        </g>
      </svg>
      {pinAt && (
        <div className="marker" style={{ left: pinAt[0], top: pinAt[1] }}>
          <div className="pulse" />
        </div>
      )}
      <div className="zoom-controls">
        <button aria-label="Zoom in" onClick={() => zoomBy(1.8)}>
          <Icon name="plus" />
        </button>
        <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.8)}>
          <Icon name="minus" />
        </button>
      </div>
    </div>
  );
}
