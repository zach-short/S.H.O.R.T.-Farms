import {
  BoundingSphere,
  Cartesian3,
  Cesium3DTileset,
  HeadingPitchRange,
  ImageryLayer,
  Ion,
  IonImageryProvider,
  Math as CesiumMath,
  ScreenSpaceEventType,
  Viewer,
  createGooglePhotorealistic3DTileset,
  createWorldTerrainAsync,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { ION_TOKEN } from '../config';
import type { LonLatHeight } from '../types';

export interface SceneCapabilities {
  photorealistic: boolean;
  terrain: boolean;
  imagery: boolean;
}

export interface PlannerScene {
  viewer: Viewer;
  tileset: Cesium3DTileset | null;
  capabilities: SceneCapabilities;
  tilesetError: string | null;
}

export async function createPlannerScene(container: HTMLDivElement): Promise<PlannerScene> {
  Ion.defaultAccessToken = ION_TOKEN;

  const viewer = new Viewer(container, {
    // The default base layer is an ion Bing asset. Requesting it with a token
    // that doesn't grant it kills the render loop, so opt out and add imagery
    // below only if this token actually has access.
    baseLayer: false,
    animation: false,
    timeline: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    geocoder: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    // Only redraw when something changes — large GPU/battery saving on a
    // mostly-static aerial view.
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
  });

  const { scene } = viewer;
  if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
  viewer.cesiumWidget.creditContainer.classList.add('cesium-credits');

  // Cesium's default double-click locks the camera onto the picked entity,
  // which fights the draw tools' double-click-to-finish gesture.
  viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const capabilities: SceneCapabilities = {
    photorealistic: false,
    terrain: false,
    imagery: false,
  };

  let tileset: Cesium3DTileset | null = null;
  let tilesetError: string | null = null;

  // All three are independent network round-trips — run them concurrently so
  // startup costs one latency, not three. Terrain and imagery are optional:
  // a token scoped to only the Photorealistic asset still gives a usable scene.
  const [tilesetResult, terrainResult, imageryResult] = await Promise.allSettled([
    createGooglePhotorealistic3DTileset(),
    createWorldTerrainAsync(),
    IonImageryProvider.fromAssetId(3),
  ]);

  if (tilesetResult.status === 'fulfilled') {
    tileset = tilesetResult.value;
    scene.primitives.add(tileset);
    capabilities.photorealistic = true;
  } else {
    const reason = tilesetResult.reason;
    tilesetError = reason instanceof Error ? reason.message : String(reason);
  }

  if (terrainResult.status === 'fulfilled') {
    viewer.terrainProvider = terrainResult.value;
    capabilities.terrain = true;
  }

  if (imageryResult.status === 'fulfilled') {
    viewer.imageryLayers.add(new ImageryLayer(imageryResult.value));
    capabilities.imagery = true;
  }

  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.show = !capabilities.photorealistic;
  scene.requestRender();

  return { viewer, tileset, capabilities, tilesetError };
}

/**
 * Flies to a feature's footprint, keeping the current compass heading so the
 * plan doesn't spin underneath the viewer on every jump.
 */
export function flyToPositions(viewer: Viewer, positions: LonLatHeight[]) {
  if (positions.length === 0) return;
  const points = positions.map(([lon, lat, height]) =>
    Cartesian3.fromDegrees(lon, lat, height),
  );
  const bounds = BoundingSphere.fromPoints(points);
  // A single house has no extent of its own, so give it a viewing radius.
  const radius = Math.max(bounds.radius, 30);
  viewer.camera.flyToBoundingSphere(new BoundingSphere(bounds.center, radius), {
    duration: 1.1,
    offset: new HeadingPitchRange(viewer.camera.heading, CesiumMath.toRadians(-50), radius * 3.2),
  });
}

export function setPhotorealisticVisible(scene: PlannerScene, visible: boolean) {
  if (!scene.tileset) return;
  scene.tileset.show = visible;
  scene.viewer.scene.globe.show = !visible;
  scene.viewer.scene.requestRender();
}
