# COPC Tiles implementation status

Assessment date: 2026-10-30. This is the Adapter 0.7.1 integration and
conservative-bounds validation milestone. The package remains unpublished and
all T1–T12 issues remain open.

## Current result

**CONDITIONAL review candidate.** COPC Tiles now pins the actual published
`@frillab/copc-adapter@0.7.1` package in both its development and optional peer
dependencies. The package was fetched from npm, its integrity and exports
were recorded, and its packed declarations/runtime were installed in clean
consumer fixtures. Strict NodeNext declaration resolution passes.

The public `/core` connector exposes Adapter's metadata-only conservative ECEF
source-cell bounds result while keeping source-space cell bounds and decoded
point-content ECEF bounds distinct. Supported WGS84 geographic fixtures and
unsupported vertical/projected fixtures were exercised with `copc-js` and
Rust/WASM. Autzen EPSG:2992 and projected EPSG:32611 fail closed with
`unsupported-horizontal-crs`; no fallback bound is emitted. This enables a
supported geographic bounds path, but it does not provide safe projected
multi-node bounds or a complete live COPC-to-Tiles LOD pipeline.

## Published Adapter package and API

- Version: `0.7.1`, exact development and optional peer dependency.
- Registry tarball: 646,494 packed bytes, 2,289,736 unpacked bytes, 127 files.
- `dist.integrity`: `sha512-apm67tKwhOr41elWw845NaYJrMsz74oXWtD7ZEMntLkUaFhos0uM/EMsVBNOEwXg77JjN363hQi70hTOLD7yJQ==`.
- Public exports: `.`, `./core`, `./cesium`, `./three`.
- Runtime metadata: no `engines.node` field; optional peers are Cesium `>=1.142.0` and Three `>=0.170.0`.
- The published `/core` declaration contains the NodeNext-safe `.js` declaration specifiers and publicly exports `CopcConservativeNodeSource` and `CopcConservativeBoundsResult`.
- `getConservativeNodeEcefBounds(nodeKey)` is synchronous and metadata-only. Its supported result certifies full source-cell plus descendant-cell coverage in WGS84 ECEF metres and says encoder reconstruction padding is required. Unsupported results retain reason and transform/source provenance and have no `boundsEcef`.

See [`adapter-api-compatibility.md`](./adapter-api-compatibility.md) for the
full contract inventory, result fields, exact unsupported codes, npm record,
and per-CRS evidence.

## Real COPC and bounds evidence

### Autzen

The local source remained in `/private/tmp` and was not added to the repository.
Its size is 81,123,042 bytes and SHA-256 is
`db2d56cdfa058bffccdc5d6019dae2fc9c6a551df10a5523c06c76a3e25a27fa`.

Both Adapter backends read actual hierarchy metadata and decoded requested
node `4-11-2-0` with 5,122 points. `copc-js` made 6 Range requests totaling
164,880 bytes; Rust/WASM made 7 totaling 101,455 bytes. Both prepared
Float64 ECEF points and actual intensity, classification, and RGB; both
produced the same 119,292-byte GLB. Khronos and CesiumGS validators reported
zero errors and warnings. Maximum encoder reconstruction error was about
1.96 micrometres.

The same single-node wrapper rendered 5,122 visible points in Cesium and
Three with both backends, including camera movement. Conservative bounds
evaluation issued zero source requests and returned
`unsupported-horizontal-crs`, preserving Autzen's EPSG:2992 source-cell
context. This is a one-node content/render check, not a multi-node tileset or
Tiles LOD demonstration.

### Geographic and projected fixtures

Generated COPC fixtures were created outside the repository with PDAL 2.10.2.
The browser matrix passed on both backends:

