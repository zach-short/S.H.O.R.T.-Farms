import type { TextureId } from './lib/textures';
import type { FeatureKind, FeatureProps, GeometryMode } from './types';

/** How a drawn feature's surface is painted. */
export interface Surface {
  /** Procedural texture to use when no image file is supplied. */
  texture: TextureId;
  /**
   * Real-world size of one texture tile, in metres. Drives how often the
   * texture repeats so grain stays consistent across large and small features.
   */
  tileMetres: number;
  /** Multiplied over the texture — use white to leave it untouched. */
  tint: string;
  alpha: number;
  /**
   * Path to a photographic texture under `public/`, e.g.
   * `/textures/asphalt.jpg`. Takes over from the procedural one when set.
   */
  url?: string;
}

export interface FeatureSpec {
  kind: FeatureKind;
  label: string;
  /** Plural noun used in counts, e.g. "3 ponds". */
  plural: string;
  shortcut: string;
  mode: GeometryMode;
  /** Toolbar grouping — a divider is drawn between groups. */
  group: 'structure' | 'line' | 'area' | 'planting';
  color: string;
  hint: string;
  defaults: FeatureProps;
  /** Footprint of the placed volume, in metres: [east, north, up]. */
  size?: [number, number, number];
  /** Textured surface for drawn kinds; flat colour when omitted. */
  surface?: Surface;
  /** Dashed centreline painted over the surface, as on a runway. */
  centreline?: { color: string; dashLength: number };
}

const drawHint = (what: string, min: string) =>
  `Click to add points along the ${what}. ${min} Drag a point to move it. ` +
  'Enter or double-click to finish, Backspace undoes, Esc cancels.';

export const FEATURE_SPECS: FeatureSpec[] = [
  {
    kind: 'house',
    label: 'House',
    plural: 'houses',
    shortcut: 'H',
    mode: 'point',
    group: 'structure',
    color: '#e2e8f0',
    hint: 'Click the ground to place a house. Esc returns to Select.',
    defaults: { heading: 0 },
    size: [14, 11, 8],
  },
  {
    kind: 'restaurant',
    label: 'Restaurant',
    plural: 'restaurants',
    shortcut: 'F',
    mode: 'point',
    group: 'structure',
    color: '#fb923c',
    hint: 'Click the ground to place the restaurant. Esc returns to Select.',
    defaults: { heading: 0 },
    size: [24, 16, 7],
  },
  {
    kind: 'marina',
    label: 'Marina',
    plural: 'marinas',
    shortcut: 'M',
    mode: 'point',
    group: 'structure',
    color: '#22d3ee',
    hint: 'Click the shoreline to place the marina. Esc returns to Select.',
    defaults: { heading: 0 },
    size: [30, 18, 5],
  },
  {
    kind: 'road',
    label: 'Road',
    plural: 'roads',
    shortcut: 'R',
    mode: 'polyline',
    group: 'line',
    color: '#d6d3d1',
    hint: drawHint('road', 'Two points minimum.'),
    defaults: { width: 6, smoothing: 0.45 },
    surface: { texture: 'gravel', tileMetres: 10, tint: '#ffffff', alpha: 1 },
  },
  {
    kind: 'river',
    label: 'River',
    plural: 'rivers',
    shortcut: 'W',
    mode: 'polyline',
    group: 'line',
    color: '#38bdf8',
    hint: drawHint('watercourse', 'Two points minimum.'),
    // A watercourse is never straight — a handful of clicks plus heavy
    // smoothing beats tracing every meander by hand.
    defaults: { width: 12, smoothing: 0.85 },
    surface: { texture: 'water', tileMetres: 34, tint: '#ffffff', alpha: 0.92 },
  },
  {
    kind: 'airstrip',
    label: 'Air strip',
    plural: 'air strips',
    shortcut: 'A',
    mode: 'polyline',
    group: 'line',
    color: '#94a3b8',
    hint: drawHint('runway centreline', 'Two points minimum.'),
    // Runways are surveyed straight, so this one stays unrounded by default.
    defaults: { width: 24, smoothing: 0 },
    surface: { texture: 'asphalt', tileMetres: 22, tint: '#ffffff', alpha: 1 },
    centreline: { color: '#f8fafc', dashLength: 26 },
  },
  {
    kind: 'pond',
    label: 'Pond',
    plural: 'ponds',
    shortcut: 'P',
    mode: 'polygon',
    group: 'area',
    color: '#38bdf8',
    hint: drawHint("pond's edge", 'Three points minimum.'),
    defaults: { smoothing: 0.8 },
    surface: { texture: 'water', tileMetres: 34, tint: '#ffffff', alpha: 0.9 },
  },
  {
    kind: 'garden',
    label: 'Garden',
    plural: 'gardens',
    shortcut: 'G',
    mode: 'polygon',
    group: 'area',
    color: '#a3e635',
    hint: drawHint('garden bed', 'Three points minimum.'),
    defaults: { smoothing: 0.35 },
    surface: { texture: 'soil', tileMetres: 10, tint: '#ffffff', alpha: 0.95 },
  },
  {
    kind: 'tree',
    label: 'Tree',
    plural: 'trees',
    shortcut: 'T',
    mode: 'point',
    group: 'planting',
    color: '#22c55e',
    hint: 'Click the ground to plant a tree. Keep clicking to plant more — Esc returns to Select.',
    defaults: {},
    size: [7, 7, 9],
  },
];

export const specByKind = Object.fromEntries(FEATURE_SPECS.map((s) => [s.kind, s])) as Record<
  FeatureKind,
  FeatureSpec
>;

/** Trees get a bare canopy; the other point kinds get a rectangular footprint. */
export const isStructure = (kind: FeatureKind) =>
  specByKind[kind].mode === 'point' && kind !== 'tree';

export const minimumVertices = (mode: GeometryMode) => (mode === 'polygon' ? 3 : 2);
