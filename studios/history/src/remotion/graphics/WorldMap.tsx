// ---------------------------------------------------------------------------
// A world map with countries highlighted - the most-asked-for news graphic.
//
// Drawn from Natural Earth outlines (world-atlas, 1:110m) with d3-geo, zoomed
// to fit the highlighted countries (never closer than a sensible region, so a
// small country does not fill the screen). Borders follow Natural Earth's
// de facto lines, which differ from some countries' official maps - the editor
// says so when that matters.
// ---------------------------------------------------------------------------

import React, { useMemo } from 'react';
import { geoArea, geoBounds, geoCentroid, geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import world from 'world-atlas/countries-110m.json';
import { easeOut, type Palette, SANS } from './theme';

type Country = Feature<Geometry, { name: string }>;

const topology = world as unknown as Parameters<typeof feature>[0];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COUNTRIES: Country[] = (feature(topology, (topology as any).objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>).features;

/** What people call countries, against what Natural Earth calls them. */
const ALIASES: Record<string, string> = {
  usa: 'United States of America', us: 'United States of America', 'united states': 'United States of America', america: 'United States of America',
  uk: 'United Kingdom', britain: 'United Kingdom', 'great britain': 'United Kingdom', england: 'United Kingdom',
  'czech republic': 'Czechia', 'ivory coast': "Côte d'Ivoire", "cote d'ivoire": "Côte d'Ivoire",
  'drc': 'Dem. Rep. Congo', 'democratic republic of the congo': 'Dem. Rep. Congo', 'dr congo': 'Dem. Rep. Congo',
  'republic of the congo': 'Congo', uae: 'United Arab Emirates', 'south sudan': 'S. Sudan',
  'central african republic': 'Central African Rep.', 'bosnia and herzegovina': 'Bosnia and Herz.',
  'dominican republic': 'Dominican Rep.', 'north macedonia': 'Macedonia', 'eswatini': 'eSwatini',
  'myanmar': 'Myanmar', burma: 'Myanmar', 'gaza': 'Palestine', 'west bank': 'Palestine', 'palestinian territories': 'Palestine',
  'south korea': 'South Korea', 'korea': 'South Korea', 'north korea': 'North Korea', 'russian federation': 'Russia',
  'equatorial guinea': 'Eq. Guinea', 'solomon islands': 'Solomon Is.', 'falkland islands': 'Falkland Is.',
  'western sahara': 'W. Sahara', 'timor-leste': 'Timor-Leste', 'east timor': 'Timor-Leste',
};

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z' -]/g, '').trim();
const BY_NAME = new Map(COUNTRIES.map((c) => [norm(c.properties.name), c]));

/** The country a name means, or undefined. */
export function findCountry(name: string): Country | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const alias = ALIASES[n];
  return BY_NAME.get(alias ? norm(alias) : n);
}

/** Names that are on the map. */
export const knownCountries = (): string[] => COUNTRIES.map((c) => c.properties.name).sort();

/** Countries whose official maps differ from Natural Earth's de facto borders. */
export const DISPUTED_BORDERS = ['India', 'Pakistan', 'China'];

/**
 * A country's biggest piece. France includes French Guiana and the USA includes
 * Alaska; zooming or labelling on the whole multipolygon pulls the view to the
 * wrong place, so framing and labels use the mainland.
 */
export function mainland(c: Country): Country {
  const geom = c.geometry;
  if (!geom || geom.type !== 'MultiPolygon') return c;
  let best = geom.coordinates[0];
  let bestArea = -1;
  for (const poly of geom.coordinates) {
    const a = geoArea({ type: 'Polygon', coordinates: poly });
    if (a > bestArea) { bestArea = a; best = poly; }
  }
  return { ...c, geometry: { type: 'Polygon', coordinates: best } };
}

/** A box (as a polygon) around the highlighted countries, at least `minLon` x `minLat` degrees. */
function focusArea(targets: Country[]): GeoPermissibleObjects {
  if (!targets.length) return { type: 'Sphere' };
  const fc = { type: 'FeatureCollection', features: targets.map(mainland) } as FeatureCollection;
  let [[x0, y0], [x1, y1]] = geoBounds(fc);
  if (x0 > x1 || x1 - x0 > 200) return { type: 'Sphere' }; // crosses the date line, or is half the world
  const minLon = 34;
  const minLat = 20;
  if (x1 - x0 < minLon) { const c = (x0 + x1) / 2; x0 = c - minLon / 2; x1 = c + minLon / 2; }
  if (y1 - y0 < minLat) { const c = (y0 + y1) / 2; y0 = c - minLat / 2; y1 = c + minLat / 2; }
  const padX = (x1 - x0) * 0.12;
  const padY = (y1 - y0) * 0.12;
  x0 = Math.max(-180, x0 - padX); x1 = Math.min(180, x1 + padX);
  y0 = Math.max(-85, y0 - padY); y1 = Math.min(85, y1 + padY);
  return { type: 'Polygon', coordinates: [[[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]]] } as GeoPermissibleObjects;
}

export const WorldMap: React.FC<{ countries: string[]; title: string; t: number; w: number; h: number; p: Palette; u: number; safe: number }> = ({ countries, title, t, w, h, p, u, safe }) => {
  const targets = useMemo(() => countries.map(findCountry).filter((c): c is Country => Boolean(c)), [countries]);
  const top = title ? 150 * u : 40 * u;
  const { paths, labels } = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent([[50 * u, top], [w - 50 * u, h - safe]], focusArea(targets) as never);
    const path = geoPath(projection);
    const hi = new Set(targets.map((c) => c.properties.name));
    // Labels on the mainland's centre, nudged down when they would sit on top of each other.
    const placed: { name: string; at: [number, number] | null; dy: number }[] = [];
    for (const c of targets) {
      const at = projection(geoCentroid(mainland(c))) as [number, number] | null;
      let dy = 0;
      if (at) {
        for (let tries = 0; tries < 6; tries++) {
          const clash = placed.some((o) => o.at && Math.abs(o.at[1] + o.dy - (at[1] + dy)) < 40 * u && Math.abs(o.at[0] - at[0]) < 230 * u);
          if (!clash) break;
          dy += 44 * u;
        }
      }
      placed.push({ name: c.properties.name, at, dy });
    }
    return {
      paths: COUNTRIES.map((c) => ({ name: c.properties.name, d: path(c) || '', hi: hi.has(c.properties.name) })),
      labels: placed,
    };
  }, [targets, w, h, u, top, safe]);

  const zoom = 1 + 0.04 * easeOut(t / 6);
  return (
    <>
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '50% 55%' }}>
        {paths.map((c) => (
          <path key={c.name} d={c.d} fill={p.land} stroke={p.border} strokeWidth={0.8} />
        ))}
        {paths.filter((c) => c.hi).map((c, i) => (
          <path key={'h' + c.name} d={c.d} fill={i % 2 ? p.accent2 : p.accent} stroke={p.ink} strokeWidth={1.4} opacity={easeOut((t - 0.3 - i * 0.25) / 0.6)} />
        ))}
        {labels.map((l, i) => {
          if (!l.at) return null;
          const a = easeOut((t - 0.6 - i * 0.25) / 0.5);
          const ring = (t * 0.8 + i * 0.3) % 1;
          return (
            <g key={l.name} opacity={a}>
              <circle cx={l.at[0]} cy={l.at[1]} r={8 * u + ring * 30 * u} fill="none" stroke={p.ink} strokeWidth={2} opacity={1 - ring} />
              <circle cx={l.at[0]} cy={l.at[1]} r={7 * u} fill={p.ink} />
            </g>
          );
        })}
      </svg>
      {labels.map((l, i) => (l.at ? (
        <div key={'t' + l.name} style={{
          position: 'absolute', left: l.at[0] * zoom + (w - w * zoom) / 2 + 14 * u, top: l.at[1] * zoom + (h - h * zoom) * 0.55 - 44 * u + l.dy,
          fontFamily: SANS, fontWeight: 800, fontSize: 34 * u, color: p.ink, textShadow: '0 2px 8px rgba(0,0,0,.6)',
          opacity: easeOut((t - 0.7 - i * 0.25) / 0.5), whiteSpace: 'nowrap',
        }}>{l.name}</div>
      ) : null))}
    </>
  );
};
