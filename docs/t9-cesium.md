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
not a hardware GPU benchmark or real COPC hierarchy test. The current run measured
615.8 ms to load the initial fixture tiles and 297.7 ms for the two frames
after load at 640×480. Browser startup, cold fixture requests and SwiftShader
are included; this timing is not a stable performance baseline.

## Real Adapter boundary

The public Adapter 0.6.0 check opens the Autzen COPC, reads node `5-8-6-0`
(6,529 points) through six bounded HTTP ranges (205,026 bytes), prepares its A
view, and encodes a 151,650-byte GLB. The test validates that GLB and a
test-only one-node tileset, then uploads those bytes to the test resource
server. Public `Cesium3DTileset.fromUrl` fetched both `tileset.json` and the
GLB. With normal frustum culling and `maximumScreenSpaceError: 1`, Cesium
selected and rendered the 6,529 points and kept them visible after a camera
move. The test checks the transformed tile-bound center against the encoder
origin within 0.01 m and checks the decoded center lies in the broad Autzen
stadium area (longitude -123.09 to -123.05, latitude 44.04 to 44.08).
In the recorded 640×480 SwiftShader run, the center was -123.070412°,
44.052407°; tile-bound center error was under 0.01 m, with 10,038 initial and
9,777 post-move non-background pixels. Loading, selection and rendering took
1,127.5 ms in this local browser run. The lat/lon check is a broad area sanity
check, not an independent CRS or survey reference validation.

The original test wrapper was culled because it declared `geometricError: 0`;
Cesium treated the root as already meeting its screen-space target and issued
no content request. The wrapper now uses the measured local-bounds
half-diagonal (52.29 m for this node) as its root error, uses the encoder's
origin/transform, and pads its local bounds by measured Float32 error. This is
a meaningful one-node test wrapper, not a production COPC hierarchy. The test
pre-generates the single node before Cesium starts. It does not establish
on-demand node acquisition, multi-level hierarchy, COPC cell bounds or LOD.
Those remain blocked by the public Adapter contract tracked in [issue #383](https://github.com/mors119/copc-adapter/issues/383).
Adapter [PR #391](https://github.com/mors119/copc-adapter/pull/391) is open and
unpublished and cannot be used as compatibility evidence.

## Acceptance boundary

Fixture and real one-node Autzen rendering pass in headless Chromium with
SwiftShader. Multi-level COPC LOD, zoom-driven real node selection, comparison
against Direct rendering, representative GPU performance, and source switching
during a renderer request remain unverified. T9 therefore remains partial.
