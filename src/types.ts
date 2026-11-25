export type LonLatHeight = [number, number, number];

export type FeatureKind =
  | 'house'
  | 'restaurant'
  | 'marina'
  | 'road'
  | 'river'
  | 'airstrip'
  | 'pond'
  | 'garden'
  | 'tree'
  | 'concept';

export type GeometryMode = 'point' | 'polyline' | 'polygon';

export type Geometry =
  | { type: 'point'; position: LonLatHeight }
  | { type: 'polyline'; positions: LonLatHeight[] }
  | { type: 'polygon'; positions: LonLatHeight[] };

export interface FeatureProps {
  heading?: number;
  color?: string;
  notes?: string;
  /** Corridor width in metres, for polyline kinds. */
  width?: number;
  height?: number;
  /**
   * Corner rounding for drawn kinds, 0 (straight between vertices) to 1 (fully
   * curved). Applied when drawing, never to the stored vertices.
   */
  smoothing?: number;
  /** Which house model this structure uses — see `houseModels.ts`. */
  modelId?: string;
  /** Concept shots: which image from `conceptImages.ts` this pin shows. */
  imageId?: string;
  /** Concept shots: camera tilt in degrees, negative looks down. */
  pitch?: number;
  /** Concept shots: how far above the ground the camera stood, in metres. */
  eyeHeight?: number;
  /** Concept shots: horizontal field of view in degrees. */
  fov?: number;
}

export interface PlacedFeature {
  id: string;
  kind: FeatureKind;
  name: string;
  geometry: Geometry;
  props: FeatureProps;
  createdAt: number;
  updatedAt: number;
}

export interface KmlSource {
  name: string;
  text: string;
  importedAt: number;
}

export interface Project {
  id: string;
  name: string;
  kml: KmlSource | null;
  features: PlacedFeature[];
  createdAt: number;
  updatedAt: number;
}

export interface PersistedState {
  version: 1;
  projects: Project[];
  activeProjectId: string | null;
}

export interface LayoutFile {
  format: 'farm-planner-layout';
  version: 1;
  exportedAt: string;
  projectName: string;
  kml: KmlSource | null;
  features: PlacedFeature[];
}

export type ToolId = 'select' | FeatureKind;
