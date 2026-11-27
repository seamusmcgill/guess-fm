import { geoMercator, geoPath } from 'd3-geo';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Reveal } from '../hooks/useGame';
import type { Coords, World } from '../lib/world';
import Icon from './Icon';

// The same palette as the original's styled Google Map.
// Land #292621, water #6E6E80, borders #D27478, labels light on a dark halo.

const MAX_LAT = 85; // Web Mercator's usual cut-off, as Google Maps uses
const LABEL_PX_PER_CHAR = 7;

// When a round ends the map flies to show both the pin and the station, then an arc draws from one
// to the other and the station's marker drops in. useGame waits for this before the recap dialog.
const REVEAL_FLY_MS = 800;
const REVEAL_DRAW_MS = 450;
const REVEAL_MAX_ZOOM = 6; // so a near miss still shows some of the country around it
const REVEAL_FILL = 0.5; // the pin and station span at most half the view

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Longitude back into [-180, 180) after panning round the world any number of times.
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

interface Props {
  world: World | null;
  pin: Coords | null;
  reveal: Reveal | null;
  onPin: (at: Coords) => void;
}

export default function WorldMap({ world, pin, reveal, onPin }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>(null);
  const minZoom = useRef(1);
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
      // No left/right limit: the world repeats sideways, as on Google Maps.
      .translateExtent([[-Infinity, top], [Infinity, bottom]])
      .clickDistance(4)
      .on('zoom', (e: { transform: ZoomTransform }) => setT(e.transform));
    zoomRef.current = z;
    minZoom.current = minK;
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
    if (at && Math.abs(at[1]) <= MAX_LAT) onPin([wrapLon(at[0]), at[1]]);
  };

  // Which copies of the world are in view. At zoom 1 one copy is `size.width` wide.
  const copies = useMemo(() => {
    const w = size.width;
    if (!w) return [0];
    const first = Math.floor(t.invertX(0) / w);
    const last = Math.floor(t.invertX(w) / w);
    const out: number[] = [];
    for (let n = first; n <= last; n++) out.push(n);
    return out;
  }, [t, size.width]);

  const land = useMemo(
    () => shapes.map((s, i) => <path key={`${s.code}-${i}`} d={s.d} className="land" />),
    [shapes],
  );

  const labels = useMemo(() => {
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const out: { key: string; label: string; x: number; y: number }[] = [];
    for (const n of copies)
    for (const s of byArea) {
      const w = s.label.length * LABEL_PX_PER_CHAR;
      if (s.span * t.k < w * 1.1) continue;
      const [x, y] = t.apply([s.at[0] + n * size.width, s.at[1]]);
      if (x < -w || x > size.width + w || y < -20 || y > size.height + 20) continue;
      const box = { x0: x - w / 2, x1: x + w / 2, y0: y - 9, y1: y + 9 };
      if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
      placed.push(box);
      out.push({ key: `${n}:${s.code}:${s.label}`, label: s.label, x, y });
    }
    return out;
  }, [byArea, copies, t, size]);

  // `x` moved by whole world-widths to the copy nearest `near` (all at zoom 1).
  const nearestCopy = (x: number, near: number) => x + Math.round((near - x) / size.width) * size.width;

  // The pin goes on whichever copy of the world is nearest the middle of the view, and the revealed
  // station on the copy nearest the pin, so the arc between them takes the short way round.
  const revealAt = (view: ZoomTransform) => {
    if (!reveal) return null;
    const [ax, ay] = projection(reveal.from)!;
    const [bx, by] = projection(reveal.to)!;
    const a: [number, number] = [nearestCopy(ax, view.invertX(size.width / 2)), ay];
    return { a, b: [nearestCopy(bx, a[0]), by] as [number, number] };
  };

  useEffect(() => {
    const z = zoomRef.current;
    if (!reveal || !z || !size.width) return;
    const { a, b } = revealAt(t)!;
    const k = Math.max(
      minZoom.current,
      Math.min(REVEAL_MAX_ZOOM, (size.width * REVEAL_FILL) / Math.abs(a[0] - b[0]), (size.height * REVEAL_FILL) / Math.abs(a[1] - b[1])),
    );
    const to = zoomIdentity
      .translate(size.width / 2, size.height / 2)
      .scale(k)
      .translate(-(a[0] + b[0]) / 2, -(a[1] + b[1]) / 2);
    select(svgRef.current!).transition().duration(reducedMotion() ? 0 : REVEAL_FLY_MS).call(z.transform, to);
    // Only when a new reveal starts: following `t` would fight the player panning afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  const pinAt = useMemo(() => {
    if (!pin || !size.width) return null;
    const [px, py] = projection(pin)!;
    return t.apply([nearestCopy(px, t.invertX(size.width / 2)), py]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, projection, t, size.width]);

  // The arc from pin to station, bowed upward like a flight path, in screen pixels.
  const revealed = (() => {
    const at = size.width ? revealAt(t) : null;
    if (!at) return null;
    const [ax, ay] = t.apply(at.a);
    const [bx, by] = t.apply(at.b);
    const len = Math.hypot(bx - ax, by - ay);
    // Perpendicular to the line, pointing up the screen.
    let [nx, ny] = len ? [(ay - by) / len, (bx - ax) / len] : [0, -1];
    if (ny > 0) [nx, ny] = [-nx, -ny];
    const cx = (ax + bx) / 2 + nx * len * 0.2;
    const cy = (ay + by) / 2 + ny * len * 0.2;
    return { d: `M${ax},${ay} Q${cx},${cy} ${bx},${by}`, station: [bx, by] };
  })();

  return (
    <div className="map">
      <svg ref={svgRef} onClick={onClick} role="application" aria-label="World map. Click to drop your pin.">
        <g transform={t.toString()}>
          {copies.map((n) => (
            <g key={n} transform={n ? `translate(${n * size.width},0)` : undefined}>
              {land}
            </g>
          ))}
        </g>
        <g className="labels">
          {labels.map((l) => (
            <text key={l.key} x={l.x} y={l.y}>
              {l.label}
            </text>
          ))}
        </g>
      </svg>
      {reveal && revealed && (
        <svg className="reveal-arc" style={{ '--fly': `${REVEAL_FLY_MS}ms`, '--draw': `${REVEAL_DRAW_MS}ms` } as React.CSSProperties}>
          {/* The dots stay put; a mask that draws along the arc uncovers them from the pin outward. */}
          <mask id="reveal-mask" maskUnits="userSpaceOnUse" x="-100%" y="-100%" width="300%" height="300%">
            <path key={`${reveal.from}-${reveal.to}`} className="reveal-draw" d={revealed.d} pathLength={1} />
          </mask>
          <path className="reveal-dots" d={revealed.d} mask="url(#reveal-mask)" />
        </svg>
      )}
      {pinAt && (
        <div className="marker" style={{ left: pinAt[0], top: pinAt[1] }}>
          <div className="pulse" />
        </div>
      )}
      {reveal && revealed && (
        <div
          key={`${reveal.from}-${reveal.to}`}
          className="marker station"
          style={{ left: revealed.station[0], top: revealed.station[1], '--delay': `${REVEAL_FLY_MS + REVEAL_DRAW_MS}ms` } as React.CSSProperties}
        >
          <div className="station-dot" />
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
