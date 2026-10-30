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

## Real Adapter Core candidate

The real-source test uses the packed Adapter `/core` candidate built from
`c5b563b3d0c5743b8030a79eca8c820421c9d4a7`. The same pre-generated one-node
Autzen GLB used by Cesium is consumed through the public `3d-tiles-renderer`
Three.js path. The Chromium integration passed with both `copc-js` and
Rust/WASM. Three loaded and rendered 5,122 points before and after a camera
move, exposed encoded RGB and the `intensity`/`classification` structural
metadata properties, and disposed the active tile. First-point world error
was about 1.5 µm; exact backend precision results are in the [packed API
matrix](./adapter-api-compatibility.md). This is one pre-generated resource,
not an on-demand or multi-node COPC tileset. At 640×480 the SwiftShader
`copc-js` run produced 4,640 initial and 4,606 post-move non-background
pixels. In the latest revalidation run, Three load/render measured 232.4 ms with
`copc-js` and 202.9 ms with Rust/WASM. This is a single browser observation,
not a stable latency distribution. The measurements include browser startup
and local resource handling; they are not a hardware or Direct-rendering
comparison.

Adapter's ECEF point bound describes decoded points, not conservative bounds
for undecoded cells. Keep [Adapter #383](https://github.com/mors119/copc-adapter/issues/383)
open for a released public API and a potential transformed-cell-bound contract.

## Acceptance boundary

Fixture and real one-node Autzen rendering pass in headless Chromium with
SwiftShader. Multi-level COPC hierarchy, zoom-driven refinement, source
cancellation/cleanup during renderer requests, representative GPU performance,
and cross-renderer visual coverage comparison remain unverified. The
candidate's strict NodeNext declarations also fail TS2834. T10 therefore
remains partial.
