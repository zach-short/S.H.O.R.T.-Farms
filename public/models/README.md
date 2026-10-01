# Model assets

This folder holds the GLB models the site planner draws in place of its placeholder boxes. Vite serves everything in `public/` from the site root, so `public/models/barn.glb` is requested as `/models/barn.glb`. The app itself is described in the parent README (`../../README.md`).

## Files

Seven GLB files are here, and each one is wired to a feature in the code.

| File | Draws | Wired in |
| --- | --- | --- |
| `small_house.glb` | House model "Small House" | `src/houseModels.ts` |
| `medium_house.glb` | House model "Medium House" | `src/houseModels.ts` |
| `large_house.glb` | House model "Large House" | `src/houseModels.ts` |
| `barn.glb` | Barn | `src/featureCatalog.ts` |
| `bridge.glb` | Bridge | `src/featureCatalog.ts` |
| `horse_carriage.glb` | Horse Carriage | `src/featureCatalog.ts` |
| `tree.glb` | Tree | `src/featureCatalog.ts` |

The files are large: 25 MB for the barn up to 84 MB for the small house, about 290 MB in total. Vite copies `public/` into `dist/` on build, so every file here goes into the production bundle.

The other six house entries in `src/houseModels.ts` (Garden Cottage, Stone Cottage, Lakeside Cottage, Manor Cottage, Watermill and Chapel) have `url: null`. The Restaurant and Marina kinds have no `model` on their spec. All of these draw a box at their declared size, so their footprints on the plan are already true to the finished buildings.

`PARITY_STRUCTURE_PROMPT.md` is also in this folder. It is a task prompt for a different project (the ezHomesteading web and native apps). The planner does not read it and nothing in the repo refers to it, so it is not a model asset.

## Adding or replacing a model

Copy the GLB into this folder, then point the code at it. There are two places to do that, depending on the kind of feature.

For a house, edit the entry in `HOUSE_MODELS` in `src/houseModels.ts`. For example:

```ts
{
  id: 'stone-cottage',
  label: 'Stone Cottage',
  description: 'Classic two-bedroom cottage with a stone chimney.',
  size: [10, 8, 7.5],            // metres: [width (east), depth (north), ridge height]
  url: '/models/stone-cottage.glb',
  scale: 1,
  originLift: 3.75,
}
```

For a structure kind with one fixed look (barn, bridge, carriage) or for the tree, set `model` on its spec in `src/featureCatalog.ts`:

```ts
model: { url: '/models/barn.glb', scale: 5.89, originLift: 4.5 },
```

Three fields describe how the file sits in the world. `size` is the real-world footprint and height in metres. It drives the placeholder box and the drag ring, so keep it accurate after the GLB lands. The footprint then stays the same when a placeholder gives way to its model. `scale` multiplies the model. Exporters disagree about units, and every file currently here needs a scale other than 1, so place one on the plan, compare it against the `size` footprint, and adjust until they match. `originLift` raises the model above the ground point by that many metres.

After editing, run `bun run dev` (http://localhost:5173), place the feature and check its size, height and facing.

## Authoring notes

- Use glTF conventions: +Y up and metres. If an export is in another unit, correct it with `scale` and leave the mesh alone.
- Put the origin at the centre of the base and leave `originLift` unset, or accept the origin at the centre of the volume and set `originLift` to half the height. AI-generated exports usually have a centred origin, and every file here sets `originLift` above zero. Without the lift, such a model renders half-buried.
- Cesium draws an upright model facing east when heading is 0 (Cesium entity documentation). The **Heading** slider in the right panel turns it from there, from 0 to 359 degrees. Only the house, restaurant, marina, barn, bridge and carriage kinds have a heading. Trees do not.

## Missing or broken files

The planner probes each model URL with a HEAD request before it hands the URL to Cesium. If the request fails, or the response is a text type, the feature draws its placeholder box instead. This matters because a failed model load stops the Cesium render loop. It also matters in production: `netlify.toml` sends every unknown path to `index.html` with status 200, so a missing GLB would otherwise come back as an HTML page.

The probe checks the response, not the file contents. A file that downloads but is not a valid GLB is not caught.
