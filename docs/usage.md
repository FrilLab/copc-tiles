# Using COPC Tiles

COPC Tiles is a source-neutral 3D Tiles engine. Its optional Adapter connector
uses the renderer-neutral public `@frillab/copc-adapter/core` API. The adapter
source still owns COPC ranges, hierarchy parsing, LAZ decode, and CRS/vertical
preparation. Tiles provides bounded reads for explicitly requested node keys,
encoding, tileset primitives, and resource serving; this review candidate does
not yet connect live COPC hierarchy requests to production multi-node Tiles LOD.

```ts
import { createCopcCoreNodeSource } from '@frillab/copc-tiles/adapter/copc-core';
import {
  TileNodeReader,
  encodePointCloudGlb,
} from '@frillab/copc-tiles';

const source = await createCopcCoreNodeSource({
  input: '/data/autzen.copc.laz',
  backend: 'copc-js', // choose 'rust' explicitly to use Rust/WASM
  sourceIdentity: 'catalog:autzen-2026-10', // opaque; do not use a signed URL
  contextOptions: { heightOffsetMeters: 0 },
});

try {
  const reader = new TileNodeReader(source, {
    maxRequestedNodes: 8,
    maxPointsPerNode: 100_000,
  });
  const views = await reader.readNodes(['4-11-2-0'], {
    attributes: { rgb: true, intensity: true },
  });
  const view = views.get('4-11-2-0');
  if (!view) throw new Error('The source did not return the requested node.');

  const content = encodePointCloudGlb(view);
  if (!content) throw new Error('The selected node has no points.');
  console.log(view.context.sourceGeneration, view.context.transformPlan?.identity.key);
  console.log(view.context.availableFields, content.bytes);
} finally {
  source.close();
}
```

The connector preserves the Adapter source and transform generations, its
immutable transform plan, actual field availability, and zero-copy ECEF
Float64 buffers. Missing standard fields and Extra Dimensions are omitted and
reported in the node context; Tiles does not create zero-filled attributes.
Named Extra Bytes must be configured at source open and requested by exact
case-sensitive name. Adapter's `copc-js` supports exact values where the LAS
descriptor allows them; Rust/WASM explicitly rejects Extra Bytes requests.

`view.context.decodedPointEcefBounds` is the bound for that decoded node's
transformed point content and is labeled
`decodedPointEcefBoundsKind: 'decoded-point-content'`. It can bound the loaded
content. It is not a conservative bound for an undecoded hierarchy cell or
undiscovered descendants. Adapter source-cell bounds remain in COPC source
coordinates. Tiles does not transform cell corners and claim they bound an
arbitrary nonlinear CRS or vertical-grid operation.

The missing public conservative source-cell-to-ECEF bounds contract blocks
production on-demand tileset generation for Autzen. The one-node examples and
render checks below are bounded content checks; they do not implement live
multi-node request scheduling or camera-driven COPC refinement. See the
[proposed Adapter #383 follow-up](./adapter-383-bounds-followup.md).

`TileNodeReader` resolves only requested node keys and has bounded hierarchy
pages, ranges, decoded points, concurrency, and cancellation. It does not
materialize the full octree or run Adapter's Direct `NodeSelector`. A complete
production LOD tileset still needs a conservative policy for cells whose
points have not yet been decoded.

## Adapter compatibility

Adapter PR #391 is merged at
`c5b563b3d0c5743b8030a79eca8c820421c9d4a7`. Tiles built and installed a packed
candidate from that source commit and tested its `/core` ESM and declarations.
The candidate's package metadata still says `0.6.0`; the published npm
`0.6.0` tarball predates `/core`. Tiles therefore declares the optional peer
range `>=0.6.1 <1.0.0`; no npm release in that range has been verified yet.
See the [versioned API matrix](./adapter-api-compatibility.md) for its tarball
hash, declaration-resolution limitation, backend results, and
[Adapter issue #383](https://github.com/mors119/copc-adapter/issues/383)
follow-up.

## Real-source browser checks

The Autzen and SoFi Chromium tests run with both `copc-js` and Rust/WASM and
use bounded HTTP Range requests. They encode real nodes, run Khronos and
CesiumGS validators, and render the same primary GLB bytes in Cesium and Three.
SoFi reads and encodes three real hierarchy nodes across levels 2–4, but renders
only the primary node. Both backends use Adapter's `head-fallback` Range
validation because the browser origin does not expose `Content-Range`.

```sh
COPC_TILES_AUTZEN=/path/to/autzen-classified.copc.laz \
  npm run validate:adapter-integration

COPC_TILES_SECOND_COPC_URL=https://hobu-lidar.s3.amazonaws.com/sofi.copc.laz \
  npx playwright test --config test/browser/playwright.config.mjs \
  test/browser/second-source.real.spec.mjs
```

These checks do not prove full-cloud coverage, multi-node conservative ECEF
bounds, production LOD, or vertical-datum correctness. File/Blob input, real
named Extra Bytes, and full source switching under camera
churn remain unverified. See the [implementation status](./implementation-status.md)
and [benchmark report](./benchmark-report-2026-10-29.md).
