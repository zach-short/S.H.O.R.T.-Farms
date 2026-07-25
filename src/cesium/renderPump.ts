import type { Scene } from 'cesium';

/** How long continuous rendering outlives the last nudge, in ms. */
const IDLE_MS = 600;

/**
 * The scene renders on demand, which is right for a mostly-static aerial view
 * but wrong mid-gesture: a rubber band that only redraws when Cesium happens to
 * think something changed looks like it is stuttering. This flips the scene to
 * continuous rendering while a gesture is live and lets it go idle afterwards.
 */
export class RenderPump {
  private holds = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  private sync() {
    const live = this.holds > 0 || this.timer !== null;
    if (this.scene.requestRenderMode === !live) return;
    this.scene.requestRenderMode = !live;
    // Going idle needs one last frame, or the scene keeps whatever was on
    // screen when the gesture ended.
    if (!live) this.scene.requestRender();
  }

  /** Renders continuously until the returned release is called. */
  hold(): () => void {
    this.holds++;
    this.sync();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holds = Math.max(0, this.holds - 1);
      this.sync();
    };
  }

  /** Keeps rendering for a short while — call on every pointer move. */
  nudge() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.sync();
    }, IDLE_MS);
    this.sync();
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.holds = 0;
    if (!this.scene.isDestroyed()) this.sync();
  }
}
