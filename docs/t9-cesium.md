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

## Real Adapter boundary

The public Adapter 0.6.0 check opens the Autzen COPC, reads node `4-11-2-0`
(5,122 points) through six bounded HTTP ranges (164,880 bytes), prepares its A
view, and encodes a 119,292-byte GLB. The test validates that GLB and a
test-only one-node tileset, then uploads those bytes to the test resource
server. Public `Cesium3DTileset.fromUrl` fetched both `tileset.json` and the
GLB. With normal frustum culling and `maximumScreenSpaceError: 1`, Cesium
selected and rendered all 5,122 points and kept them visible after a camera
move. The transformed bound center matches the encoder origin (0 m error),
and the first rendered point matches Adapter-prepared ECEF within
0.0000014947356675 m. The camera location was -123.062693°, 44.051994°; the
640×480 SwiftShader run counted 9,812 initial and 9,497 post-move
non-background pixels. Across two runs, load/selection/render was median
1,478.3 ms and nearest-rank p95 1,833.4 ms. The geographic position remains a
broad area check, not an independent CRS or survey-reference validation.

The original test wrapper was culled because it declared `geometricError: 0`;
Cesium treated the root as already meeting its screen-space target and issued
no content request. The wrapper now uses the measured decoded-node bounds and
a non-zero root error, and uses the encoder's origin/transform. This is a
meaningful one-node test wrapper, not a production COPC hierarchy. The test
pre-generates the single node before Cesium starts. It does not establish
on-demand node acquisition, multi-level hierarchy, COPC cell bounds or LOD.
Those remain blocked by the public Adapter contract tracked in [issue #383](https://github.com/mors119/copc-adapter/issues/383).
Adapter [PR #391](https://github.com/mors119/copc-adapter/pull/391) is merged
in upstream source but unpublished, so it cannot be used as packed-consumer
compatibility evidence.

## Acceptance boundary

Fixture and real one-node Autzen rendering pass in headless Chromium with
SwiftShader. Multi-level COPC LOD, zoom-driven real node selection, comparison
against Direct rendering, representative GPU performance, and source switching
during a renderer request remain unverified. T9 therefore remains partial.
