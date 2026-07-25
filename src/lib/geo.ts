import {
  Cartesian3,
  Cartographic,
  EllipsoidGeodesic,
  Math as CesiumMath,
  type Scene,
} from 'cesium';
import type { Geometry, LonLatHeight } from '../types';

export function cartesianToLonLatHeight(position: Cartesian3): LonLatHeight {
  const c = Cartographic.fromCartesian(position);
  return [CesiumMath.toDegrees(c.longitude), CesiumMath.toDegrees(c.latitude), c.height];
}

export function lonLatHeightToCartesian([lon, lat, height]: LonLatHeight): Cartesian3 {
  return Cartesian3.fromDegrees(lon, lat, height);
}

/**
 * Resolves a screen point to a position on whatever is actually rendered —
 * photorealistic tiles first (via the depth buffer), then terrain, then the
 * ellipsoid — so markers land on the real surface rather than sea level.
 */
/**
 * Rejects picks that can't be real ground: clicking sky or the far horizon
 * yields either nothing or a wildly out-of-range depth sample.
 */
function isPlausibleGround(position: Cartesian3 | undefined): position is Cartesian3 {
  if (!position || !Number.isFinite(Cartesian3.magnitude(position))) return false;
  const carto = Cartographic.fromCartesian(position);
  if (!carto) return false;
  return carto.height > -1500 && carto.height < 9000;
}

export function pickGround(scene: Scene, windowPosition: { x: number; y: number }) {
  if (scene.pickPositionSupported) {
    const picked = scene.pickPosition(windowPosition as never);
    if (isPlausibleGround(picked)) return picked;
  }

  const ray = scene.camera.getPickRay(windowPosition as never);
  if (ray) {
    const onGlobe = scene.globe.pick(ray, scene);
    if (isPlausibleGround(onGlobe)) return onGlobe;
  }

  const onEllipsoid = scene.camera.pickEllipsoid(windowPosition as never, scene.ellipsoid);
  return isPlausibleGround(onEllipsoid) ? onEllipsoid : undefined;
}

export function toCartesians(positions: LonLatHeight[]): Cartesian3[] {
  return positions.map(lonLatHeightToCartesian);
}

/** Anchor point for a feature's label: the vertex average for multi-point geometry. */
export function anchorOf(geometry: Geometry): LonLatHeight {
  if (geometry.type === 'point') return geometry.position;
  const points = geometry.positions;
  if (points.length === 0) return [0, 0, 0];
  const sum = points.reduce<LonLatHeight>(
    (acc, [lon, lat, height]) => [acc[0] + lon, acc[1] + lat, acc[2] + height],
    [0, 0, 0],
  );
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}

/** Ground distance along a path, in metres. */
export function pathLength(positions: LonLatHeight[]): number {
  const geodesic = new EllipsoidGeodesic();
  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    geodesic.setEndPoints(
      Cartographic.fromDegrees(positions[i - 1][0], positions[i - 1][1]),
      Cartographic.fromDegrees(positions[i][0], positions[i][1]),
    );
    total += geodesic.surfaceDistance;
  }
  return total;
}

/**
 * Planar shoelace area in a local east/north frame, in square metres. Exact
 * enough at parcel scale, where the curvature error is far below the precision
 * anyone reads off a site plan.
 */
export function polygonArea(positions: LonLatHeight[]): number {
  if (positions.length < 3) return 0;
  const [mPerDegLon, mPerDegLat] = metresPerDegree(positions[0][1]);

  let twiceArea = 0;
  for (let i = 0; i < positions.length; i++) {
    const [lonA, latA] = positions[i];
    const [lonB, latB] = positions[(i + 1) % positions.length];
    twiceArea += (lonA * mPerDegLon) * (latB * mPerDegLat) - (lonB * mPerDegLon) * (latA * mPerDegLat);
  }
  return Math.abs(twiceArea) / 2;
}

/** Metres per degree of latitude and longitude at a given latitude. */
function metresPerDegree(latitude: number): [lon: number, lat: number] {
  const latRad = CesiumMath.toRadians(latitude);
  return [
    111_412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad),
    111_132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad),
  ];
}

/**
 * Width and height of a shape's bounding box in metres. Used to work out how
 * many times a texture should repeat so its grain stays the same real-world
 * size on a small garden bed and a large pond alike.
 */
export function extentMetres(positions: LonLatHeight[]): [number, number] {
  if (positions.length === 0) return [1, 1];
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of positions) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const [mPerLon, mPerLat] = metresPerDegree((minLat + maxLat) / 2);
  return [Math.max(1, (maxLon - minLon) * mPerLon), Math.max(1, (maxLat - minLat) * mPerLat)];
}

export function formatLength(metres: number) {
  const feet = metres * 3.280_84;
  return metres >= 1000
    ? `${(metres / 1000).toFixed(2)} km · ${(feet / 5280).toFixed(2)} mi`
    : `${metres.toFixed(0)} m · ${feet.toFixed(0)} ft`;
}

export function formatArea(squareMetres: number) {
  const acres = squareMetres / 4046.856;
  return acres >= 0.1
    ? `${acres.toFixed(2)} ac · ${squareMetres.toFixed(0)} m²`
    : `${squareMetres.toFixed(0)} m² · ${(squareMetres * 10.7639).toFixed(0)} ft²`;
}

export function formatLonLat([lon, lat]: LonLatHeight) {
  const dms = (value: number, pos: string, neg: string) => {
    const hemi = value >= 0 ? pos : neg;
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(2);
    return `${deg}°${String(min).padStart(2, '0')}'${sec.padStart(5, '0')}"${hemi}`;
  };
  return `${dms(lat, 'N', 'S')} ${dms(lon, 'E', 'W')}`;
}
