# Short Farms 3D site planner

An interactive 3D site-planning app for the family farmland. Fly over the real
parcel on Google Photorealistic 3D Tiles, place planned features by clicking,
and save layouts as files you can hand to anyone.

It is a single-page app built with Vite, React 19, TypeScript, CesiumJS,
Zustand and Tailwind CSS 4. There is no backend: plans live in the browser and
leave it only as files you export.

## Running it

The project uses bun.

```bash
bun install
bun run dev      # http://localhost:5173
```

```bash
bun run build    # tsc -b, then a production bundle in dist/
bun run preview  # serve the production build locally
bun run lint     # oxlint
```

There is no test suite and no CI. `bun run build` type-checks before it
bundles, so it is the nearest thing to a gate, and `bun run lint` covers the
React hook rules.

`scripts/farm` wraps the same commands as `scripts/farm dev`, `build`,
`preview` and `lint`. Run bare in an interactive terminal with fzf installed, it
opens a picker. `scripts/farm shell` prints a zsh function and completion to
paste into `~/.zshrc`.

## Using the editor

| Action | How |
| --- | --- |
| Place a structure | `H` house, `F` restaurant, `M` marina, `B` barn, `D` bridge, `C` horse carriage or `T` tree, then click the ground. The tool stays armed, so click again to place more. |
| Draw a road, path, river or air strip | `R` road, `N` stone path, `W` river or `A` air strip. Click along the route, then `Enter` or double-click to finish. |
| Draw a pond, garden, pasture or wheat field | `P` pond, `G` garden, `S` pasture or `K` wheat. Click around the edge, then `Enter` or double-click to finish. |
| Undo the last point | `Backspace` while drawing |
| Cancel a drawing | `Esc` |
| Select / move | `V`, click a feature. Structures drag to move. |
| Reshape a line or area | Select it. Drag a white point to move it, drag a small point to add one, Alt-click a white point to remove one. |
| Rename | Select it, edit **Name** in the right panel, `Enter` |
| Rotate a structure | **Heading** slider |
| Choose a house model | With the House tool armed, pick from the **House model** list. With a house selected, use its **Model** menu. |
| Widen a road, path, river or strip | **Width** slider (metres) |
| Round the corners of a line or area | **Smoothing** slider. The stored points do not change. |
| Delete | Select it, press `Delete` |
| Undo / redo | `Cmd+Z` / `Shift+Cmd+Z` (`Ctrl` on Windows and Linux), or the arrow buttons in the top bar. History holds 80 steps. |
| Recenter the camera | **Recenter on parcel** in the Layers panel |

Keyboard shortcuts are ignored while a text field has focus. Lines report their
length, and areas report their area and perimeter, in metric and imperial units.

Pastures and wheat fields are graded fields. A field cuts its footprint out of
the photorealistic tiles, which clears the trees and sheds baked into them, and
then lays its own ground surface and standing crop in the hole. The **Pad
height** slider raises or lowers the field's graded surface, and the **Clear the
site** checkbox turns the cut off so the crop sits over what is already there.
The cut needs a browser with WebGL 2.

The list button beside the project name opens the Components panel. It lists
everything on the plan in tabs by kind, flies the camera to a feature when you
click it, and edits the feature in place. The Layers panel has two toggles,
**Photorealistic 3D** and **Parcel boundary**. It also has **View from ground**,
which drops the camera to eye level: the up and down arrows walk, the left and
right arrows turn, `Shift` runs, right-drag looks around and `Esc` leaves. In
every view the camera is tethered to the parcel, and the limits are set by
`CAMERA_BOUNDS` in `src/config.ts`.

Everything you place saves automatically to your browser. **Save** downloads the
layout as a `.json` file, and **Load** reads one back in. It asks whether to add
to the current plan or replace it.

## Projects and boundary files

Click the project name (top left) to switch between plans, create a new one, or
delete one. Double-click the name to rename it. The first time the app runs with
nothing saved, it creates a first project and loads `public/Farm.kml` as its
boundary.

The **KML** button swaps the boundary file for the current project. Placed
features are kept when you do this, so you can drop in an updated survey and
keep everything you have already laid out on top of it. Each project holds its
own KML and its own features, so different parcels stay separate.

## Where your data lives

Layouts are stored in your browser (IndexedDB, under the key `farm-planner/v1`)
on the machine you use. There is no server and no account. To show a plan to
someone else, use **Save** and send them the JSON file, which they load with
**Load**. The exported file embeds the boundary KML too, so it opens standalone.

Clearing your browser's site data will erase saved projects, so export anything
you care about.

## The Cesium ion token

The token has a default in `src/config.ts`. Override it without editing code by
adding this line to `.env.local`, which git ignores, and restarting the dev
server:

```bash
VITE_CESIUM_ION_TOKEN=your_token_here
```

