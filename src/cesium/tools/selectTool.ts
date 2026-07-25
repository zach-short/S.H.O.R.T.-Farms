import { Cartesian3 } from 'cesium';
import { cartesianToLonLatHeight, pickGround } from '../../lib/geo';
import { resolveHouseModel } from '../../houseModels';
import { minimumVertices, specByKind } from '../../featureCatalog';
import { toolMetaById } from '../../toolMeta';
import type { LonLatHeight, PlacedFeature } from '../../types';
import type { Tool, ToolContext } from './types';

let draggingId: string | null = null;
let dragPosition: Cartesian3 | null = null;
let moved = false;

/** An in-progress vertex drag on a drawn shape. */
let vertexDrag: {
  featureId: string;
  index: number;
  /** The whole vertex list, edited locally and committed on release. */
  positions: LonLatHeight[];
  moved: boolean;
} | null = null;

/** Set after any handle gesture, so the trailing click doesn't change selection. */
let swallowClick = false;
let release: (() => void) | null = null;

function featureById(ctx: ToolContext, id: string): PlacedFeature | null {
  const state = ctx.store.getState();
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  return project?.features.find((f) => f.id === id) ?? null;
}

function freeCamera(ctx: ToolContext, free: boolean) {
  const controller = ctx.viewer.scene.screenSpaceCameraController;
  controller.enableRotate = free;
  controller.enableTranslate = free;
  controller.enableTilt = free;
}

function stopDrag(ctx: ToolContext) {
  freeCamera(ctx, true);
  draggingId = null;
  dragPosition = null;
  release?.();
  release = null;
}

function stopVertexDrag(ctx: ToolContext) {
  vertexDrag = null;
  freeCamera(ctx, true);
  release?.();
  release = null;
  ctx.layer.endPreview();
}

/** Writes an edited vertex list back to the feature. */
function commitVertices(ctx: ToolContext, feature: PlacedFeature, positions: LonLatHeight[]) {
  if (feature.geometry.type === 'point') return;
  ctx.store.getState().updateFeature(feature.id, {
    geometry: { type: feature.geometry.type, positions },
  });
}

export const selectTool: Tool = {
  ...toolMetaById.select,

  onDeactivate(ctx) {
    if (draggingId) {
      ctx.layer.endDrag(draggingId);
      stopDrag(ctx);
    }
    if (vertexDrag) stopVertexDrag(ctx);
    swallowClick = false;
  },

  // Escape returns to this same tool, so onDeactivate never fires and an
  // abandoned drag would leave the camera pinned.
  onCancel(ctx) {
    this.onDeactivate?.(ctx);
  },

  onLeftDown(ctx, event) {
    // Cleared per gesture rather than when the click arrives: a drag that
    // travels far enough never produces one, and a stale flag would swallow
    // whatever the user clicked next.
    swallowClick = false;
    const picked = ctx.viewer.scene.pick(event.position);

    // Editing handles sit on top of everything, so they get first look.
    const handle = ctx.layer.handleAt(picked?.id);
    if (handle) {
      const selectedId = ctx.store.getState().selectedId;
      const feature = selectedId ? featureById(ctx, selectedId) : null;
      if (!feature || feature.geometry.type === 'point') return;

      const positions = [...feature.geometry.positions];
      // Either way the vertex now being dragged lives at this index.
      const index = handle.index;

      if (handle.role === 'midpoint') {
        // Grabbing a midpoint adds a vertex there and drags the new one, so a
        // curve can be pulled out of a straight run in one gesture.
        const before = positions[handle.index - 1];
        const after = positions[handle.index % positions.length];
        positions.splice(handle.index, 0, [
          (before[0] + after[0]) / 2,
          (before[1] + after[1]) / 2,
          (before[2] + after[2]) / 2,
        ]);
      } else if (ctx.modifiers.alt) {
        // Alt-click removes a point, down to the minimum the shape needs.
        if (positions.length > minimumVertices(feature.geometry.type)) {
          positions.splice(handle.index, 1);
          commitVertices(ctx, feature, positions);
        }
        swallowClick = true;
        return;
      }

      vertexDrag = { featureId: feature.id, index, positions, moved: false };
      swallowClick = true;
      release = ctx.pump.hold();
      freeCamera(ctx, false);
      ctx.layer.previewEditing(positions, index);
      return;
    }

    const id = ctx.layer.featureIdFor(picked?.id);
    if (!id) return;

    ctx.store.getState().setSelected(id);

    // Only point features move as a unit. Roads, ponds and the like are defined
    // by their vertices, so they are reshaped a handle at a time instead.
    const feature = featureById(ctx, id);
    if (feature?.geometry.type !== 'point') return;

    moved = false;
    draggingId = id;
    release = ctx.pump.hold();
    // Size the ground ring to the footprint the structure actually occupies.
    const footprint =
      feature.kind === 'house'
        ? resolveHouseModel(feature.props.modelId).size
        : (specByKind[feature.kind].size ?? [10, 10, 6]);
    ctx.layer.beginDrag(id, Math.max(footprint[0], footprint[1]) * 0.6);
    freeCamera(ctx, false);
  },

  onMouseMove(ctx, event) {
    if (vertexDrag) {
      const position = pickGround(ctx.viewer.scene, event.endPosition);
      if (!position) return;
      vertexDrag.moved = true;
      vertexDrag.positions[vertexDrag.index] = cartesianToLonLatHeight(position);
      ctx.layer.previewEditing(vertexDrag.positions, vertexDrag.index);
      return;
    }

    if (!draggingId) return;
    const position = pickGround(ctx.viewer.scene, event.endPosition);
    if (!position) return;
    moved = true;
    dragPosition = position;
    ctx.layer.updateDrag(position);
  },

  onLeftUp(ctx) {
    if (vertexDrag) {
      const feature = featureById(ctx, vertexDrag.featureId);
      // A midpoint grab inserts a vertex, which is worth keeping even if the
      // pointer never moved afterwards.
      const inserted =
        feature?.geometry.type !== 'point' &&
        vertexDrag.positions.length !== feature?.geometry.positions.length;
      if (feature && (vertexDrag.moved || inserted)) {
        commitVertices(ctx, feature, vertexDrag.positions);
      }
      stopVertexDrag(ctx);
      return;
    }

    if (!draggingId) return;
    const id = draggingId;

    if (moved && dragPosition) {
      ctx.store.getState().updateFeature(id, {
        geometry: { type: 'point', position: cartesianToLonLatHeight(dragPosition) },
      });
    }

    ctx.layer.endDrag(id);
    stopDrag(ctx);
  },

  onLeftClick(ctx, event) {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    if (moved) {
      moved = false;
      return;
    }
    const picked = ctx.viewer.scene.pick(event.position);
    const id = ctx.layer.featureIdFor(picked?.id);
    ctx.store.getState().setSelected(id);
  },

  onKeyDown(ctx, event) {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    const { selectedId, removeFeature } = ctx.store.getState();
    if (selectedId) {
      event.preventDefault();
      removeFeature(selectedId);
    }
  },
};
