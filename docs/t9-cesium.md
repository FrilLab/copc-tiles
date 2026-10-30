# T9 Cesium browser evidence

## Fixture integration

`npm run test:browser` loads the source-neutral fixture tileset in CesiumJS
through the public `Viewer` and `Cesium3DTileset.fromUrl` APIs. Cesium fetches
the `tileset.json` and both GLBs from the actual T8 `TileResourceServer` over
HTTP. The test verifies six loaded points, root and refined child content,
ECEF tile centers, red/green/blue rendered pixels, resource cache reuse, and
`Viewer.destroy()` cleanup.

The browser run uses headless Chromium with SwiftShader on the recorded
development environment. It is deterministic renderer integration evidence,
not a hardware GPU benchmark or real COPC hierarchy test. The latest default
suite measured 1,328.3 ms to load the initial fixture tiles and 525.3 ms for
the two frames after load at 640×480. Browser startup, cold fixture requests
and SwiftShader are included; this timing is not a stable performance baseline.

## Real Adapter Core candidate

The real-source test uses the packed Adapter `/core` candidate built from
`c5b563b3d0c5743b8030a79eca8c820421c9d4a7`. It opens the Autzen COPC, reads
node `4-11-2-0` (5,122 points), passes the returned A-shaped ECEF Float64
buffers through the Tiles connector, and encodes a 119,292-byte GLB. Both
`copc-js` and Rust/WASM passed the Chromium integration. The test validates the
GLB and a test-only one-node tileset, then uploads the bytes to the test
resource server. Public `Cesium3DTileset.fromUrl` fetched both `tileset.json`
and the GLB. With normal frustum culling and `maximumScreenSpaceError: 1`,
Cesium selected and rendered all 5,122 points and kept them visible after a
camera move. The transformed bound center matches the encoder origin (0 m
error); first rendered point error was about 1.5 µm. Exact per-backend ranges,
validator output and precision are in the [packed API matrix](./adapter-api-compatibility.md).
The camera location was -123.062693°, 44.051994°; the 640×480 SwiftShader
`copc-js` run counted 9,812 initial and 9,497 post-move non-background pixels.
In the latest revalidation run, Cesium load/render measured 1,405.0 ms with
`copc-js` and 1,343.4 ms with Rust/WASM. This is a single browser observation,
not a stable latency distribution. The geographic position remains a broad
area check, not an independent CRS or survey-reference validation.

The original test wrapper was culled because it declared `geometricError: 0`;
Cesium treated the root as already meeting its screen-space target and issued
no content request. The wrapper now uses the measured decoded-node bounds and
a non-zero root error, and uses the encoder's origin/transform. This is a
meaningful one-node test wrapper, not a production COPC hierarchy. The test
pre-generates the single node before Cesium starts. It does not establish
on-demand node acquisition, multi-level hierarchy, conservative bounds for
undecoded cells or production LOD. Adapter's returned ECEF bound is for
decoded-point content only. Keep Adapter [issue #383](https://github.com/mors119/copc-adapter/issues/383)
open for a released version and any reviewed transformed-cell-bound contract.

## Acceptance boundary

Fixture and real one-node Autzen rendering pass in headless Chromium with
SwiftShader. Multi-level COPC LOD, zoom-driven real node selection, comparison
against Direct rendering, representative GPU performance, and source switching
during a renderer request remain unverified. The candidate's strict NodeNext
declarations also fail TS2834. T9 therefore remains partial.
