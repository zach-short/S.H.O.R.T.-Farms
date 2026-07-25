import type { Cartesian2, Viewer } from 'cesium';
import type { FeatureLayer } from '../featureLayer';
import type { RenderPump } from '../renderPump';
import type { usePlannerStore } from '../../state/store';
import type { ToolId } from '../../types';

export interface ToolContext {
  viewer: Viewer;
  layer: FeatureLayer;
  store: typeof usePlannerStore;
  /** Keeps the scene rendering continuously while a gesture is in progress. */
  pump: RenderPump;
  /**
   * Modifier state as of the last pointer or key event. Cesium's own events
   * don't carry it, and alt-click has to be told apart from a plain click.
   */
  modifiers: { alt: boolean; shift: boolean };
}

export interface ClickEvent {
  position: Cartesian2;
}

export interface MoveEvent {
  startPosition: Cartesian2;
  endPosition: Cartesian2;
}

export interface Tool {
  id: ToolId;
  label: string;
  shortcut: string;
  hint: string;
  cursor: string;
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;
  /**
   * Escape. Abandons whatever gesture is in flight — the tool may already be
   * the one Escape returns to, in which case onDeactivate never runs and this
   * is the only chance to let go of the camera.
   */
  onCancel?(ctx: ToolContext): void;
  onLeftClick?(ctx: ToolContext, event: ClickEvent): void;
  onLeftDoubleClick?(ctx: ToolContext, event: ClickEvent): void;
  onLeftDown?(ctx: ToolContext, event: ClickEvent): void;
  onLeftUp?(ctx: ToolContext, event: ClickEvent): void;
  onMouseMove?(ctx: ToolContext, event: MoveEvent): void;
  onKeyDown?(ctx: ToolContext, event: KeyboardEvent): void;
  /**
   * Gives the tool first refusal on undo. A draw in progress steps back a
   * vertex rather than unwinding the last committed feature. Return true to
   * consume the gesture.
   */
  onUndo?(ctx: ToolContext): boolean;
}
