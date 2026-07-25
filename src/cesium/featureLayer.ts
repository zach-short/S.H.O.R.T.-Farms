import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  ClassificationType,
  Color,
  ColorMaterialProperty,
  CornerType,
  CustomDataSource,
  DistanceDisplayCondition,
  Entity,
  HeadingPitchRoll,
  HorizontalOrigin,
  ImageMaterialProperty,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  PolygonHierarchy,
  PolylineDashMaterialProperty,
  Transforms,
  VerticalOrigin,
  type Viewer,
} from 'cesium';
import { anchorOf, extentMetres, pathLength, toCartesians } from '../lib/geo';
import { smoothTriples, type Triple } from '../lib/smooth';
import { outlineOf, smoothingOf } from '../lib/shape';
import { texture } from '../lib/textures';
import { ensureModelProbed, modelAvailability, onModelAvailabilityChange } from '../lib/modelAssets';
import { resolveHouseModel } from '../houseModels';
import { isStructure, specByKind, type FeatureSpec } from '../featureCatalog';
import type { FeatureKind, Geometry, LonLatHeight, PlacedFeature } from '../types';

const ENTITY_PREFIX = 'feature:';
const HANDLE_PREFIX = 'handle:';

/** What a picked editing handle refers to on the shape being edited. */
export interface VertexHandle {
  role: 'vertex' | 'midpoint';
  /** For a vertex, its index. For a midpoint, the index it would insert at. */
  index: number;
}

const OUTLINE_DARK = Color.fromCssColorString('#0f172a');
const SELECTED_OUTLINE = Color.WHITE;
const LABEL_HALO = Color.fromCssColorString('#020617').withAlpha(0.85);
const DRAG_GHOST = Color.fromCssColorString('#f59e0b').withAlpha(0.45);

interface RenderContext {
  feature: PlacedFeature;
  selected: boolean;
  spec: FeatureSpec;
  /**
   * The vertices to draw: the stored ones with the feature's smoothing applied.
   * Everything visual reads this rather than the geometry, so a shape traced
   * with a dozen clicks still renders as a curve.
   */
  outline: LonLatHeight[];
}

interface FeatureRenderer {
  build(ctx: RenderContext): Entity.ConstructorOptions;
  apply(entity: Entity, ctx: RenderContext): void;
}

/** Selected features keep their own hue but brighten, so the kind stays readable. */
function tint(spec: FeatureSpec, selected: boolean, alpha: number) {
  const base = Color.fromCssColorString(spec.color);
  const shade = selected ? Color.lerp(base, Color.WHITE, 0.45, new Color()) : base;
  return shade.withAlpha(alpha);
}

function labelOptions(text: string, offset: number) {
  return {
    text,
    font: '600 13px Inter, system-ui, sans-serif',
    fillColor: Color.WHITE,
    outlineColor: LABEL_HALO,
    outlineWidth: 3,
    style: LabelStyle.FILL_AND_OUTLINE,
    pixelOffset: new Cartesian2(0, offset),
    horizontalOrigin: HorizontalOrigin.CENTER,
    verticalOrigin: VerticalOrigin.BOTTOM,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    distanceDisplayCondition: new DistanceDisplayCondition(0, 6000),
  };
}

function anchorCartesian(geometry: Geometry, liftBy = 0): Cartesian3 {
  const [lon, lat, height] = anchorOf(geometry);
  return Cartesian3.fromDegrees(lon, lat, height + liftBy);
}

function orientationFor(feature: PlacedFeature, position: Cartesian3) {
  return Transforms.headingPitchRollQuaternion(
    position,
    new HeadingPitchRoll(CesiumMath.toRadians(feature.props.heading ?? 0), 0, 0),
  );
}

/**
 * Paints a drawn feature with its texture, repeated so one tile always covers
 * the same real-world distance. Falls back to the flat colour for kinds that
 * declare no surface.
 */
