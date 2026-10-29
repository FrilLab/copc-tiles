# T10 Three.js browser evidence

## Fixture integration

`npm run test:browser` sends the same standard fixture GLBs served by the T8
`TileResourceServer` to the NASA-AMMOS `3d-tiles-renderer` Three.js integration
and public `GLTFLoader`. The browser test verifies six points across root and
child content, normalized RGB values, indexed `EXT_structural_metadata`
intensity/classification values, ECEF placement within one centimetre,
non-background rendered pixels, cached resources, and tile/group disposal.

This uses the same 3D Tiles/glTF bytes as Cesium. No Three-specific tile format
or geometry encoding is introduced. The recorded run uses headless Chromium
and SwiftShader; it is renderer integration evidence, not a hardware GPU
benchmark. The current run measured 55.2 ms until both models loaded and 30.3 ms for
the two frames after load at 640×480. This Three run followed Cesium in the
same browser server and reused its fixture resource cache, so the values are
not directly comparable with the Cesium cold-load time.

## Real Adapter boundary

The same pre-generated one-node Autzen resources used by Cesium are consumed
through the public `3d-tiles-renderer` Three.js path. Three loaded and rendered
6,529 points before and after a camera move, exposed encoded RGB and the
`intensity`/`classification` structural metadata properties, and disposed the
active tile. Its first point's world position was compared with Adapter's ECEF
Float64 result; the measured error was 0.0000 m at four decimal places, and
encoder maximum local-coordinate error was also 0.0000 m for this node. This is
a single pre-generated resource, not an on-demand or multi-node COPC tileset.
At 640×480 in the recorded SwiftShader run, Three produced 5,257 initial and
5,164 post-move non-background pixels and loaded/rendered the node in 172.0 ms.
These measurements include browser startup and local resource handling; they
are not a hardware or Direct-rendering comparison.

Public conservative ECEF node-cell bounds and hierarchy completeness are not
available in Adapter 0.6.0; see [Adapter #383](https://github.com/mors119/copc-adapter/issues/383).
Adapter [PR #391](https://github.com/mors119/copc-adapter/pull/391) proposes
decoded-point bounds, but is not merged or published and does not provide
conservative bounds for undecoded descendant cells.

## Acceptance boundary

Fixture and real one-node Autzen rendering pass in headless Chromium with
SwiftShader. Multi-level COPC hierarchy, zoom-driven refinement, source
cancellation/cleanup during requests, representative GPU performance, and
cross-renderer visual coverage comparison remain unverified. T10 therefore
remains partial.
