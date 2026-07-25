import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { BUNDLED_KML } from '../config';
import { specByKind } from '../featureCatalog';
import { DEFAULT_HOUSE_MODEL_ID } from '../houseModels';
import { loadPersisted, savePersisted } from './persistence';
import type {
  FeatureKind,
  Geometry,
  KmlSource,
  LayoutFile,
  PlacedFeature,
  Project,
  ToolId,
} from '../types';

/** One undo step: the active project's features, and what was selected. */
interface Snapshot {
  features: PlacedFeature[];
  selectedId: string | null;
}

/** How many steps back the history goes. */
const HISTORY_LIMIT = 80;

interface PlannerState {
  projects: Project[];
  activeProjectId: string | null;
  tool: ToolId;
  selectedId: string | null;
  hydrated: boolean;
  showPhotorealistic: boolean;
  showBoundary: boolean;
  /** Which house model the House tool places next. */
  houseModelId: string;

  /** Undo history for the active project only; switching projects clears it. */
  past: Snapshot[];
  future: Snapshot[];
  /**
   * Groups a run of related edits into one undo step. A slider dragged from 6 m
   * to 20 m should be a single step, not fourteen.
   */
  historyTag: string | null;

  hydrate: () => Promise<void>;
  setTool: (tool: ToolId) => void;
  setSelected: (id: string | null) => void;
  setHouseModel: (id: string) => void;
  toggleLayer: (layer: 'showPhotorealistic' | 'showBoundary') => void;

  undo: () => void;
  redo: () => void;
  /** Ends the current coalescing group — call when a gesture finishes. */
  endHistoryGroup: () => void;

  createProject: (name: string, kml?: KmlSource | null) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setActiveProject: (id: string) => void;
  setProjectKml: (id: string, kml: KmlSource) => void;

  addFeature: (kind: FeatureKind, geometry: Geometry, name?: string) => string;
  updateFeature: (
    id: string,
    patch: Partial<Omit<PlacedFeature, 'id'>>,
    /** Repeat the same tag to fold successive edits into one undo step. */
    historyTag?: string,
  ) => void;
  removeFeature: (id: string) => void;

  exportLayout: () => LayoutFile | null;
  importLayout: (layout: LayoutFile, mode: 'replace' | 'merge') => void;
}

function newProject(name: string, kml: KmlSource | null = null): Project {
  const now = Date.now();
  return { id: nanoid(10), name, kml, features: [], createdAt: now, updatedAt: now };
}

function persist(state: PlannerState) {
  savePersisted({
    version: 1,
    projects: state.projects,
    activeProjectId: state.activeProjectId,
  });
}

/** Wiped whenever the history would no longer line up with what is on screen. */
const NO_HISTORY = { past: [] as Snapshot[], future: [] as Snapshot[], historyTag: null };

/**
 * Applies a mutation to the active project, records an undo step, bumps
 * updatedAt, and persists.
 */
function withActive(
  set: (fn: (s: PlannerState) => Partial<PlannerState>) => void,
  mutate: (project: Project) => Project,
  historyTag: string | null = null,
) {
  set((state) => {
    const active = state.projects.find((p) => p.id === state.activeProjectId);
    if (!active) return {};

    // A repeated tag means this is a continuation of the last edit, so the step
    // recorded when the gesture began is the one to come back to.
    const coalesce = historyTag !== null && historyTag === state.historyTag;
    const past = coalesce
      ? state.past
      : [...state.past, { features: active.features, selectedId: state.selectedId }].slice(
          -HISTORY_LIMIT,
        );

    const projects = state.projects.map((p) =>
      p.id === active.id ? { ...mutate(p), updatedAt: Date.now() } : p,
    );
    const patch = { projects, past, future: [], historyTag };
    persist({ ...state, ...patch });
    return patch;
  });
}

