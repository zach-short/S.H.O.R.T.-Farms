# House models

Drop `.glb` files here and point `src/houseModels.ts` at them.

```ts
{
  id: 'stone-cottage',
  label: 'Stone Cottage',
  size: [10, 8, 7.5],            // real-world metres, [width, depth, ridge height]
  url: '/models/stone-cottage.glb',
  scale: 1,
}
```

Until `url` is set, the planner places a correctly-sized placeholder box, so
footprints on the plan are already true to the finished buildings.

## Authoring notes

- **Origin at the centre of the base.** The planner puts the model's origin on
  the ground, so a model centred on its volume will sit half-buried.
- **+Y up, metres.** The glTF convention. If the export is in centimetres, set
  `scale: 0.01` rather than rescaling the mesh.
- **Face +Z forward.** Heading 0° points north; the heading slider rotates from
  there.
- **Keep `size` accurate** even after the GLB lands. It drives the drag ring and
  the placeholder, and it is what makes the swap between the two seamless.

A missing or misnamed file is handled safely: the planner probes each URL first
and falls back to the placeholder rather than handing Cesium a file it cannot
parse, which would stop the render loop.
