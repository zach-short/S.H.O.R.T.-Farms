import {
  ArcType,
  BoundingSphere,
  Cartesian3,
  Color,
  ClassificationType,
  ConstantProperty,
  Entity,
  HeadingPitchRange,
  KmlDataSource,
  Math as CesiumMath,
  PolygonHierarchy,
  type Viewer,
} from 'cesium';
import { CAMERA, PARCEL_CENTER } from '../config';
import type { KmlSource } from '../types';

const FILL = Color.fromCssColorString('#22d3ee').withAlpha(0.16);
const OUTLINE = Color.fromCssColorString('#67e8f9');
const LINE = Color.fromCssColorString('#fbbf24');

export async function loadKmlLayer(viewer: Viewer, kml: KmlSource): Promise<KmlDataSource> {
  const blob = new Blob([kml.text], { type: 'application/vnd.google-earth.kml+xml' });
  const dataSource = await KmlDataSource.load(blob, {
    camera: viewer.camera,
    canvas: viewer.canvas,
    clampToGround: true,
    screenOverlayContainer: undefined,
  });

  // Snapshot first: styleEntity appends outline polylines, and entities.values
  // is live — iterating it directly would restyle the outlines we just added.
  for (const entity of [...dataSource.entities.values]) {
    styleEntity(dataSource, entity);
  }

  await viewer.dataSources.add(dataSource);
  viewer.scene.requestRender();
  return dataSource;
}

function styleEntity(dataSource: KmlDataSource, entity: Entity) {
  if (entity.polygon) {
    entity.polygon.material = FILL as never;
    entity.polygon.classificationType = new ConstantProperty(ClassificationType.BOTH);
    entity.polygon.outline = new ConstantProperty(false);

    // Clamped polygons ignore `outline`, so the bright edge is drawn as a
    // separate ground polyline traced from the polygon's own hierarchy.
    const hierarchy = entity.polygon.hierarchy?.getValue(
      dataSource.clock?.currentTime ?? undefined,
    ) as PolygonHierarchy | undefined;

    if (hierarchy?.positions?.length) {
      dataSource.entities.add({
        polyline: {
          positions: [...hierarchy.positions, hierarchy.positions[0]],
          width: 3,
          material: OUTLINE,
          clampToGround: true,
          arcType: ArcType.GEODESIC,
          classificationType: ClassificationType.BOTH,
        },
      });
    }
  }

  if (entity.polyline) {
    entity.polyline.material = LINE as never;
    entity.polyline.width = new ConstantProperty(4);
    entity.polyline.clampToGround = new ConstantProperty(true);
    entity.polyline.classificationType = new ConstantProperty(ClassificationType.BOTH);
    // KML emits arcType NONE for untessellated lines, which ground-clamped
    // polylines reject outright.
    entity.polyline.arcType = new ConstantProperty(ArcType.GEODESIC);
  }

  // Google Earth pin icons are remote images we neither need nor want to fetch.
  if (entity.billboard) {
    entity.billboard = undefined;
    entity.point = {
      pixelSize: 9,
      color: OUTLINE,
      outlineColor: Color.BLACK.withAlpha(0.6),
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    } as never;
  }

  if (entity.label) {
    entity.label.fillColor = new ConstantProperty(Color.WHITE);
    entity.label.outlineColor = new ConstantProperty(Color.BLACK.withAlpha(0.8));
    entity.label.outlineWidth = new ConstantProperty(3);
    entity.label.disableDepthTestDistance = new ConstantProperty(Number.POSITIVE_INFINITY);
  }
}

/** Every cartesian the KML actually draws, so framing is based on real extent. */
function collectPositions(viewer: Viewer, dataSource: KmlDataSource): Cartesian3[] {
  const time = viewer.clock.currentTime;
  const positions: Cartesian3[] = [];

  for (const entity of dataSource.entities.values) {
    const hierarchy = entity.polygon?.hierarchy?.getValue(time) as PolygonHierarchy | undefined;
    if (hierarchy?.positions) positions.push(...hierarchy.positions);

    const line = entity.polyline?.positions?.getValue(time) as Cartesian3[] | undefined;
    if (line) positions.push(...line);

    const point = entity.position?.getValue(time);
    if (point) positions.push(point);
  }

  return positions;
}

export async function flyToParcel(viewer: Viewer, dataSource: KmlDataSource) {
  const positions = collectPositions(viewer, dataSource);

  const sphere = positions.length
    ? BoundingSphere.fromPoints(positions)
    : new BoundingSphere(
        Cartesian3.fromDegrees(PARCEL_CENTER.lon, PARCEL_CENTER.lat),
        CAMERA.fallbackRange,
      );

  // flyTo's automatic range frames the sphere tightly and unpredictably; an
  // explicit multiple of the radius keeps the whole parcel comfortably in shot.
  await viewer.camera.flyToBoundingSphere(sphere, {
    duration: 2.5,
    offset: new HeadingPitchRange(
      CesiumMath.toRadians(CAMERA.heading),
      CesiumMath.toRadians(CAMERA.pitch),
      Math.max(sphere.radius * CAMERA.rangeFactor, 400),
    ),
  });
}

export function removeKmlLayer(viewer: Viewer, dataSource: KmlDataSource) {
  viewer.dataSources.remove(dataSource, true);
  viewer.scene.requestRender();
}
