# Using COPC Tiles

COPC Tiles is a source-neutral 3D Tiles engine. Provide a `TileNodeSource`
implementation to the bounded `TileNodeReader`, encode each returned
`TilePointView`, build a tileset from conservative source-provided bounds, and
serve resources with `TileResourceServer`.

```ts
import {
  TileNodeReader,
  encodePointCloudGlb,
  createTileResourceServer,
  type TileNodeSource,
  type TileResourceProvider,
} from '@frillab/copc-tiles';

export async function encodeRequestedNode(
  source: TileNodeSource,
  provider: TileResourceProvider,
) {
  const reader = new TileNodeReader(source, {
    maxRequestedNodes: 8,
    maxPointsPerNode: 100_000,
  });
  const views = await reader.readNodes(['root'], {
    attributes: { rgb: true, intensity: true },
  });
  const view = views.get('root');
  if (!view) throw new Error('The source did not return the requested root node.');
  const rootGlb = encodePointCloudGlb(view);
  if (!rootGlb) throw new Error('The selected node has no points.');

  const resources = createTileResourceServer(provider, {
    maxCacheBytes: 64 * 1024 * 1024,
  });
  // Persist rootGlb.bytes at the URI returned by the tileset builder/provider.
  // Adapt resources.handle(request) to the hosting framework's URL handler.
  return { view, rootGlb, resources };
}
```

The external source must report accurate node identity, point counts, selected
attributes, ECEF Float64 coordinates, coordinate provenance, and conservative
ECEF bounds. Missing data is an error; the engine does not synthesize
attributes, vertical corrections, or bounds. Keep the same source generation
for the lifetime of its reader and resource provider, then close/destroy both
when switching sources.

The optional `@frillab/copc-tiles/adapter/copc-js` integration entrypoint
supports the verified `@frillab/copc-adapter@0.6.0` public API. It dynamically
loads the Adapter `/cesium` entrypoint only when its factory is called. The
current Adapter does not expose enough public bounds and provenance to build a
complete real COPC tileset; see [the implementation status](./implementation-status.md)
and [Adapter issue #383](https://github.com/mors119/copc-adapter/issues/383).