| Fixture | Result | Points checked | Bounds evaluation Range reads |
| --- | --- | ---: | ---: |
| EPSG:4326, explicit ellipsoidal height | Supported analytic interval; all decoded points contained | 11 | 0 |
| EPSG:4979, ellipsoidal height | Supported analytic interval; all decoded points contained | 11 | 0 |
| EPSG:4326, unknown vertical reference | Unsupported: `unsupported-vertical-reference`; no ECEF bound | 11 | 0 |
| EPSG:32611 projected source | Unsupported: `unsupported-horizontal-crs`; no ECEF bound | 19,298 | 0 |

The 4326 ellipsoidal fixture used a 123.5 m manual height offset; the published
bound returned the same offset and contained all prepared points on both
backends. The 4979 LAS transform plan reports WGS84 horizontal EPSG:4326 plus
ellipsoidal height. Unit contract fixtures additionally cover validated-grid
provenance, parent/descendant bound containment, and the distinction between
source, conservative ECEF cell, and decoded-point bounds. A real validated-grid
COPC source and grid no-data/coverage behavior remain unverified.

### SoFi

No local SoFi binary or configured `COPC_TILES_SOFI_URL` /
`COPC_TILES_SECOND_COPC_URL` was available. The two optional real-source
browser cases were skipped. A generated EPSG:32611 fixture exercises the
published API's projected-CRS rejection with both backends, and unit contract
fixtures preserve the expected SoFi reason code. This is not real SoFi
hierarchy, point-count, GLB, or renderer evidence.

## NodeNext, package isolation, and install environment

- The permanent packed consumer installs the actual Registry Adapter 0.7.1
  and the packed Tiles tarball. TypeScript 5.9.3 passes strict NodeNext and
  Bundler checks with `skipLibCheck: false` for root and all three Adapter
  subpaths; type-only imports include Renderer and Core types. Runtime ESM
  imports cover root, `/core`, `/cesium`, `/three`, and the Tiles connector.
- A second packed consumer imports Adapter Core plus Tiles without Cesium or
  Three installed. An engine-only consumer imports Tiles without Adapter,
  Cesium, or Three installed.
- Clean `npm ci` and typecheck/build/unit validation passed on Node 18.20.8
  and Node 22.23.4. The package runtime declares Node `>=18`.
- A normal clean development install on Node 26.12.1 fails compiling the
  development-only transitive `better-sqlite3@11.10.0` against Node 26's V8
  API. This does not enter the Tiles runtime dependency graph. Node 26 unit,
  browser, benchmark, and package checks ran after rebuilding Sharp with
  `SHARP_IGNORE_GLOBAL_LIBVIPS=1`; script permissions for the existing native
  development dependencies are pinned in `package.json`. No validation was
  run with `--ignore-scripts` as the only install path.
- The full runtime-scope audit reports zero vulnerabilities. A full dev
  dependency audit was not requested or used as release evidence.

