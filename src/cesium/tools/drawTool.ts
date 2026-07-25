import { Cartesian3 } from 'cesium';
import { cartesianToLonLatHeight, pickGround } from '../../lib/geo';
import { minimumVertices, type FeatureSpec } from '../../featureCatalog';
import { toolMetaById } from '../../toolMeta';
import type { Tool, ToolContext } from './types';

/** Multi-vertex drawing for polyline and polygon kinds. */
export function createDrawTool(spec: FeatureSpec): Tool {
  const minimum = minimumVertices(spec.mode);
  let vertices: Cartesian3[] = [];
  let cursor: Cartesian3 | undefined;
  /** Which placed vertex is being dragged, if any. */
  let dragIndex: number | null = null;
  /** Set after a drag so the click it ends with doesn't also place a vertex. */
  let swallowClick = false;
  let release: (() => void) | null = null;

  const reset = (ctx: ToolContext) => {
    vertices = [];
    cursor = undefined;
    dragIndex = null;
    swallowClick = false;
    ctx.layer.clearDraft();
    ctx.layer.clearHandles();
  };

  const redraw = (ctx: ToolContext) => {
    ctx.layer.setDraft(spec.kind, vertices, dragIndex === null ? cursor : undefined);
    // Handles let a misplaced point be nudged without restarting the shape.
    ctx.layer.setDraftHandles(vertices, dragIndex);
  };

  const endDrag = (ctx: ToolContext) => {
    dragIndex = null;
    const controller = ctx.viewer.scene.screenSpaceCameraController;
    controller.enableRotate = true;
    controller.enableTranslate = true;
    controller.enableTilt = true;
    release?.();
    release = null;
    // The vertex count didn't change, so the area shading needs telling.
    ctx.layer.invalidateDraftFill();
    redraw(ctx);
  };

  const commit = (ctx: ToolContext) => {
    if (vertices.length < minimum) return;
    const positions = vertices.map(cartesianToLonLatHeight);
    reset(ctx);
    const id = ctx.store.getState().addFeature(spec.kind, {
      type: spec.mode as 'polyline' | 'polygon',
      positions,
    });
    ctx.store.getState().setSelected(id);
  };

  return {
    ...toolMetaById[spec.kind],

    onActivate: reset,
    onDeactivate(ctx) {
      if (dragIndex !== null) endDrag(ctx);
      reset(ctx);
    },

    onLeftDown(ctx, event) {
      // Cleared per gesture: a drag long enough to suppress Cesium's click would
      // otherwise leave the flag set and eat the next placed point.
      swallowClick = false;
      // A press on an existing handle grabs it instead of adding a point.
      const handle = ctx.layer.handleAt(ctx.viewer.scene.pick(event.position)?.id);
      if (handle?.role !== 'vertex') return;

      dragIndex = handle.index;
      release = ctx.pump.hold();
      const controller = ctx.viewer.scene.screenSpaceCameraController;
      controller.enableRotate = false;
      controller.enableTranslate = false;
      controller.enableTilt = false;
      redraw(ctx);
    },

    onLeftUp(ctx) {
      if (dragIndex === null) return;
      swallowClick = true;
      endDrag(ctx);
    },

    onLeftClick(ctx, event) {
      if (swallowClick) {
        swallowClick = false;
        return;
      }
      const position = pickGround(ctx.viewer.scene, event.position);
      if (!position) return;
      vertices.push(position);
      redraw(ctx);
    },

    onLeftDoubleClick(ctx) {
      // A double-click also delivers its constituent LEFT_CLICKs, so the
      // closing gesture leaves duplicate vertices stacked on the last point.
      while (
        vertices.length > 1 &&
        Cartesian3.distance(vertices[vertices.length - 1], vertices[vertices.length - 2]) < 1
      ) {
        vertices.pop();
      }
      commit(ctx);
    },

    onMouseMove(ctx, event) {
      const position = pickGround(ctx.viewer.scene, event.endPosition);

      if (dragIndex !== null) {
        if (!position) return;
        vertices[dragIndex] = position;
        redraw(ctx);
        return;
      }

      if (vertices.length === 0) return;
      cursor = position;
      // Keep the scene rendering while the rubber band is following the cursor,
      // otherwise it only advances when Cesium decides something changed.
      ctx.pump.nudge();
      redraw(ctx);
    },

    onKeyDown(ctx, event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit(ctx);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        vertices.pop();
        redraw(ctx);
      }
    },

    onUndo(ctx) {
      if (vertices.length === 0) return false;
      vertices.pop();
      redraw(ctx);
      return true;
    },
  };
}