function surfaceMaterial(ctx: RenderContext): ImageMaterialProperty | Color {
  const { surface } = ctx.spec;
  if (!surface) return tint(ctx.spec, ctx.selected, ctx.selected ? 0.55 : 0.35);

  const geometry = ctx.feature.geometry;
  let across: number;
  let along: number;

  if (geometry.type === 'polyline') {
    // Corridor texture coordinates run along the path, then across its width.
    along = pathLength(ctx.outline);
    across = ctx.feature.props.width ?? 6;
  } else if (geometry.type === 'polygon') {
    [along, across] = extentMetres(ctx.outline);
  } else {
    along = across = surface.tileMetres;
  }

  const repeat = new Cartesian2(
    Math.max(1, Math.round(along / surface.tileMetres)),
    Math.max(1, Math.round(across / surface.tileMetres)),
  );

  // Selection brightens the tint rather than replacing it, so the surface
  // stays recognisable while highlighted.
  const base = Color.fromCssColorString(surface.tint);
  const shade = ctx.selected ? Color.lerp(base, Color.WHITE, 0.5, new Color()) : base;

  return new ImageMaterialProperty({
    image: surface.url ?? texture(surface.texture),
    repeat,
    color: shade.withAlpha(surface.alpha),
    transparent: surface.alpha < 1,
  });
}

/**
 * Rounds a draft path. Runs in earth-centred coordinates rather than degrees:
 * the spline is a linear combination of its control points either way, and this
 * skips converting the whole path on every frame of a drag.
 */
function smoothCartesians(points: Cartesian3[], smoothing: number, closed: boolean): Cartesian3[] {
  if (smoothing <= 0 || points.length < 3) return [...points];
  const triples = points.map((p): Triple => [p.x, p.y, p.z]);
  return smoothTriples(triples, smoothing, closed).map(([x, y, z]) => new Cartesian3(x, y, z));
}

function closedRing(positions: LonLatHeight[]): Cartesian3[] {
  if (positions.length < 3) return toCartesians(positions);
  return toCartesians([...positions, positions[0]]);
}

/**
 * The real-world size a structure occupies. Houses take it from their chosen
 * model so each cottage keeps its own footprint; everything else uses the
 * single size on its feature spec.
 */
function structureSize(ctx: RenderContext): [number, number, number] {
  if (ctx.feature.kind === 'house') return resolveHouseModel(ctx.feature.props.modelId).size;
  return ctx.spec.size ?? [10, 10, 6];
}

/**
 * Resolves the GLB for a house, or null when it should draw a placeholder.
 * Probing is asynchronous, so an unknown asset renders as a box until the
 * probe settles and the layer re-syncs.
 */
function modelUrlFor(ctx: RenderContext): string | null {
  if (ctx.feature.kind !== 'house') return null;
  const url = resolveHouseModel(ctx.feature.props.modelId).url;
  if (!url) return null;
  ensureModelProbed(url);
  return modelAvailability(url) === true ? url : null;
}