## Validation results

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run typecheck:adapter-core` | Pass |
| `npm run build` | Pass |
| `npm test` | 77 passed, 0 failed, 0 skipped |
| `npm run validate:gltf` | 10 passed, including Khronos glTF validation |
| `npm run validate:tileset` | 5 passed, including CesiumGS 3D Tiles validation |
| `npm run validate:implicit` | 5 passed, including CesiumGS subtree validation |
| `npm run validate:resources` | 10 passed |
| `npm run test:browser` | 12 passed, 2 skipped (real SoFi unavailable); Chromium on macOS arm64 |
| `npm run validate:adapter-integration` | 2 passed (real Autzen, both backends) |
| `npm run bench:engine` | Pass; deterministic 100,000-point synthetic benchmark only |
| `npm audit --omit=dev` | Pass; 0 vulnerabilities |
| `npm pack --dry-run --json` | Pass; package details below |
| `npm run test:packed-consumer` | Pass; strict NodeNext/Bundler, root/subpaths, Core-only and engine-only consumers |

The engine benchmark ran on macOS arm64, Apple M2, 8 logical CPUs, Node
26.12.1. It measured A/E view construction and GLB encoding on synthetic
100,000-point data; it does not include real COPC fetch/decoding, peak
temporary memory, full browser retention, or multi-node LOD.

## Package impact and release assessment

The current Tiles `npm pack --dry-run` artifact contains the engine and
connector only: 44 files, about 83.4 kB packed and 312.5 kB unpacked. It
contains no bundled dependencies. `@frillab/copc-adapter` is an optional peer
and no renderer is a Tiles dependency. In clean packed consumers, installed
file bytes measured 313,241 for Tiles alone, 5,553,298 for Adapter plus Tiles
without renderers, and 194,177,374 for Adapter, Tiles, TypeScript, Cesium and
Three. These are this machine's package file sizes, not filesystem block
allocation.

Vite 7.3.7 production bundles from the packed consumers show the Tiles Engine
entry at 34.34 kB raw / 10.08 kB gzip and no Adapter, Cesium, or Three source
modules. The Adapter Core entry bundles 335.82 kB JavaScript / 104.99 kB gzip
plus WASM assets of 214.35 kB and 866.88 kB; its graph contains no Tiles or
renderer subpaths. Adapter `/cesium` and `/three` namespace consumer bundles
measured 1,317.96 kB / 363.58 kB gzip and 652.34 kB / 190.03 kB gzip; both
graphs contain no Tiles modules. Vite also emits the Adapter WASM/worker
assets for those Adapter entries. These representative bundles verify graph
isolation, not complete application size or a before/after Adapter Direct
bundle delta. This evidence does not choose between the independent package
and a future Adapter `/tiles` distribution.

The package version remains `0.1.0`; nothing was published or released. Do not
choose a distribution model or claim package-size savings until both models
have comparable packed installation, lockfile, bundle-graph, renderer, and
release-overhead evidence. No Adapter sources were changed.

## T1–T12 status

All GitHub issues remain open. Status below means current evidence only; no
issue is marked complete by the existence of Adapter 0.7.1's API.

| Issue | Status | Evidence in this milestone | Remaining acceptance |
| --- | --- | --- | --- |
| [T1 #1](https://github.com/FrilLab/copc-tiles/issues/1) Input contract | Implemented, partially verified | Public Core A data aliases ECEF/selected fields; exact source/transform generations; real Autzen actual attributes. | No public E-cache view; real named Extra Bytes and Rust support remain absent; full A/E ownership/performance matrix incomplete. |
| [T2 #2](https://github.com/FrilLab/copc-tiles/issues/2) Node reads | Implemented, partially verified | Lazy public hierarchy and requested Autzen node reads on both backends; bounded Range evidence. | Production hierarchy-to-resource route, damaged real Range cases, browser cancellation/source-switch under live reads, File/Blob matrix. |
| [T3 #3](https://github.com/FrilLab/copc-tiles/issues/3) Precision | Implemented, partially verified | Float64 ECEF point prep; real Autzen reconstruction error about 1.96 µm; encoder padding checked against decoded Float32 GLB values. | Multi-node seams/coverage, more CRS/reference fixtures, and full error budget remain. |
| [T4 #4](https://github.com/FrilLab/copc-tiles/issues/4) GLB | Implemented, partially verified | Khronos validation, deterministic POINTS/GLB, real Autzen content with zero validator errors/warnings. | Broader field representations, allocations and performance evidence remain. |
| [T5 #5](https://github.com/FrilLab/copc-tiles/issues/5) Bounds / geometric error | Geographic path implemented; projected bounds unsupported by Adapter 0.7.1; milestone partial | Public conservative result is preserved; geographic supported/unsupported cases and explicit encoder padding pass. Autzen and projected fixture reject safely. | No projected CRS bound for Autzen/SoFi, real validated-grid evidence, production parent/child coverage, geometric screen-error policy, complete multi-node generation. |
| [T6 #6](https://github.com/FrilLab/copc-tiles/issues/6) Implicit tiling | Fixture engine implemented; real COPC availability not implemented | Sparse fixture subtree and official validator pass. | Live COPC hierarchy availability, real source bounds, and generated multi-node/subtree requests. |
| [T7 #7](https://github.com/FrilLab/copc-tiles/issues/7) Metadata | Implemented, partially verified | Real Autzen RGB, intensity, classification and GLB content verified; synthetic metadata validator cases. | SoFi real attributes unavailable this run; real Extra Bytes, GPS/return fields, and cross-renderer 64-bit metadata remain. |
| [T8 #8](https://github.com/FrilLab/copc-tiles/issues/8) Resource serving | Fixture server implemented; live COPC provider not implemented | Fixture tests cover cancellation, cache bounds, source generation and security; renderers consume identical wrapper bytes. | Live Core-backed on-demand provider and cancellation/source replacement during real COPC camera requests. |
| [T9 #9](https://github.com/FrilLab/copc-tiles/issues/9) Cesium | Real one-node path verified; multi-node path partial | Real Autzen single-node wrapper shows 5,122 visible points and camera movement with both backends. | Projected bounds block multi-node LOD; no Direct comparison, live refinement, multi-node coverage, or camera-driven cancellation. |
| [T10 #10](https://github.com/FrilLab/copc-tiles/issues/10) Three | Real one-node path verified; multi-node path partial | Same real Autzen single-node GLB rendered with both backends; synthetic renderer test and disposal pass. | Multi-level real Tiles LOD, live provider/source switching, and full renderer/version matrix. |
| [T11 #11](https://github.com/FrilLab/copc-tiles/issues/11) Standards/security | Validators implemented; matrix partially verified | Khronos and CesiumGS validators; strict packed NodeNext and Bundler consumers; malformed fixture/resource tests. | Broader corrupt real data, vertical-grid no-data/coverage, File/Blob and Extra Bytes matrices. |
| [T12 #12](https://github.com/FrilLab/copc-tiles/issues/12) Performance/package | Partially implemented and verified | Synthetic A/E engine benchmark; packed install/runtime isolation; exact Adapter integrity. | Real multi-node comparisons, complete temporary/retained browser memory, Direct/on-demand/pre-generated comparisons, distribution-model overhead. |

Not implemented in this milestone: a production live multi-node COPC-to-Tiles
LOD/provider path, a projected-CRS bounds workaround, a Direct-versus-Tiles
comparison, and real SoFi browser/render integration. Projected bounds remain
unsupported by the current Adapter API and are not replaced with sampled,
decoded-point, or invented bounds.

## Release readiness and priorities

**Release readiness: CONDITIONAL.** Adapter 0.7.1 compatibility and NodeNext
are verified. The public conservative bounds path is exposed and fail-closed.
Only tested geographic cases are candidates for multi-node bounds; projected
Autzen and SoFi remain unsupported. This milestone is not complete COPC-to-3D
Tiles support and is not publication approval.

Next priorities:

1. Obtain a reviewed Adapter conservative bounds implementation and tests for
   projected CRS rather than adding a Tiles-side transform. Keep EPSG:2992 and
   EPSG:32611 blocked until Adapter certifies supported results.
2. Exercise validated vertical-grid identity, coverage, no-data, epoch and
   transform dependencies with a permitted real or versioned fixture.
3. Connect public hierarchy pages, conservative bounds, requested nodes, GLB
   content and subtrees into a bounded live multi-node request path.
4. Render that same live tileset in Cesium and Three, including refinement,
   camera movement, cancellation, source switching, cleanup, and identical
   content bytes.
5. Complete T1/T7 Extra Dimension and T12 A/E/cache/package evidence, then
   compare the separate package and optional Adapter `/tiles` distribution.

No issue was closed, no Adapter change was made, and no merge, release, or
publish occurred.

**AWAITING MAINTAINER REVIEW**
