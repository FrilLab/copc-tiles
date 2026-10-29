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
real COPC hierarchy. Adapter
[PR #391](https://github.com/mors119/copc-adapter/pull/391) is merged at
`c5b563b3d0c5743b8030a79eca8c820421c9d4a7`; it adds a public renderer-neutral
`/core` API to upstream package source. That API is not in the published
0.6.0 tarball, so this package does not import or claim compatibility with it.
Its decoded-point bounds still do not bound undecoded cells in ECEF. See the
[versioned API compatibility matrix](./adapter-api-compatibility.md) and
[Adapter issue #383](https://github.com/mors119/copc-adapter/issues/383).

The Autzen browser check pre-encodes one bounded COPC node before the renderer
starts, then serves its tileset and GLB by URL. The opt-in SoFi check reads
three real node keys at levels 2–4, checks them against Adapter hierarchy
point counts, encodes their point views, then serves one primary node through
the same URL to Cesium and Three. These checks prove real Adapter-prepared
content can be consumed by both renderers; they are not an on-demand
COPC-to-resource provider or a multi-node Tiles LOD hierarchy. The
source-neutral `TileResourceServer` supports lazy resource providers, but
connecting it to a complete Adapter hierarchy remains blocked by the missing
public conservative cell bounds and transform-generation contract.

The SoFi object is served with HTTP Range, but the browser cannot read its
`Content-Range` response header. The optional test therefore selects the
Adapter's existing `head-fallback` policy and observes a HEAD request; strict
Range validation is not demonstrated for that browser origin. The real test
command is:

```sh
COPC_TILES_SECOND_COPC_URL=https://hobu-lidar.s3.amazonaws.com/sofi.copc.laz \
  npx playwright test --config test/browser/playwright.config.mjs \
  test/browser/second-source.real.spec.mjs
```

The real source tests use public Adapter 0.6.0 only. No Rust, E cache,
File/Blob, named Extra Bytes, independent vertical correction, full source
coverage, or Direct-versus-Tiles comparison is claimed. See the
[release acceptance audit](./release-audit-2026-10-29.md) and
[performance report](./benchmark-report-2026-10-29.md).