/** Houses, restaurants and marinas: an oriented box with a zoom-out marker. */
const structureRenderer: FeatureRenderer = {
  build(ctx) {
    const [x, y, z] = structureSize(ctx);
    const modelUrl = modelUrlFor(ctx);
    // A GLB stands on its base; the placeholder box is centred on its volume.
    const position = anchorCartesian(ctx.feature.geometry, modelUrl ? 0 : z / 2);
    return {
      id: ENTITY_PREFIX + ctx.feature.id,
      position,
      orientation: orientationFor(ctx.feature, position),
      ...(modelUrl
        ? {
            model: {
              uri: modelUrl,
              scale: resolveHouseModel(ctx.feature.props.modelId).scale,
              // Keeps a cottage clickable from parcel altitude.
              minimumPixelSize: 24,
              maximumScale: 400,
              silhouetteColor: SELECTED_OUTLINE,
              silhouetteSize: ctx.selected ? 2 : 0,
            },
          }
        : {
            box: {
              dimensions: new Cartesian3(x, y, z),
              material: tint(ctx.spec, ctx.selected, 0.94),
              outline: true,
              outlineColor: ctx.selected ? SELECTED_OUTLINE : OUTLINE_DARK,
              outlineWidth: 2,
            },
          }),
      // A 14 m box is only a few pixels wide at parcel altitude. The marker
      // keeps structures visible and easy to click when zoomed out.
      point: {
        pixelSize: ctx.selected ? 12 : 9,
        color: tint(ctx.spec, ctx.selected, 1),
        outlineColor: ctx.selected ? SELECTED_OUTLINE : OUTLINE_DARK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new NearFarScalar(500, 1.0, 6000, 0.65),
      },
      label: labelOptions(ctx.feature.name, -34),
    };
  },
  apply(entity, ctx) {
    const [x, y, z] = structureSize(ctx);
    const modelUrl = modelUrlFor(ctx);
    const position = anchorCartesian(ctx.feature.geometry, modelUrl ? 0 : z / 2);
    entity.position = position as never;
    entity.orientation = orientationFor(ctx.feature, position) as never;
    if (entity.model) {
      entity.model.uri = modelUrl as never;
      entity.model.scale = resolveHouseModel(ctx.feature.props.modelId).scale as never;
      entity.model.silhouetteSize = (ctx.selected ? 2 : 0) as never;
    }
    if (entity.box) {
      // Swapping models changes the footprint, so the placeholder resizes too.
      entity.box.dimensions = new Cartesian3(x, y, z) as never;
      entity.box.material = tint(ctx.spec, ctx.selected, 0.94) as never;
      entity.box.outlineColor = (ctx.selected ? SELECTED_OUTLINE : OUTLINE_DARK) as never;
    }
    if (entity.point) {
      entity.point.pixelSize = (ctx.selected ? 12 : 9) as never;
      entity.point.color = tint(ctx.spec, ctx.selected, 1) as never;
      entity.point.outlineColor = (ctx.selected ? SELECTED_OUTLINE : OUTLINE_DARK) as never;
    }
    if (entity.label) entity.label.text = ctx.feature.name as never;
  },
};

/** Trees: a tapered canopy rather than a box, and no heading to speak of. */
const treeRenderer: FeatureRenderer = {
  build(ctx) {
    const [width, , height] = ctx.spec.size ?? [7, 7, 9];
    const position = anchorCartesian(ctx.feature.geometry, height / 2);
    return {
      id: ENTITY_PREFIX + ctx.feature.id,
      position,
      cylinder: {
        length: height,
        topRadius: 0.4,
        bottomRadius: width / 2,
        material: tint(ctx.spec, ctx.selected, 0.9),
        outline: true,
        outlineColor: ctx.selected ? SELECTED_OUTLINE : OUTLINE_DARK,
      },
      point: {
        pixelSize: ctx.selected ? 10 : 7,
        color: tint(ctx.spec, ctx.selected, 1),
        outlineColor: ctx.selected ? SELECTED_OUTLINE : OUTLINE_DARK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new NearFarScalar(500, 1.0, 4000, 0.5),
      },
      // Trees get planted in numbers — labelling every one turns the map to
      // mush, so the name only shows up close.
      label: {
        ...labelOptions(ctx.feature.name, -26),
        distanceDisplayCondition: new DistanceDisplayCondition(0, 900),
      },
    };
  },
  apply(entity, ctx) {
    const height = (ctx.spec.size ?? [7, 7, 9])[2];
    entity.position = anchorCartesian(ctx.feature.geometry, height / 2) as never;
    if (entity.cylinder) {
      entity.cylinder.material = tint(ctx.spec, ctx.selected, 0.9) as never;
      entity.cylinder.outlineColor = (ctx.selected ? SELECTED_OUTLINE : OUTLINE_DARK) as never;
    }
    if (entity.point) {
      entity.point.pixelSize = (ctx.selected ? 10 : 7) as never;
      entity.point.color = tint(ctx.spec, ctx.selected, 1) as never;
      entity.point.outlineColor = (ctx.selected ? SELECTED_OUTLINE : OUTLINE_DARK) as never;
    }
    if (entity.label) entity.label.text = ctx.feature.name as never;
  },
};

/**
 * Roads and air strips: a ground-clamped corridor of real-world width, so it
 * drapes over the photorealistic tiles instead of floating above them.
 */
