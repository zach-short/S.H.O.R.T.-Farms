export interface HouseModel {
  id: string;
  label: string;
  description: string;
  /**
   * Real-world size in metres: [width (east), depth (north), ridge height].
   * Drives the placeholder footprint, the drag ring and the label offset, so
   * it should stay accurate even once a GLB is supplying the actual geometry.
   */
  size: [number, number, number];
  /**
   * Path to the GLB under `public/`. Leave `null` until the asset exists —
   * the planner draws a correctly-sized placeholder box in the meantime.
   */
  url: string | null;
  /**
   * Multiplier applied to the GLB. Exporters disagree about units: a model
   * authored in centimetres needs 0.01 here. Tune once per asset by placing
   * one and comparing it against the 8 m ridge of a neighbouring placeholder.
   */
  scale: number;
}

/**
 * Kinkade-style cottages, sized the way the real buildings would be rather
 * than the way they are painted — a storybook cottage reads as tiny, but a
 * liveable one still needs roughly 8–13 m across.
 *
 * To add a real model: drop `cottage.glb` into `public/models/`, set `url` to
 * `/models/cottage.glb`, and adjust `scale` if the export is not in metres.
 */
export const HOUSE_MODELS: HouseModel[] = [
  {
    id: 'garden-cottage',
    label: 'Garden Cottage',
    description: 'One-room stone cottage under a steep thatched roof.',
    size: [8, 7, 6.5],
    url: null,
    scale: 1,
  },
  {
    id: 'stone-cottage',
    label: 'Stone Cottage',
    description: 'Classic two-bedroom cottage with a stone chimney.',
    size: [10, 8, 7.5],
    url: null,
    scale: 1,
  },
  {
    id: 'lakeside-cottage',
    label: 'Lakeside Cottage',
    description: 'Wrap-around porch facing the water.',
    size: [11, 9, 7],
    url: null,
    scale: 1,
  },
  {
    id: 'manor-cottage',
    label: 'Manor Cottage',
    description: 'Two storeys with dormers and a gabled entry.',
    size: [13, 10, 9.5],
    url: null,
    scale: 1,
  },
  {
    id: 'watermill',
    label: 'Watermill',
    description: 'Millhouse with an overshot wheel — wants a creek.',
    size: [10, 8, 9],
    url: null,
    scale: 1,
  },
  {
    id: 'chapel',
    label: 'Chapel',
    description: 'Small stone chapel with a bell tower.',
    size: [9, 15, 11],
    url: null,
    scale: 1,
  },
];

export const DEFAULT_HOUSE_MODEL_ID = 'stone-cottage';

export const houseModelById = Object.fromEntries(HOUSE_MODELS.map((m) => [m.id, m])) as Record<
  string,
  HouseModel | undefined
>;

/** Falls back to the default for houses saved before models existed. */
export function resolveHouseModel(id: string | undefined): HouseModel {
  return (
    (id ? houseModelById[id] : undefined) ??
    houseModelById[DEFAULT_HOUSE_MODEL_ID] ??
    HOUSE_MODELS[0]
  );
}

export const hasAnyHouseModelAsset = () => HOUSE_MODELS.some((m) => m.url !== null);
