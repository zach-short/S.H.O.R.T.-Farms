# Short Farms — 3D Site Planner

An interactive 3D site-planning app for the family farmland. Fly over the real
parcel on Google Photorealistic 3D Tiles, place planned features by clicking,
and save layouts as files you can hand to anyone.

## Running it

```bash
bun install
bun run dev      # http://localhost:5173
```

```bash
bun run build    # production bundle in dist/
bun run preview  # serve the production build locally
```

## Using the editor

| Action | How |
| --- | --- |
| Place a structure | `H` house · `F` restaurant · `M` marina · `T` tree, then click the ground |
| Draw a road / air strip | `R` or `A`, click along the route, `Enter` or double-click to finish |
| Draw a pond / garden | `P` or `G`, click around the edge, `Enter` or double-click to finish |
| Undo the last point | `Backspace` while drawing |
| Cancel a drawing | `Esc` |
| Select / move | `V`, click a feature; structures drag to move |
| Rename | Select it, edit **Name** in the right panel, `Enter` |
| Rotate a structure | **Heading** slider |
| Widen a road / strip | **Width** slider (metres) |
| Delete | Select it, press `Delete` |
| Recenter the camera | **Recenter on parcel** in the Layers panel |

Roads and air strips report their **length**; ponds and gardens report **area
and perimeter** in acres and metres. Lines and areas are defined by their
vertices, so they are selectable but not draggable as a whole — redraw to
reshape.

Everything you place saves automatically to your browser. **Save** downloads the
layout as a `.json` file; **Load** reads one back in (it asks whether to add to
the current plan or replace it).

## Projects and boundary files

Click the project name (top left) to switch between plans, create a new one, or
delete one. Double-click the name to rename it.

The **KML** button swaps the boundary file for the current project. Placed
features are deliberately kept when you do this — so you can drop in an updated
survey and keep everything you have already laid out on top of it. Each project
holds its own KML and its own features, so different parcels stay separate.

## Where your data lives

Layouts are stored in your browser (IndexedDB) on the machine you use. There is
no server and no account. To show a plan to someone else, use **Save** and send
them the JSON file, which they load with **Load**. The exported file embeds the
boundary KML too, so it opens standalone.

Clearing your browser's site data will erase saved projects — export anything
you care about.

## The Cesium ion token

The token lives in `src/config.ts` and can be overridden without editing code:

```bash
echo 'VITE_CESIUM_ION_TOKEN=your_token_here' > .env.local
```

Client-side map tokens are necessarily visible in the browser. Restrict yours to
your deployed domain in the [ion dashboard](https://ion.cesium.com/tokens).

**Two 404s in the browser console on load are expected.** The current token is
scoped to the Photorealistic 3D Tiles asset only, so the app's optional probes
for Cesium World Terrain (asset 1) and Bing imagery (asset 3) come back empty and
it carries on without them. If you add those assets to the token's scope, the
"Photorealistic 3D" toggle in the Layers panel becomes usable and lets you switch
between photorealistic tiles and terrain + satellite imagery.

## Deploying

The build output is a static site. `netlify.toml` is already configured:

```bash
bun run build   # then drag dist/ into Netlify, or connect the repo
```

## How the code is organised

```
src/
  config.ts              ion token, parcel centre, camera framing
  featureCatalog.ts      every feature kind: label, shortcut, geometry, colour
  types.ts               Feature / Project / layout-file shapes
  toolMeta.ts            tool labels + shortcuts (no Cesium import, so the UI
                         bundle stays free of the engine)
  state/
    store.ts             Zustand store: projects, features, selection, tool
    persistence.ts       debounced IndexedDB read/write
  cesium/
    viewer.ts            viewer setup, tileset/terrain/imagery capabilities
    kmlLayer.ts          KML load, styling, camera framing
    featureLayer.ts      renders features as entities; drag handling
    usePlannerScene.ts   mounts the engine, wires store -> scene
    tools/               placement + drawing tools and the input controller
  components/            React overlay UI
```

### Adding another feature kind

Almost everything is generated from `src/featureCatalog.ts`. To add a kind:

1. Add its `FeatureKind` to `types.ts`.
2. Add a spec to `FEATURE_SPECS` — label, shortcut, geometry `mode`, colour,
   toolbar `group`, and default props.
3. Add an icon to the `icons` map in `components/Toolbar.tsx`.

That is enough to get a toolbar button, a keyboard shortcut, a hint, placement
or drawing behaviour, catalog-based naming ("Pond 1"), and an Inspector that
shows the right fields. `tools/index.ts` builds a click-to-place tool for
`point` kinds and a multi-vertex draw tool for `polyline`/`polygon` kinds, so
new kinds usually need no new tool code at all. Only a genuinely new *look*
needs a renderer in `cesium/featureLayer.ts`.

### Performance notes

- The scene runs in `requestRenderMode`, so it only redraws when something
  actually changes rather than at 60 fps continuously.
- React is kept out of the render loop entirely: the scene subscribes to the
  store imperatively, and dragging updates Cesium entities directly, committing
  to the store only on mouse-up.
- Cesium loads as a separate chunk behind a dynamic import, so the UI shell
  paints (~75 kB gzipped) while the engine streams in.
