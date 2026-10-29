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
benchmark. The latest default suite measured 103.3 ms until both models loaded
and 27.8 ms for the two frames after load at 640×480. This Three run followed Cesium in the
same browser server and reused its fixture resource cache, so the values are
not directly comparable with the Cesium cold-load time.

## Real Adapter boundary

The same pre-generated one-node Autzen GLB used by Cesium is consumed through
the public `3d-tiles-renderer` Three.js path. Three loaded and rendered 5,122
points before and after a camera move, exposed encoded RGB and the
`intensity`/`classification` structural metadata properties, and disposed the
active tile. Its first point's world position was compared with Adapter's ECEF
Float64 result; the error was 0.0000014947356675 m, and encoder maximum local
error was 0.0000019626224569 m. This is one pre-generated resource, not an
on-demand or multi-node COPC tileset. At 640×480 the SwiftShader run produced
4,640 initial and 4,606 post-move non-background pixels. Across two runs,
load/selection/render was median 218.8 ms and nearest-rank p95 270.4 ms. These
measurements include browser startup and local resource handling; they are not
a hardware or Direct-rendering comparison.

Public conservative ECEF node-cell bounds and hierarchy completeness are not
available in Adapter 0.6.0; see [Adapter #383](https://github.com/mors119/copc-adapter/issues/383).
Adapter [PR #391](https://github.com/mors119/copc-adapter/pull/391) is merged
in upstream source but unpublished, and does not provide conservative
transformed bounds for undecoded descendant cells.

## Acceptance boundary

Fixture and real one-node Autzen rendering pass in headless Chromium with
SwiftShader. Multi-level COPC hierarchy, zoom-driven refinement, source
cancellation/cleanup during requests, representative GPU performance, and
cross-renderer visual coverage comparison remain unverified. T10 therefore
remains partial.
