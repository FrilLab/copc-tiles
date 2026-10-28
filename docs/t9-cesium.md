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
not a hardware GPU benchmark or real COPC hierarchy test.

## Real Adapter boundary

The optional Adapter integration check opens the public Autzen COPC through
`@frillab/copc-adapter@0.6.0`, reads one bounded node, encodes a GLB, and
validates the GLB and a test-only one-node tileset with the official validators.
It does not claim Cesium rendered the real node: the one-node wrapper was
culled by Cesium in an exploratory browser run. A production real-data
tileset still needs public conservative node bounds and hierarchy coverage,
tracked in [Adapter #383](https://github.com/mors119/copc-adapter/issues/383).

## Acceptance boundary

Fixture browser coverage is passing. Real Adapter-backed Cesium rendering,
multi-level COPC LOD, representative GPU performance, and source switching
during a renderer request remain unverified. T9 therefore remains partial.