const corridorRenderer: FeatureRenderer = {
  build(ctx) {
    const positions = ctx.outline;
    return {
      id: ENTITY_PREFIX + ctx.feature.id,
      position: anchorCartesian(ctx.feature.geometry),
      corridor: {
        positions: toCartesians(positions),
        width: ctx.feature.props.width ?? 6,
        cornerType: CornerType.ROUNDED,
        material: surfaceMaterial(ctx),
        classificationType: ClassificationType.BOTH,
      },
      // Runway markings sit on top of the asphalt.
      ...(ctx.spec.centreline && {
        polyline: {
          positions: toCartesians(positions),
          width: 2.5,
          material: new PolylineDashMaterialProperty({
            color: Color.fromCssColorString(ctx.spec.centreline.color),
            dashLength: ctx.spec.centreline.dashLength,
          }),
          clampToGround: true,
          classificationType: ClassificationType.BOTH,
        },
      }),
      label: labelOptions(ctx.feature.name, -10),
    };
  },
  apply(entity, ctx) {
    const positions = ctx.outline;
    entity.position = anchorCartesian(ctx.feature.geometry) as never;
    if (entity.corridor) {
      entity.corridor.positions = toCartesians(positions) as never;
      entity.corridor.width = (ctx.feature.props.width ?? 6) as never;
      entity.corridor.material = surfaceMaterial(ctx) as never;
    }
    if (entity.polyline) {
      entity.polyline.positions = toCartesians(positions) as never;
    }
    if (entity.label) entity.label.text = ctx.feature.name as never;
  },
};

/** Ponds and gardens: a ground-clamped fill with a bright traced edge. */
const areaRenderer: FeatureRenderer = {
  build(ctx) {
    const positions = ctx.outline;
    return {
      id: ENTITY_PREFIX + ctx.feature.id,
      position: anchorCartesian(ctx.feature.geometry),
      polygon: {
        hierarchy: new PolygonHierarchy(toCartesians(positions)),
        material: surfaceMaterial(ctx),
        classificationType: ClassificationType.BOTH,
      },
      // Clamped polygons ignore `outline`, so the edge is a ground polyline.
      polyline: {
        positions: closedRing(positions),
        width: ctx.selected ? 4 : 2.5,
        material: tint(ctx.spec, ctx.selected, 1),
        clampToGround: true,
        classificationType: ClassificationType.BOTH,
      },
      label: labelOptions(ctx.feature.name, -10),
    };
  },
  apply(entity, ctx) {
    const positions = ctx.outline;
    entity.position = anchorCartesian(ctx.feature.geometry) as never;
    if (entity.polygon) {
      entity.polygon.hierarchy = new PolygonHierarchy(toCartesians(positions)) as never;
      entity.polygon.material = surfaceMaterial(ctx) as never;
    }
    if (entity.polyline) {
      entity.polyline.positions = closedRing(positions) as never;
      entity.polyline.width = (ctx.selected ? 4 : 2.5) as never;
      entity.polyline.material = tint(ctx.spec, ctx.selected, 1) as never;
    }
    if (entity.label) entity.label.text = ctx.feature.name as never;
  },
};

/** Identifies the graphics an entity was built from. */
function variantOf(ctx: RenderContext): string {
  if (ctx.feature.kind !== 'house') return ctx.feature.kind;
  return modelUrlFor(ctx) ?? `placeholder:${resolveHouseModel(ctx.feature.props.modelId).id}`;
}

function rendererFor(kind: FeatureKind): FeatureRenderer {
  const spec = specByKind[kind];
  if (spec.mode === 'polyline') return corridorRenderer;
  if (spec.mode === 'polygon') return areaRenderer;
  return isStructure(kind) ? structureRenderer : treeRenderer;
}

export class FeatureLayer {
  private dataSource = new CustomDataSource('planned-features');
  private entities = new Map<string, Entity>();
  /** Which graphics an entity was built with — a change forces a rebuild. */
  private variants = new Map<string, string>();
  private dragGhost: Entity | null = null;
  private draftLine: Entity | null = null;
  private draftFill: Entity | null = null;
  /** Read every frame by the draft polyline's callback — mutate, never replace. */
  private draftPath: Cartesian3[] = [];
  private draftColor = Color.WHITE;
  /** Vertex count the draft fill was last built for. */
  private draftFillCount = -1;
  private handleEntities: Entity[] = [];
  private handleMeta: (VertexHandle | null)[] = [];
  /** The shape vertex handles are currently attached to, if any. */
  private editing: {
    kind: FeatureKind;
    closed: boolean;
    positions: LonLatHeight[];
    smoothing: number;
  } | null = null;
  private viewer: Viewer;
  private lastSync: { features: PlacedFeature[]; selectedId: string | null } | null = null;
  private stopWatchingModels: () => void;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    void viewer.dataSources.add(this.dataSource);

