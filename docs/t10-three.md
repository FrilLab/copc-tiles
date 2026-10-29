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
benchmark. One run measured 74.8 ms until both models loaded and 19.5 ms for
the two frames after load at 640×480. This Three run followed Cesium in the
same browser server and reused its fixture resource cache, so the values are
not directly comparable with the Cesium cold-load time.

## Real Adapter boundary

The current real Autzen check validates one Adapter-backed node's GLB and a
test-only one-node 3D Tiles wrapper. It does not claim that Three rendered
real COPC content or that the wrapper represents the COPC hierarchy. Public
conservative ECEF node bounds and hierarchy completeness are not available in
Adapter 0.6.0; see [Adapter #383](https://github.com/mors119/copc-adapter/issues/383).

## Acceptance boundary

Fixture browser coverage is passing. Real Adapter-backed Three rendering,
multi-level COPC LOD, representative GPU performance, and source switching
during renderer requests remain unverified. T10 therefore remains partial.
