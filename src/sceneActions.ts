import type { PlacedFeature } from './types';

/**
 * Camera moves the UI can ask for without importing Cesium. The scene fills
 * these in once the engine has loaded and clears them when it unmounts; until
 * then they are no-ops.
 */
export const sceneActions: {
  /** Flies the camera to the spot and angle a concept shot was taken from. */
  matchView: ((feature: PlacedFeature) => void) | null;
} = {
  matchView: null,
};
