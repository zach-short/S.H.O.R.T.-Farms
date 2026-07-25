/**
 * Corner rounding for hand-traced shapes.
 *
 * A river or pond edge traced by clicking is a chain of straight segments, and
 * getting a natural curve out of that would mean placing a vertex every couple
 * of metres. Instead the stored vertices stay exactly where they were put and a
 * Cardinal spline is sampled through them at draw time, so a dozen clicks read
 * as a smooth bank.
 */

/** A point in any 3-component space — [lon, lat, height] or ECEF [x, y, z]. */
export type Triple = [number, number, number];

/** Samples per source segment at full smoothing. */
const MAX_SAMPLES = 10;
/** Ceiling on generated points, so a long traced path stays cheap to draw. */
const MAX_POINTS = 900;

/**
 * A Cardinal spline is a linear combination of its control points, so scaling
 * the axes independently — as degrees of longitude and latitude are — gives the
 * same curve as scaling the result. Working directly in degrees is therefore
 * exact, not an approximation.
 */
function cardinal(p0: Triple, p1: Triple, p2: Triple, p3: Triple, t: number, c: number): Triple {
  const t2 = t * t;
  const t3 = t2 * t;
  // Cubic Hermite basis.
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const out: Triple = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const m1 = c * (p2[k] - p0[k]);
    const m2 = c * (p3[k] - p1[k]);
    out[k] = h00 * p1[k] + h10 * m1 + h01 * p2[k] + h11 * m2;
  }
  return out;
}

/**
 * Samples a spline through `points`. `smoothing` runs 0 (the original polyline,
 * untouched) to 1 (a full Catmull-Rom curve). Every input vertex is on the
 * result, so dragging a handle still moves the shape exactly where expected.
 */
export function smoothTriples(points: Triple[], smoothing: number, closed: boolean): Triple[] {
  if (smoothing <= 0 || points.length < 3) return points;

  const n = points.length;
  const segments = closed ? n : n - 1;
  // Tension 0.5 is the Catmull-Rom case; below that the curve tightens back
  // toward the straight chain.
  const tension = 0.5 * Math.min(1, smoothing);
  const steps = Math.max(
    1,
    Math.min(
      Math.round(1 + smoothing * (MAX_SAMPLES - 1)),
      Math.floor(MAX_POINTS / segments) || 1,
    ),
  );
  if (steps === 1) return points;

  // Open paths mirror their end points so the first and last segment get a
  // sensible tangent instead of curling away.
  const at = (i: number) =>
    closed ? points[((i % n) + n) % n] : points[Math.min(n - 1, Math.max(0, i))];

  const out: Triple[] = [];
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 0; s < steps; s++) {
      out.push(s === 0 ? p1 : cardinal(p0, p1, p2, p3, s / steps, tension));
    }
  }
  // A closed ring wraps back to its first point on its own; an open path needs
  // its final vertex added explicitly.
  if (!closed) out.push(points[n - 1]);
  return out;
}

/**
 * Memoised by input array identity. Stored geometry arrays are replaced rather
 * than mutated, so a cache hit means nothing about the shape has changed.
 */
const cache = new WeakMap<Triple[], { smoothing: number; closed: boolean; result: Triple[] }>();

export function smoothPath(points: Triple[], smoothing: number, closed: boolean): Triple[] {
  const hit = cache.get(points);
  if (hit && hit.smoothing === smoothing && hit.closed === closed) return hit.result;

  const result = smoothTriples(points, smoothing, closed);
  cache.set(points, { smoothing, closed, result });
  return result;
}
