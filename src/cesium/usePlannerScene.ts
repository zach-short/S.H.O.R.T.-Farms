import { useCallback, useEffect, useRef, useState } from 'react';
import type { KmlDataSource } from 'cesium';
import type { PlannerScene, SceneCapabilities } from './viewer';
import type { FeatureLayer } from './featureLayer';
import type { ToolController } from './tools';
import { selectActiveProject, usePlannerStore } from '../state/store';
import { outlineOf } from '../lib/shape';
import type { KmlSource, PlacedFeature } from '../types';

export type SceneStatus =
  | { phase: 'loading' }
  | { phase: 'ready'; tilesetError: string | null; capabilities: SceneCapabilities }
  | { phase: 'error'; message: string };

const NO_FEATURES: PlacedFeature[] = [];

/**
 * Cesium is ~1.2 MB gzipped. Importing it inside the effect rather than at
 * module scope lets the UI shell paint while the engine streams in.
 */
const loadEngine = () =>
  Promise.all([
    import('./viewer'),
    import('./kmlLayer'),
    import('./featureLayer'),
    import('./tools'),
  ]);

export function usePlannerScene(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [status, setStatus] = useState<SceneStatus>({ phase: 'loading' });
  const sceneRef = useRef<PlannerScene | null>(null);
  // Set once the lazily-imported engine is up; Cesium must not be pulled into
  // the shell bundle just to expose this.
  const flyToFeatureRef = useRef<((feature: PlacedFeature) => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let scene: PlannerScene | null = null;
    let layer: FeatureLayer | null = null;
    let controller: ToolController | null = null;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        const [viewerMod, kmlMod, featureMod, toolsMod] = await loadEngine();
        if (cancelled) return;

        const created = await viewerMod.createPlannerScene(container);
        if (cancelled) {
          created.viewer.destroy();
          return;
        }

        scene = created;
        sceneRef.current = created;
        layer = new featureMod.FeatureLayer(created.viewer);
        controller = new toolsMod.ToolController(created.viewer, layer);
        flyToFeatureRef.current = (feature) =>
          viewerMod.flyToPositions(created.viewer, outlineOf(feature));

        let kmlDataSource: KmlDataSource | null = null;
        let kmlToken = 0;

        const syncKml = async (kml: KmlSource | null) => {
          if (!scene) return;
          const token = ++kmlToken;

          if (kmlDataSource) {
            kmlMod.removeKmlLayer(scene.viewer, kmlDataSource);
            kmlDataSource = null;
          }
          if (!kml) return;

          const dataSource = await kmlMod.loadKmlLayer(scene.viewer, kml);
          // A newer KML started loading while this one was still parsing.
          if (cancelled || token !== kmlToken) {
            kmlMod.removeKmlLayer(scene.viewer, dataSource);
            return;
          }

          kmlDataSource = dataSource;
          dataSource.show = usePlannerStore.getState().showBoundary;
          await kmlMod.flyToParcel(scene.viewer, dataSource);
        };

        let prevKml: KmlSource | null = null;
        let prevFeatures: PlacedFeature[] = NO_FEATURES;
        let prevSelected: string | null = null;
        let prevEditTarget: PlacedFeature | null = null;
        let prevPhoto = usePlannerStore.getState().showPhotorealistic;
        let prevBoundary = usePlannerStore.getState().showBoundary;

        const apply = (state: ReturnType<typeof usePlannerStore.getState>) => {
          const project = selectActiveProject(state);

          const kml = project?.kml ?? null;
          if (kml !== prevKml) {
            prevKml = kml;
            void syncKml(kml);
          }

          const features = project?.features ?? NO_FEATURES;
          if (features !== prevFeatures || state.selectedId !== prevSelected) {
            prevFeatures = features;
            prevSelected = state.selectedId;
            layer?.sync(features, state.selectedId);
          }

          // Vertex handles belong to a drawn shape selected with the Select
          // tool. Any other tool owns the pointer, so they come off.
          const editTarget =
            state.tool === 'select'
              ? (features.find(
                  (f) => f.id === state.selectedId && f.geometry.type !== 'point',
                ) ?? null)
              : null;
          if (editTarget !== prevEditTarget) {
            prevEditTarget = editTarget;
            layer?.setEditing(editTarget);
          }

          if (state.showPhotorealistic !== prevPhoto) {
            prevPhoto = state.showPhotorealistic;
            if (scene) viewerMod.setPhotorealisticVisible(scene, state.showPhotorealistic);
          }

          if (state.showBoundary !== prevBoundary) {
            prevBoundary = state.showBoundary;
            if (kmlDataSource) {
              kmlDataSource.show = state.showBoundary;
              scene?.viewer.scene.requestRender();
            }
          }
        };

        unsubscribe = usePlannerStore.subscribe(apply);
        apply(usePlannerStore.getState());

        setStatus({
          phase: 'ready',
          tilesetError: created.tilesetError,
          capabilities: created.capabilities,
        });
      } catch (error) {
        if (cancelled) return;
        setStatus({
          phase: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      controller?.destroy();
      layer?.destroy();
      if (scene && !scene.viewer.isDestroyed()) scene.viewer.destroy();
      sceneRef.current = null;
      flyToFeatureRef.current = null;
    };
  }, [containerRef]);

  const flyHome = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const dataSource = scene.viewer.dataSources.get(0);
    if (dataSource) void scene.viewer.flyTo(dataSource, { duration: 1.6 });
  };

  const flyToFeature = useCallback((feature: PlacedFeature) => {
    flyToFeatureRef.current?.(feature);
  }, []);

  return { status, flyHome, flyToFeature };
}