    // A GLB that turns out to exist arrives after the first draw, so re-run the
    // last sync to swap placeholders for real models.
    this.stopWatchingModels = onModelAvailabilityChange(() => {
      if (this.lastSync) this.sync(this.lastSync.features, this.lastSync.selectedId);
    });
  }

  sync(features: PlacedFeature[], selectedId: string | null) {
    this.lastSync = { features, selectedId };
    const seen = new Set<string>();

    for (const feature of features) {
      // A layout saved by a newer build may carry kinds this one cannot draw.
      const spec = specByKind[feature.kind];
      if (!spec) continue;

      seen.add(feature.id);
      const ctx: RenderContext = {
        feature,
        selected: feature.id === selectedId,
        spec,
        outline: outlineOf(feature),
      };
      const renderer = rendererFor(feature.kind);
      const variant = variantOf(ctx);

      let existing = this.entities.get(feature.id);
      // Placeholder box and GLB are different graphics; patching cannot turn
      // one into the other, so drop the entity and build it again.
      if (existing && this.variants.get(feature.id) !== variant) {
        this.dataSource.entities.remove(existing);
        this.entities.delete(feature.id);
        existing = undefined;
      }

      if (existing) {
        renderer.apply(existing, ctx);
      } else {
        const entity = this.dataSource.entities.add(renderer.build(ctx));
        this.entities.set(feature.id, entity);
        this.variants.set(feature.id, variant);
      }
    }

    for (const [id, entity] of this.entities) {
      if (!seen.has(id)) {
        this.dataSource.entities.remove(entity);
        this.entities.delete(id);
        this.variants.delete(id);
      }
    }

    this.viewer.scene.requestRender();
  }

  /**
   * The rubber band, used both by the draw tools and while a vertex is being
   * dragged. Two decisions here are what stop it flickering:
   *
   * - Positions come from a non-constant `CallbackProperty`, which puts the
   *   polyline on Cesium's dynamic path. It is then updated in place every
   *   frame instead of the primitive being destroyed and rebuilt, and a rebuild
   *   is what left a gap of blank frames on every mouse move.
   * - It is not clamped to the ground. Draped lines are ground primitives, and
   *   those rebuild asynchronously — visible as a blink. Because the vertices
   *   were picked off the rendered surface the unclamped line sits on it
   *   anyway, and `depthFailMaterial` keeps the parts that dip behind a rise
   *   visible rather than cut off.
   */
  private ensureDraftLine() {
    this.draftLine ??= this.dataSource.entities.add({
      polyline: {
        positions: new CallbackProperty(() => this.draftPath, false),
        width: 3,
        // A bare CallbackProperty is not a MaterialProperty — Cesium would take
        // it for one and fail looking for getType().
        material: new ColorMaterialProperty(
          new CallbackProperty(() => this.draftColor.withAlpha(0.95), false),
        ),
        depthFailMaterial: new ColorMaterialProperty(
          new CallbackProperty(() => this.draftColor.withAlpha(0.5), false),
        ),
      },
    });
    return this.draftLine;
  }

  /**
   * Draws the shape a tool is still working on: `vertices` as placed, plus a
   * rubber band out to `cursor` when one is given. `fill` shades the interior
   * of an area — off while an existing shape's vertex is being dragged, since
   * that shape is already drawn underneath.
   */
  setDraft(
    kind: FeatureKind,
    vertices: Cartesian3[],
    cursor?: Cartesian3,
    options: { fill?: boolean; smoothing?: number } = {},
  ) {
    const spec = specByKind[kind];
    const closed = spec.mode === 'polygon';
    // A new shape previews with its kind's default; reshaping an existing one
    // previews with whatever that feature was dialled to.
    const smoothing = options.smoothing ?? spec.defaults.smoothing ?? 0;
    const path = cursor ? [...vertices, cursor] : vertices;

    this.draftColor = Color.fromCssColorString(spec.color);

    // Preview the same curve the committed feature will get, so what is drawn
    // is what ends up on the plan.
    const traced = smoothCartesians(path, smoothing, closed);
    // Closing the ring while drawing shows the area that will actually be made.
    if (closed && traced.length > 2) traced.push(traced[0]);

    // Mutating in place keeps the callback's array identity stable.
    this.draftPath.length = 0;
    this.draftPath.push(...traced);
    this.ensureDraftLine().show = this.draftPath.length >= 2;

    if (closed && options.fill !== false) {
      this.draftFill ??= this.dataSource.entities.add({
        polygon: { classificationType: ClassificationType.BOTH },
      });
      // The fill is a ground primitive, so every rebuild costs a blink. It
      // tracks the placed vertices only and is left alone while the cursor
      // moves — the outline is the live feedback.
      if (vertices.length !== this.draftFillCount && this.draftFill.polygon) {
        this.draftFillCount = vertices.length;
        this.draftFill.polygon.hierarchy = new PolygonHierarchy(
          smoothCartesians(vertices, smoothing, true),
        ) as never;
        this.draftFill.polygon.material = this.draftColor.withAlpha(0.26) as never;
      }
      this.draftFill.show = vertices.length >= 3;
    } else if (this.draftFill) {
      this.draftFill.show = false;
    }

    this.viewer.scene.requestRender();
  }

  /**
   * Forces the area fill to catch up on the next draft update. Used when a
   * gesture ended without changing the vertex count — a corner drag — where the
   * one-rebuild cost is worth paying to stop the shading lagging the outline.
   */
  invalidateDraftFill() {
    this.draftFillCount = -1;
  }

  clearDraft() {
    this.draftPath.length = 0;
    if (this.draftLine) this.draftLine.show = false;
    if (this.draftFill) this.draftFill.show = false;
    this.draftFillCount = -1;
    this.viewer.scene.requestRender();
  }

  /**
   * Vertex handles. Points, not geometry, so moving one is a cheap per-frame
   * update, and depth testing is off so a handle on the far side of a rise is
   * still grabbable.
   */
  private drawHandles(
    points: Cartesian3[],
    closed: boolean,
    midpoints: boolean,
    activeIndex: number | null = null,
  ) {
    const spots: { position: Cartesian3; meta: VertexHandle }[] = points.map((position, index) => ({
      position,
      meta: { role: 'vertex', index },
    }));

    if (midpoints && points.length >= 2) {
      const segments = closed ? points.length : points.length - 1;
      for (let i = 0; i < segments; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        spots.push({
          position: Cartesian3.midpoint(a, b, new Cartesian3()),
          // Dragging this one adds a vertex between its two neighbours.
          meta: { role: 'midpoint', index: i + 1 },
        });
      }
    }

    // Entity ids are fixed at construction, so the pool is addressed by slot and
    // the slot's meaning is kept alongside it.
    while (this.handleEntities.length < spots.length) {
      this.handleEntities.push(
        this.dataSource.entities.add({
          id: `${HANDLE_PREFIX}${this.handleEntities.length}`,
          point: { disableDepthTestDistance: Number.POSITIVE_INFINITY, outlineWidth: 2 },
        }),
      );
      this.handleMeta.push(null);
    }

    spots.forEach((spot, slot) => {
      const entity = this.handleEntities[slot];
      const vertex = spot.meta.role === 'vertex';
      const active = vertex && spot.meta.index === activeIndex;
      entity.show = true;
      entity.position = spot.position as never;
      if (entity.point) {
        entity.point.pixelSize = (vertex ? (active ? 15 : 12) : 8) as never;
        entity.point.color = (
          active ? Color.fromCssColorString('#38bdf8') : Color.WHITE.withAlpha(vertex ? 1 : 0.55)
        ) as never;
        entity.point.outlineColor = OUTLINE_DARK.withAlpha(vertex ? 1 : 0.5) as never;
      }
      this.handleMeta[slot] = spot.meta;
    });

    for (let slot = spots.length; slot < this.handleEntities.length; slot++) {
      this.handleEntities[slot].show = false;
      this.handleMeta[slot] = null;
    }

    this.viewer.scene.requestRender();
  }

  clearHandles() {
    for (const entity of this.handleEntities) entity.show = false;
    this.handleMeta.fill(null);
    this.viewer.scene.requestRender();
  }

  /** Handles for the vertices a draw tool has placed so far. */
  setDraftHandles(points: Cartesian3[], activeIndex: number | null = null) {
    this.drawHandles(points, false, false, activeIndex);
  }

  /** Attaches editing handles to a committed shape, or detaches them. */
  setEditing(feature: PlacedFeature | null) {
    if (!feature || feature.geometry.type === 'point') {
      this.editing = null;
      this.clearHandles();
      this.clearDraft();
      return;
    }
    this.editing = {
      kind: feature.kind,
      closed: feature.geometry.type === 'polygon',
      positions: feature.geometry.positions,
      smoothing: smoothingOf(feature),
    };
    this.clearDraft();
    this.drawHandles(toCartesians(this.editing.positions), this.editing.closed, true);
  }

  /**
   * Shows where a vertex drag has got to without touching the store — the
   * committed shape stays put until the drag ends, so nothing rebuilds mid-drag.
   */
  previewEditing(positions: LonLatHeight[], activeIndex: number | null) {
    if (!this.editing) return;
    const points = toCartesians(positions);
    // Midpoints are hidden mid-drag: they would slide around under the cursor.
    this.drawHandles(points, this.editing.closed, false, activeIndex);
    this.setDraft(this.editing.kind, points, undefined, {
      fill: false,
      smoothing: this.editing.smoothing,
    });
  }

  /** Drops the drag preview and puts the resting handles back. */
  endPreview() {
    if (!this.editing) return;
    this.clearDraft();
    this.drawHandles(toCartesians(this.editing.positions), this.editing.closed, true);
  }

  /** Which handle, if any, a pick landed on. */
  handleAt(entity: unknown): VertexHandle | null {
    const id = (entity as Entity | undefined)?.id;
    if (typeof id !== 'string' || !id.startsWith(HANDLE_PREFIX)) return null;
    return this.handleMeta[Number(id.slice(HANDLE_PREFIX.length))] ?? null;
  }

  /**
   * Hides the dragged structure and shows a ground ring in its place. The box
   * would otherwise sit in the depth buffer directly under the cursor, so each
   * pick would resolve against the structure and walk it toward the camera.
   */
  beginDrag(id: string, footprintRadius = 11) {
    const entity = this.entities.get(id);
    if (!entity) return;
    entity.show = false;
    this.dragGhost ??= this.dataSource.entities.add({
      ellipse: {
        material: DRAG_GHOST,
        classificationType: ClassificationType.BOTH,
      },
    });
    if (this.dragGhost.ellipse) {
      this.dragGhost.ellipse.semiMajorAxis = footprintRadius as never;
      this.dragGhost.ellipse.semiMinorAxis = footprintRadius as never;
    }
    this.dragGhost.show = true;
    this.viewer.scene.requestRender();
  }

  updateDrag(groundPosition: Cartesian3) {
    if (!this.dragGhost) return;
    this.dragGhost.position = groundPosition as never;
    this.viewer.scene.requestRender();
  }

  endDrag(id: string) {
    const entity = this.entities.get(id);
    if (entity) entity.show = true;
    if (this.dragGhost) this.dragGhost.show = false;
    this.viewer.scene.requestRender();
  }

  featureIdFor(entity: unknown): string | null {
    const id = (entity as Entity | undefined)?.id;
    return typeof id === 'string' && id.startsWith(ENTITY_PREFIX)
      ? id.slice(ENTITY_PREFIX.length)
      : null;
  }

  destroy() {
    this.stopWatchingModels();
    this.viewer.dataSources.remove(this.dataSource, true);
    this.entities.clear();
    this.variants.clear();
    this.handleEntities.length = 0;
    this.handleMeta.length = 0;
    this.editing = null;
  }
}
