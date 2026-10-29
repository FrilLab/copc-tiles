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
for the lifetime of its reader and resource provider. `TileNodeReader` has no
close method: close the resource server, then close the connector or destroy
the source if your application owns it. Resource providers remain caller-owned
unless `closeProviderOnShutdown: true` is set on the resource server.

The optional `@frillab/copc-tiles/adapter/copc-js` integration entrypoint
supports the verified `@frillab/copc-adapter@0.6.0` public API for bounded
node reads and A-shaped point preparation. It dynamically loads the Adapter
`/cesium` entrypoint only when fallback preparation is needed. Version 0.6.0
does not provide conservative ECEF bounds for undecoded node cells or a
transform generation contract, so this connector cannot build a complete
real COPC hierarchy. Adapter [PR #391](https://github.com/mors119/copc-adapter/pull/391)
proposes a renderer-neutral node source but is not merged or published; its
decoded-point bounds still do not bound undecoded cells. See the [compatibility
matrix](./implementation-status.md#source-api-compatibility-matrix) and
[Adapter issue #383](https://github.com/mors119/copc-adapter/issues/383).

The real Autzen browser check pre-encodes one bounded COPC node before the
renderer starts, then serves its tileset and GLB by URL. This proves that real
Adapter-prepared content can be consumed by both renderers; it is not an
on-demand COPC-to-resource provider and does not represent a full COPC
hierarchy. The source-neutral `TileResourceServer` supports lazy resource
providers, but connecting it to a complete Adapter hierarchy remains blocked
by the missing public cell-bound and generation contracts.