Client-side map tokens are necessarily visible in the browser. Restrict yours to
your deployed domain in the [ion dashboard](https://ion.cesium.com/tokens).

**Two 404s in the browser console on load are expected when the token covers
only the Photorealistic 3D Tiles asset.** The app makes optional requests for
Cesium World Terrain (asset 1) and Bing imagery (asset 3). With a narrow token
they come back empty and the app carries on without them. If you add those
assets to the token's scope, the "Photorealistic 3D" toggle in the Layers panel
becomes usable and lets you switch between photorealistic tiles and terrain plus
satellite imagery.

## Deploying

The build output is a static site. `netlify.toml` is already configured: it runs
`bun run build`, publishes `dist/` on Node 24, falls every path back to
`index.html`, and sets long-lived cache headers on `/cesium/*` and `/assets/*`.

```bash
bun run build   # then drag dist/ into Netlify, or connect the repo
```

The checkout also carries a `.vercel` folder that links it to a Vercel project
named `farm`. That folder is gitignored.

## How the code is organised

```
index.html               sets CESIUM_BASE_URL before any Cesium code loads
vite.config.ts           dev server on 5173; serves and copies Cesium's static
                         folders at /cesium/; splits Cesium into its own chunk
netlify.toml             Netlify build, redirect and cache settings
scripts/farm             command dispatcher for dev, build, preview and lint
public/
  Farm.kml               default parcel boundary
  models/                GLB models (see models/README.md)
  textures/              photographic ground textures
src/
  main.tsx, App.tsx      entry point and the overlay layout
  config.ts              ion token, parcel centre, camera framing and limits,
                         bundled KML, storage key
  featureCatalog.ts      every feature kind: label, shortcut, geometry, colour,
                         surface, model and field settings
  houseModels.ts         the house models the House tool offers
  types.ts               Feature / Project / layout-file shapes
  toolMeta.ts            tool labels + shortcuts (no Cesium import, so the UI
                         bundle stays free of the engine)
  state/
    store.ts             Zustand store: projects, features, selection, tool,
                         undo history
    persistence.ts       debounced IndexedDB read/write
  cesium/
    viewer.ts            viewer setup, tileset/terrain/imagery capabilities
    kmlLayer.ts          KML load, styling, camera framing
    featureLayer.ts      renders features as entities; drag and vertex handles
    usePlannerScene.ts   mounts the engine, wires store -> scene
    cameraBounds.ts      keeps the camera tethered to the parcel
    groundView.ts        the walk-around view from eye level
    tilesetClipping.ts   cuts field footprints out of the photorealistic tiles
    fieldSurface.ts      the textured ground of a field
    cropCards.ts         the standing crop, as camera-facing cards
    renderPump.ts        continuous rendering while a gesture is live
    tools/               placement, drawing and select tools, and the input
                         controller
  components/            React overlay UI
  lib/                   geometry and units, smoothing, the fitted field plane,
                         crop scattering, procedural textures, model probing,
                         file import and export
```

`instructions.txt` is the original build brief and `source.html` is a saved
Cesium Sandcastle page. The app does not use either.

### Adding another feature kind

Almost everything is generated from `src/featureCatalog.ts`. To add a kind:

1. Add its `FeatureKind` to `types.ts`.
2. Add a spec to `FEATURE_SPECS` with its label, shortcut, geometry `mode`,
   colour, toolbar `group`, and default props.
3. Add an icon to the `icons` map in `components/Toolbar.tsx`.

That is enough to get a toolbar button, a keyboard shortcut, a hint, placement
or drawing behaviour, catalog-based naming ("Pond 1"), and an Inspector that
shows the right fields. `tools/index.ts` builds a click-to-place tool for
`point` kinds and a multi-vertex draw tool for `polyline` and `polygon` kinds,
so new kinds usually need no new tool code at all. A point kind can point at a
GLB through `model`, a drawn kind can take a `surface` texture, and a polygon
kind becomes a graded field by setting `field`. Only a genuinely new look needs
a renderer in `cesium/featureLayer.ts`.

### Adding a model

Drop the `.glb` into `public/models/` and point `src/houseModels.ts` (for
houses) or the `model` field of a spec in `src/featureCatalog.ts` (for other
structures) at it. `public/models/README.md` covers the authoring rules: origin
at the centre of the base, +Y up, metres. A missing file is handled safely,
because the app probes each URL first and draws a correctly sized placeholder
box instead.

### Performance notes

- The scene runs in `requestRenderMode`, so it only redraws when something
  changes rather than at 60 fps continuously. `RenderPump` switches to
  continuous rendering while a drag or a rubber band is live.
- React stays out of the render loop: the scene subscribes to the store
  imperatively, and dragging updates Cesium entities directly, committing to the
  store only on mouse-up.
- Cesium loads as a separate chunk behind a dynamic import, so the UI shell
  paints while the engine streams in.
- The crop on a field is one billboard collection, and only the cells near the
  camera are built, so the card count depends on the view radius and not on the
  size of the field.

### Where to read next

`docs/AGENT-PRACTICES.md` and `docs/conventions-typescript.md` are the working
standard and the code standard for this repo. `HANDOFF.md` is the ledger of what
is true and what has been done, and `PASSOFF.md` is the board of what is next.
`CLAUDE.md` tells an agent session what to read first.
