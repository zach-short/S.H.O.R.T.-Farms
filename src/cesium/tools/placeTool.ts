import { cartesianToLonLatHeight, pickGround } from '../../lib/geo';
import { toolMetaById } from '../../toolMeta';
import type { FeatureSpec } from '../../featureCatalog';
import type { Tool } from './types';

/** Single-click placement for point kinds (houses, restaurants, marinas, trees). */
export function createPlaceTool(spec: FeatureSpec): Tool {
  return {
    ...toolMetaById[spec.kind],

    onLeftClick(ctx, event) {
      const position = pickGround(ctx.viewer.scene, event.position);
      if (!position) return;

      const id = ctx.store.getState().addFeature(spec.kind, {
        type: 'point',
        position: cartesianToLonLatHeight(position),
      });
      ctx.store.getState().setSelected(id);
    },
  };
}
