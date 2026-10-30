# COPC Tiles implementation status

Last assessed: 2026-10-30. This worktree started at Tiles merge commit
`dba0d8db091f23bdb811d0c8d3b6a18f7a59bfc0` (PR #14) and contains the
uncommitted Adapter Core integration described below. The prior issue-by-issue
release audit remains in [`release-audit-2026-10-29.md`](release-audit-2026-10-29.md).

## Current result

**CONDITIONAL review candidate.** The compatibility bridge now uses
`createCopcContext()` and the public `CopcNodeSource` methods from
`@frillab/copc-adapter/core`. Adapter was built and packed at source commit
`c5b563b3d0c5743b8030a79eca8c820421c9d4a7`; the tarball installed and passed
Node ESM resolution, strict Bundler-mode declarations, and real browser
integration. Published Adapter `0.6.0` does not contain `/core`; its immutable
package version string is shared by the source-built candidate, so the
tarball hash and commit are part of the compatibility record.

Real Autzen node reads passed with both `copc-js` and Rust/WASM. The same
standard GLB was validated and rendered in Cesium and Three. SoFi passed with
`copc-js` and three requested nodes at levels 2–4. These are one-node renderer
wrappers, not production multi-node LOD or complete-cloud coverage.

The requested real on-demand multi-node pipeline is **blocked at its bounds
gate**. Adapter's public cell bounds are in source CRS; its ECEF bounds cover
only decoded point content. Autzen uses EPSG:2992 horizontal coordinates and
EPSG:6360 vertical coordinates, so Tiles cannot prove a conservative ECEF
bound for unread cells from the public API. Tiles does not emit a real
multi-node tileset or substitute corner samples. The exact missing contract
and proposed read-only Adapter API are documented in
[`adapter-383-bounds-followup.md`](./adapter-383-bounds-followup.md).

The current public API still does not provide a conservative ECEF bound for
an undecoded hierarchy cell under arbitrary nonlinear CRS/vertical transforms.
Adapter's `ecefBounds` encloses decoded node points only; Tiles carries that
label and uses it only for loaded point content. Do not infer transformed cell
bounds from corners or decoded points. See the
[versioned compatibility matrix](./adapter-api-compatibility.md) and
[T2 node access](./t2-node-access.md).

## T1–T12 status

Every issue remains open. A milestone is complete only when all acceptance
criteria have the required real-source, backend, renderer, and validator
evidence.

| Issue | Status | Current evidence | Remaining acceptance |
| --- | --- | --- | --- |
| [T1 #1](https://github.com/FrilLab/copc-tiles/issues/1) Input contract | Partial | A fixture aliases; real Adapter A data preserves ECEF Float64 and actual fields on Autzen/SoFi. | No public E cache view; real named Extra Bytes not exercised; no Rust Extra Bytes support. |
| [T2 #2](https://github.com/FrilLab/copc-tiles/issues/2) Node reads | Partial | Public Core hierarchy pages and `loadPreparedNodeData()`; bounded reads, three SoFi nodes on both backends, Autzen on both backends. | No Core-backed tile resource provider or lazy subtree route; no full octree point decode; File/Blob and renderer-driven cancellation remain untested. |
| [T3 #3](https://github.com/FrilLab/copc-tiles/issues/3) Precision | Partial | Real encoder max error: Autzen ~1.96 µm, SoFi ~4.17 µm; ECEF remains Adapter Float64. | No multi-node parent/child placement test; Autzen vertical datum remains unverified; no complete-cloud seam or independent CRS verification. |
| [T4 #4](https://github.com/FrilLab/copc-tiles/issues/4) GLB | Partial | Deterministic fixtures and real Autzen/SoFi GLBs pass Khronos validator with zero errors/warnings. | Allocation profiling and all requested LAS field representations are incomplete. |
| [T5 #5](https://github.com/FrilLab/copc-tiles/issues/5) Bounds / geometric error | Partial; blocks real integration | Decoded-point ECEF bounds are validated for loaded content only. | Core lacks a conservative transformed ECEF bound for an undecoded source cell; no corner-sampling fallback is safe for Autzen EPSG:2992. See #383 proposal. |
| [T6 #6](https://github.com/FrilLab/copc-tiles/issues/6) Implicit tiling | Partial | Sparse/empty fixture subtree validation passes. | Real subtree generation waits on safe cell bounds and a lazy hierarchy-to-availability route; no real COPC implicit tileset. |
| [T7 #7](https://github.com/FrilLab/copc-tiles/issues/7) Metadata | Partial | Actual available Autzen RGB/intensity/classification and SoFi intensity/classification preserved; absent SoFi RGB omitted. | No real Extra Bytes, GPS Time/return-field matrix, or 64-bit interoperability across renderers. |
| [T8 #8](https://github.com/FrilLab/copc-tiles/issues/8) Resource serving | Partial | Route safety, LRU, cancellation, concurrency, generation and source-switch fixture tests; both renderers fetch identical GLB bytes. | No Core-backed on-demand provider, live subtree generation, or cancellation/source replacement through a real COPC renderer request. |
| [T9 #9](https://github.com/FrilLab/copc-tiles/issues/9) Cesium | Partial | Real Autzen one-node wrappers with both Adapter backends and SoFi one-node wrappers with both backends rendered after camera movement. | No multi-node tileset, zoom-driven COPC refinement, parent-child coverage, live cancellation/source switch, or Direct comparison. |
| [T10 #10](https://github.com/FrilLab/copc-tiles/issues/10) Three | Partial | Same one-node GLB bytes as Cesium for Autzen and SoFi on both backends; point/metadata visibility and tile cleanup passed. | No multi-level Tiles LOD, live provider, cancellation/source replacement during real reads, or full consumer/version matrix. |
| [T11 #11](https://github.com/FrilLab/copc-tiles/issues/11) Standards/security | Partial | `npm test`: 66 passed; real glTF and Tiles validators pass; packed candidate ESM and Bundler declarations pass. | Candidate strict NodeNext declarations fail TS2834; malformed real Range responses, File/Blob, vertical-grid, and real Extra Bytes remain untested. |
| [T12 #12](https://github.com/FrilLab/copc-tiles/issues/12) Performance/package | Partial | Real node preparation/GLB/renderer timings and retained point-view buffer bytes are recorded separately from previous A/E synthetic results. | No production multi-node LOD timings, peak temporary or total retained browser memory, Direct/on-demand/pre-generated comparison, real E path, or release provenance workflow. |

## Verification summary

- Adapter source `c5b563b3d0c5743b8030a79eca8c820421c9d4a7`: `npm ci`, library
  build, and `npm pack` passed. Candidate tarball SHA-256:
  `89b16b209496ff848c22405c99962bb167746aacbcac2415840dc6133f110838`.
- Clean consumer: public `/core` Node ESM import passed. Strict TypeScript 5.9.3
  with `moduleResolution: Bundler` and `skipLibCheck: false` passed. Strict
  `NodeNext` fails TS2834 in Adapter's packed `dist/core.d.ts` extensionless
  imports. Vite browser consumer and real browser tests resolved the packed
  `/core` module.
- Tiles: `npm run typecheck`, `npm run typecheck:adapter-core`, and
  `npm run build` passed with the packed candidate installed.
- Tiles: `npm test` passed all 66 tests. This machine's normal `npm ci` failed
  to build development-only `better-sqlite3@11.10.0` on Node `26.12.1`. The
  dependency install used `npm ci --ignore-scripts`; rebuilding Sharp with
  `SHARP_IGNORE_GLOBAL_LIBVIPS=1` enabled the validator tests.
- Autzen: both backend browser tests passed. The source was 81,123,042 bytes,
  SHA-256 `db2d56cdfa058bffccdc5d6019dae2fc9c6a551df10a5523c06c76a3e25a27fa`;
  it remained under `/private/tmp`. `copc-js` read 164,880 COPC range bytes;
  Rust/WASM read 101,455 COPC range bytes, excluding worker/WASM asset reads.
  Khronos and CesiumGS validator results were zero errors/warnings.
- SoFi: both `copc-js` and Rust/WASM browser tests passed for three nodes at
  levels 2–4. The source object is 2,029,696,615 bytes; ranged reads were
  422,669 bytes / 8 GETs for `copc-js` and 359,053 bytes / 9 GETs for Rust,
  including test-harness repeats. Browser CORS did not expose `Content-Range`,
  so both tests used Adapter `head-fallback` validation.
- CesiumJS `1.146.0`, Three.js `0.186.1`, `3d-tiles-renderer` `0.5.3`, and
  Chromium were tested points, not declared broad compatibility ranges.
  Firefox and WebKit are unverified.

## Package and release readiness

- Candidate package: `@frillab/copc-tiles@0.1.0`, ESM, Node `>=18`, no required
  runtime dependency. Adapter remains an optional peer with range
  `>=0.6.1 <1.0.0`; no npm Adapter release in that range has been checked.
- The separate public connector is
  `@frillab/copc-tiles/adapter/copc-core`. The engine root does not export or
  statically load Adapter. This source candidate passed separate Adapter-only,
  Tiles-only and combined packed consumer checks; repeat them against the
  released Adapter version and representative application renderer bundles.
- No Tiles package was published and no GitHub Release was created. Do not
  merge, publish, release, or close issues until maintainer review.
- See [`release-checklist.md`](./release-checklist.md),
  [`benchmark-report-2026-10-29.md`](./benchmark-report-2026-10-29.md), and
  [`adapter-migration-assessment.md`](./adapter-migration-assessment.md).

**AWAITING MAINTAINER REVIEW**
