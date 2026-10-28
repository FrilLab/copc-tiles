# COPC Tiles

**COPC → standard 3D Tiles 1.1** as a standalone, optional companion to [COPC Adapter](https://github.com/mors119/copc-adapter).

> **Status: planned / under development.** No production-ready encoder, tileset server, Cesium/Three integration, or published npm package is claimed by this README.

## Why separate?

COPC Adapter streams COPC points directly with CesiumJS and Three.js. COPC Tiles is an independent integration path for clients that require **standards-compliant 3D Tiles**. Projects using only the direct adapter must not pay a Tiles runtime, dependency, or install-size cost.

- Planned package: `@frillab/copc-tiles` (not yet published).
- Adapter package: `@frillab/copc-adapter` ([upstream repository](https://github.com/mors119/copc-adapter)).
- Dependency direction: **copc-tiles → copc-adapter**, never the reverse.
- Reuse approved, stable, *public* adapter APIs for COPC hierarchy/Range/decode/CRS and read-only point data. Do not import upstream private `packages/core/**` files.
- Where required public APIs do not exist, define the narrowest viable contract and propose a separate, reviewed upstream PR. Never duplicate the entire COPC decoder or silently use private exports.
- Keep direct `/cesium`, `/three`, source/cache defaults, behavior, and consumers unaffected.

## Scope

**In scope:** selected COPC nodes → valid glTF 2.0 `POINTS` GLB → 3D Tiles 1.1 tileset and implicit octree/subtrees → bounded on-demand resource serving → independent Cesium and Three.js rendering → conformance, precision, performance, and release verification.

**Out of scope:** replacing Direct COPC, running Direct NodeSelector as the Tiles LOD scheduler, mesh reconstruction, terrain snapping, bundled authoritative geoid grids, nonstandard Cesium-only Tiles formats, and silent attribute/precision loss.

## Architecture

```text
COPC source (HTTP Range / File)
           |
@frillab/copc-adapter (verified public read-only integration contract)
           |
@frillab/copc-tiles (optional independent package)
    |  TilePointView / node access (A / experimental E)
    |  ECEF-to-tile-local precision mapping
    |  glTF POINTS GLB + LAS metadata
    |  tileset.json / implicit octree / subtrees
    |  cancellation-aware TileResourceProvider
    +---- standard Cesium3DTileset
    +---- standards-compatible Three.js Tiles renderer
```

Keep transform/height provenance, node identity, precise `Float64` ECEF input, and original attributes. Do not force E cache reconstruction to full Source/Geographic arrays or redundant inverse ECEF transforms. The upstream adapter owns CRS and vertical conversion semantics.

## Roadmap — T1 through T12

The goal is to implement and independently verify all twelve issues. These are **not yet completed**.

| Step | Issue | Deliverable | Dependencies |
| --- | --- | --- | --- |
| T1 | [#1](https://github.com/FrilLab/copc-tiles/issues/1) | Tile input/attribute contract; A/E read-only views | — |
| T2 | [#2](https://github.com/FrilLab/copc-tiles/issues/2) | Node-key hierarchy/point decoding, independent of Direct NodeSelector | T1 |
| T3 | [#3](https://github.com/FrilLab/copc-tiles/issues/3) | Precision-safe ECEF tile-local coordinates | T1 |
| T4 | [#4](https://github.com/FrilLab/copc-tiles/issues/4) | Standards-valid glTF POINTS / GLB encoder | T1, T3 |
| T5 | [#5](https://github.com/FrilLab/copc-tiles/issues/5) | Tileset bounds and geometric error | T1, T2 |
| T6 | [#6](https://github.com/FrilLab/copc-tiles/issues/6) | Implicit octree and subtree availability | T5 |
| T7 | [#7](https://github.com/FrilLab/copc-tiles/issues/7) | LAS attribute → glTF metadata mapping | T1, T4 |
| T8 | [#8](https://github.com/FrilLab/copc-tiles/issues/8) | Bounded resource serving, cancellation and cache | T2, T4–T6 |
| T9 | [#9](https://github.com/FrilLab/copc-tiles/issues/9) | Real Cesium 3D Tiles browser comparison | T8, applicable T11 gates |
| T10 | [#10](https://github.com/FrilLab/copc-tiles/issues/10) | Identical content in Three.js | T8, T9 |
| T11 | [#11](https://github.com/FrilLab/copc-tiles/issues/11) | Tiles/glTF validator, precision and malformed-input gates | Applicable T3–T10; run incrementally |
| T12 | [#12](https://github.com/FrilLab/copc-tiles/issues/12) | A/E and Direct/Tiles performance, bundle isolation, release readiness | T9–T11 |

**Parallel development:** T2 and T3 may proceed after T1; T4 and T5 can progress on separate modules; T7 can follow T4 while T6 progresses; T11 validators should be introduced as soon as their fixtures exist. Avoid concurrent edits to common contracts until reviewed.

## Compatibility and release gates

1. Pin a verified compatible adapter version/range; validate against actual packed consumers, not arbitrary local private source aliases.
2. Maintain explicit compatibility and feature matrices for A/default vs experimental E, copc-js vs Rust/WASM, HTTP vs local File, Cesium vs Three.
3. Validate position/height precision (including datums, offsets, polar/dateline cases), attribute preservation, cancellation, source identity, malformed inputs and memory bounds.
4. Run real standard Cesium and Three.js rendering and official glTF / 3D Tiles validators before claiming compatibility.
5. Measure clean Direct COPC bundle and **npm install** footprint without Tiles; tree shaking is not sufficient proof of install-size isolation.
6. Do not publish, deploy or claim full T12 completion before maintainer review and required passing gates.

## Development policy

See [AGENTS.md](AGENTS.md). Work on one issue / independent PR at a time, document actual validations, and stop at **AWAITING MAINTAINER REVIEW**. Keep GitHub issues/PRs in English. README is in Korean for project tracking and contributor guidance.

## Original planning history

The requirements were migrated from [mors119/copc-adapter#332–#343](https://github.com/mors119/copc-adapter/issues/332). The old issue discussions remain as historic references; new Tiles work is tracked here.
