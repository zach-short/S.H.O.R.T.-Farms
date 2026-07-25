import { specByKind } from '../featureCatalog';
import { smoothPath } from './smooth';
import type { FeatureKind, FeatureProps, LonLatHeight, PlacedFeature } from '../types';

/**
 * How much a feature's corners are rounded. Falling back to the kind's default
 * means an old layout drawn before smoothing existed picks up the sensible
 * value for its kind — a river saved as a jagged chain now reads as a curve.
 */
export function smoothingOf(feature: { kind: FeatureKind; props: FeatureProps }): number {
  return feature.props.smoothing ?? specByKind[feature.kind].defaults.smoothing ?? 0;
}

/**
 * The vertices actually drawn: the stored ones with smoothing applied. Handles
 * and editing always work on the stored vertices; everything visual and every
 * measurement works on these.
 */
export function outlineOf(feature: PlacedFeature): LonLatHeight[] {
  const { geometry } = feature;
  if (geometry.type === 'point') return [geometry.position];
  return smoothPath(
    geometry.positions,
    smoothingOf(feature),
    geometry.type === 'polygon',
  ) as LonLatHeight[];
}