/** Moves one step along the history, mirroring the current state onto the other stack. */
function travel(state: PlannerState, from: 'past' | 'future'): Partial<PlannerState> {
  const stack = state[from];
  const entry = stack[stack.length - 1];
  const active = state.projects.find((p) => p.id === state.activeProjectId);
  if (!entry || !active) return {};

  const other = from === 'past' ? 'future' : 'past';
  const projects = state.projects.map((p) =>
    p.id === active.id ? { ...p, features: entry.features, updatedAt: Date.now() } : p,
  );

  const patch = {
    projects,
    // Undoing the placement of a feature must not leave it selected.
    selectedId: entry.features.some((f) => f.id === entry.selectedId) ? entry.selectedId : null,
    historyTag: null,
    [from]: stack.slice(0, -1),
    [other]: [...state[other], { features: active.features, selectedId: state.selectedId }].slice(
      -HISTORY_LIMIT,
    ),
  } as Partial<PlannerState>;

  persist({ ...state, ...patch } as PlannerState);
  return patch;
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  tool: 'select',
  selectedId: null,
  hydrated: false,
  showPhotorealistic: true,
  showBoundary: true,
  houseModelId: DEFAULT_HOUSE_MODEL_ID,
  past: [],
  future: [],
  historyTag: null,

  hydrate: async () => {
    if (get().hydrated) return;
    const saved = await loadPersisted();

    if (saved && saved.projects.length > 0) {
      const activeProjectId =
        saved.activeProjectId && saved.projects.some((p) => p.id === saved.activeProjectId)
          ? saved.activeProjectId
          : saved.projects[0].id;
      set({ projects: saved.projects, activeProjectId, hydrated: true });
      return;
    }

    let kml: KmlSource | null = null;
    try {
      const res = await fetch(BUNDLED_KML.url);
      if (res.ok) {
        kml = { name: BUNDLED_KML.name, text: await res.text(), importedAt: Date.now() };
      }
    } catch {
      kml = null;
    }

    const project = newProject('Short Farms — Master Plan', kml);
    set({ projects: [project], activeProjectId: project.id, hydrated: true });
    persist(get());
  },

  setTool: (tool) => set({ tool, selectedId: tool === 'select' ? get().selectedId : null }),
  setSelected: (selectedId) => set({ selectedId }),

  // Changing the model with a house selected retimes that house too, so the
  // picker doubles as a swap control for the current selection.
  setHouseModel: (houseModelId) => {
    set({ houseModelId });
    const { selectedId, projects, activeProjectId, updateFeature } = get();
    const feature = projects
      .find((p) => p.id === activeProjectId)
      ?.features.find((f) => f.id === selectedId);
    if (feature?.kind === 'house') {
      updateFeature(feature.id, { props: { ...feature.props, modelId: houseModelId } });
    }
  },

  toggleLayer: (layer) => set((s) => ({ [layer]: !s[layer] }) as Partial<PlannerState>),

  undo: () => set((s) => travel(s, 'past')),
  redo: () => set((s) => travel(s, 'future')),
  endHistoryGroup: () => set({ historyTag: null }),

  createProject: (name, kml = null) => {
    const project = newProject(name, kml);
    set((s) => {
      const next = {
        ...s,
        projects: [...s.projects, project],
        activeProjectId: project.id,
        selectedId: null,
        ...NO_HISTORY,
      };
      persist(next);
      return {
        projects: next.projects,
        activeProjectId: project.id,
        selectedId: null,
        ...NO_HISTORY,
      };
    });
    return project.id;
  },

  deleteProject: (id) => {
    set((s) => {
      const projects = s.projects.filter((p) => p.id !== id);
      const activeProjectId =
        s.activeProjectId === id ? (projects[0]?.id ?? null) : s.activeProjectId;
      const next = { ...s, projects, activeProjectId, selectedId: null, ...NO_HISTORY };
      persist(next);
      return { projects, activeProjectId, selectedId: null, ...NO_HISTORY };
    });
  },

  renameProject: (id, name) => {
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p,
      );
      const next = { ...s, projects };
      persist(next);
      return { projects };
    });
  },

  // History belongs to one project's feature list, so it does not survive a
  // switch to another.
  setActiveProject: (activeProjectId) => {
    set((s) => {
      const next = { ...s, activeProjectId, selectedId: null, ...NO_HISTORY };
      persist(next);
      return { activeProjectId, selectedId: null, ...NO_HISTORY };
    });
  },

  // Swapping the KML deliberately leaves `features` untouched.
  setProjectKml: (id, kml) => {
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id ? { ...p, kml, updatedAt: Date.now() } : p,
      );
      const next = { ...s, projects };
      persist(next);
      return { projects };
    });
  },

  addFeature: (kind, geometry, name) => {
    const now = Date.now();
    const state = get();
    const spec = specByKind[kind];
    // Number each kind independently: "Pond 1" rather than "Pond 7".
    const existing =
      state.projects
        .find((p) => p.id === state.activeProjectId)
        ?.features.filter((f) => f.kind === kind).length ?? 0;
    const feature: PlacedFeature = {
      id: nanoid(10),
      kind,
      name: name ?? `${spec.label} ${existing + 1}`,
      geometry,
      props: { ...spec.defaults, ...(kind === 'house' && { modelId: state.houseModelId }) },
      createdAt: now,
      updatedAt: now,
    };
    withActive(set, (p) => ({ ...p, features: [...p.features, feature] }));
    return feature.id;
  },

  updateFeature: (id, patch, historyTag) => {
    withActive(
      set,
      (p) => ({
        ...p,
        features: p.features.map((f) =>
          f.id === id ? { ...f, ...patch, updatedAt: Date.now() } : f,
        ),
      }),
      historyTag ?? null,
    );
  },

  removeFeature: (id) => {
    withActive(set, (p) => ({ ...p, features: p.features.filter((f) => f.id !== id) }));
    if (get().selectedId === id) set({ selectedId: null });
  },

  exportLayout: () => {
    const s = get();
    const project = s.projects.find((p) => p.id === s.activeProjectId);
    if (!project) return null;
    return {
      format: 'farm-planner-layout',
      version: 1,
      exportedAt: new Date().toISOString(),
      projectName: project.name,
      kml: project.kml,
      features: project.features,
    };
  },

  importLayout: (layout, mode) => {
    withActive(set, (p) => ({
      ...p,
      kml: layout.kml ?? p.kml,
      features:
        mode === 'replace'
          ? layout.features
          : [...p.features, ...layout.features.map((f) => ({ ...f, id: nanoid(10) }))],
    }));
    set({ selectedId: null });
  },
}));

export const selectActiveProject = (s: PlannerState) =>
  s.projects.find((p) => p.id === s.activeProjectId) ?? null;

/**
 * Shared so the selector returns a stable reference when there is no project.
 * A fresh array each call reads as a new snapshot and re-renders forever.
 */
const NO_FEATURES: PlacedFeature[] = [];

export const selectFeatures = (s: PlannerState) => selectActiveProject(s)?.features ?? NO_FEATURES;

export const selectSelectedFeature = (s: PlannerState) =>
  selectActiveProject(s)?.features.find((f) => f.id === s.selectedId) ?? null;
