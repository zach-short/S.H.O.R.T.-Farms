import { Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, type Viewer } from 'cesium';
import { FEATURE_SPECS } from '../../featureCatalog';
import { usePlannerStore } from '../../state/store';
import type { FeatureLayer } from '../featureLayer';
import { RenderPump } from '../renderPump';
import type { ToolId } from '../../types';
import { createDrawTool } from './drawTool';
import { createPlaceTool } from './placeTool';
import { selectTool } from './selectTool';
import type { MoveEvent, Tool, ToolContext } from './types';

// Tools are generated from the catalog: point kinds get click-to-place,
// line and area kinds get multi-vertex drawing.
export const tools: Tool[] = [
  selectTool,
  ...FEATURE_SPECS.map((spec) =>
    spec.mode === 'point' ? createPlaceTool(spec) : createDrawTool(spec),
  ),
];

export const toolById = Object.fromEntries(tools.map((t) => [t.id, t])) as Record<ToolId, Tool>;

export class ToolController {
  private handler: ScreenSpaceEventHandler;
  private ctx: ToolContext;
  private active: Tool;
  private unsubscribe: () => void;
  private pump: RenderPump;
  private pendingMove: MoveEvent | null = null;
  private moveFrame = 0;

  constructor(viewer: Viewer, layer: FeatureLayer) {
    this.pump = new RenderPump(viewer.scene);
    this.ctx = {
      viewer,
      layer,
      store: usePlannerStore,
      pump: this.pump,
      modifiers: { alt: false, shift: false },
    };
    this.active = toolById[usePlannerStore.getState().tool];
    this.handler = new ScreenSpaceEventHandler(viewer.canvas);

    const positioned =
      (invoke: (tool: Tool, e: ScreenSpaceEventHandler.PositionedEvent) => void) =>
      (e: ScreenSpaceEventHandler.PositionedEvent) =>
        invoke(this.active, e);

    this.handler.setInputAction(
      positioned((tool, e) => tool.onLeftClick?.(this.ctx, e)),
      ScreenSpaceEventType.LEFT_CLICK,
    );
    this.handler.setInputAction(
      positioned((tool, e) => tool.onLeftDoubleClick?.(this.ctx, e)),
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
    this.handler.setInputAction(
      positioned((tool, e) => tool.onLeftDown?.(this.ctx, e)),
      ScreenSpaceEventType.LEFT_DOWN,
    );
    this.handler.setInputAction(
      positioned((tool, e) => tool.onLeftUp?.(this.ctx, e)),
      ScreenSpaceEventType.LEFT_UP,
    );
    this.handler.setInputAction(this.queueMove, ScreenSpaceEventType.MOUSE_MOVE);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.readModifiers);
    // Capture phase, on the window: this has to land before Cesium's own canvas
    // listener turns the event into a LEFT_DOWN that carries no modifier state.
    window.addEventListener('pointerdown', this.readModifiers, true);

    this.unsubscribe = usePlannerStore.subscribe((state, prev) => {
      if (state.tool !== prev.tool) this.setTool(state.tool);
    });

    this.active.onActivate?.(this.ctx);
    this.applyCursor();
  }

  private readModifiers = (event: PointerEvent | KeyboardEvent) => {
    this.ctx.modifiers.alt = event.altKey;
    this.ctx.modifiers.shift = event.shiftKey;
  };

  /**
   * A high-rate mouse can fire several moves per frame, and each one costs a
   * ground pick — the most expensive thing either tool does. Only the newest
   * position matters, so they collapse to one per animation frame.
   */
  private queueMove = (event: ScreenSpaceEventHandler.MotionEvent) => {
    // Cesium re-uses this object between events, so it has to be copied.
    this.pendingMove = {
      startPosition: Cartesian2.clone(event.startPosition, new Cartesian2()),
      endPosition: Cartesian2.clone(event.endPosition, new Cartesian2()),
    };
    if (this.moveFrame) return;
    this.moveFrame = requestAnimationFrame(() => {
      this.moveFrame = 0;
      const move = this.pendingMove;
      this.pendingMove = null;
      if (move) this.active.onMouseMove?.(this.ctx, move);
    });
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    this.readModifiers(event);
    const { setTool, setSelected, undo, redo } = usePlannerStore.getState();

    if (event.key === 'Escape') {
      this.active.onCancel?.(this.ctx);
      setSelected(null);
      setTool('select');
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      // Mid-draw, undo walks back the vertices being placed.
      else if (!this.active.onUndo?.(this.ctx)) undo();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    // Modified keys are shortcuts for the browser or the app, never for a tool.
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    // Let the active tool consume typing keys (Backspace, Enter) before they
    // are interpreted as tool shortcuts.
    this.active.onKeyDown?.(this.ctx, event);
    if (event.defaultPrevented) return;

    const match = tools.find((t) => t.shortcut.toLowerCase() === event.key.toLowerCase());
    if (match) setTool(match.id);
  };

  private applyCursor() {
    this.ctx.viewer.canvas.style.cursor = this.active.cursor;
  }

  setTool(id: ToolId) {
    if (this.active.id === id) return;
    this.active.onDeactivate?.(this.ctx);
    this.active = toolById[id];
    this.active.onActivate?.(this.ctx);
    this.applyCursor();
  }

  destroy() {
    this.active.onDeactivate?.(this.ctx);
    this.unsubscribe();
    if (this.moveFrame) cancelAnimationFrame(this.moveFrame);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.readModifiers);
    window.removeEventListener('pointerdown', this.readModifiers, true);
    this.pump.destroy();
    this.handler.destroy();
  }
}
