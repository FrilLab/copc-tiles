# COPC Tiles implementation status

This is a running record for the T1–T12 campaign. A milestone is complete only
when its full acceptance criteria pass. Fixture evidence is not reported as
real COPC integration evidence. Commits are recorded after each implementation
unit.

## Milestone status

| Milestone | Status | Evidence / remaining work |
| --- | --- | --- |
| T1 — Input contract | Partial | Commit `d73f4cd`, with actual Adapter A attribute evidence in `acdfc6f`. Source-neutral `TilePointView`, A/E-compatible views, available-attribute selection, provenance, read-only ownership contract, and malformed length/ownership fixture checks exist. Public E cache view and named extra-dimension acquisition remain unavailable. |
| T2 — Node access | Partial | Commits `3bb7dfa` and `acdfc6f`. Bounded page traversal and requested-node reads pass fixtures. Public Adapter 0.6.0 `copcJsBackend` read actual Autzen node `5-8-6-0` (6,529 points) through six bounded HTTP Range requests (205,026 bytes); Rust backend, E cache, and in-flight hierarchy cancellation remain unavailable/unverified. |
| T3 — Precision | Partial | Commit `94b8938`. Float64 ECEF origin, Float32 glTF Y-up positions, one placement transform, precision budgets, and synthetic large-coordinate/pole/dateline/altitude fixtures pass. Actual Autzen node encoded with finite ECEF positions; no independent CRS or vertical reference validation. |
| T4 — GLB | Partial | Commit `d1a2621`; actual-node evidence in `acdfc6f`. Deterministic glTF 2.0 POINTS encoder with normalized Uint16 RGB. Khronos validator passes fixture outputs and actual Autzen node GLB with zero errors/warnings. |
| T5 — Tileset geometry | Partial | Commit `97f9fc9`. Bounded explicit hierarchy, conservative-bound containment, local boxes, placement and geometric-error policies pass fixture tests and the CesiumGS validator. Actual Adapter node bounds/provenance are insufficient for a production real hierarchy; a validator-only one-node wrapper was checked. |
| T6 — Implicit tiling | Partial | Commit `dc7bd9d`. Sparse OCTREE root, Morton indexing, subtree availability and binary subtrees pass fixture tests and the CesiumGS validator. Real COPC implicit cells remain blocked by missing public bounds/provenance and complete hierarchy evidence. |
| T7 — Metadata | Partial | Commit `d232f30`; actual-node evidence in `acdfc6f`. LAS intensity/classification and supported typed extras use `EXT_structural_metadata` indexed by `EXT_mesh_features`. Fixture validators pass; the real Autzen node preserves actual RGB/intensity/classification. Named extra dimensions remain unavailable in Adapter 0.6.0. |
| T8 — Resource serving | Partial | Commit `73eccee`; browser evidence in `acdfc6f`. Bounded Fetch handler, MIME, HEAD/GET, path checks, LRU, deduplication, subscriber cancellation, generation invalidation, queue limits and cleanup pass nine focused tests. Cesium and Three load fixture resources over HTTP; real COPC tile resource lifecycle has not been rendered end-to-end. |
| T9 — Cesium | Partial | Browser integration in `acdfc6f`; timing evidence in `9d8ae7b`. Public CesiumJS `Viewer` and `Cesium3DTileset.fromUrl` browser test loads, refines, positions, colors and destroys fixture tiles through the real T8 handler. Real Autzen tile rendering is not claimed: the test-only single-node wrapper was culled. See `docs/t9-cesium.md`. |
| T10 — Three.js | Partial | Browser integration in `acdfc6f`; timing evidence in `9d8ae7b`. Public `3d-tiles-renderer`, Three.js, `GLTFLoader`, `GLTFMeshFeaturesExtension` and `GLTFStructuralMetadataExtension` browser test consumes the same fixture tile bytes, checks points/colors/metadata/placement, renders, and disposes. Real Autzen rendering is not claimed. See `docs/t10-three.md`. |
| T11 — Standards/security | Partial | Validator/browser evidence in `acdfc6f`; security audit in `699efc1`. Khronos glTF and CesiumGS 3D Tiles validators pass fixture output and the one-node Autzen wrapper. Unit suites cover malformed binary lengths, attributes, ranges, hierarchy, unsafe numeric values, cancellation and configured work limits. Full attack-surface audit remains incomplete; five high npm advisories remain in development-only 3D Tiles validator/sharp dependencies. |
| T12 — Performance/package | Partial | Package build/exports in `acdfc6f`; benchmark and readiness evidence in `699efc1`; fixture renderer timings in `9d8ae7b`. ESM declarations, optional Adapter peer, tarball contents, clean ESM/TypeScript consumer install, source-neutral runtime imports, and deterministic A/E/GLB/resource/cancel-detection measurements exist. No direct-COPC comparison, hardware GPU benchmark, transient allocation profile, active-cancel benchmark, or comparative install/bundle-size benchmark is available. A clean Adapter-only dependency tree did not include Tiles. |

## Adapter public API compatibility audit

Checked the installed and registry-published `@frillab/copc-adapter@0.6.0`
package metadata and public root, `/cesium`, and `/three` entrypoints. The
registry reports version `0.6.0` with integrity
`sha512-hGIkMUemivbJ6vv2rw+CZv71EwtIHdyHjuoLEuTmsErQPn9SUng9Zl7QJetf7u3DRxfAWn/ud4sBl0l4NJwl7w==`.
The exact version is the only compatibility version asserted by this audit.
No Adapter source or package-private deep import is used by the Tiles engine.

| Capability | Required public API | Supported version | Available? | Evidence / blocker |
| --- | --- | --- | --- | --- |
| Open HTTP/File source | `CopcBackend.open` and public input/options types | 0.6.0 | Partial | Public `copcJsBackend.open` used for the HTTP Range Autzen integration. Local File input path is not verified in this campaign. |
| Root hierarchy page | `CopcSource.getRootHierarchyPage()` | 0.6.0 | Yes | Public method. |
| Lazy hierarchy page access | `CopcSource.loadHierarchyPage(page, options)` | 0.6.0 | Partial | Public method and inferred page/node result types. Its options do not include `AbortSignal`; an in-flight page read cannot be cancelled through this contract. |
| Stable node keys and completeness | Public hierarchy node returned from page methods, including `key`, coordinates, chunk range, children and `childrenComplete` | 0.6.0 | Partial | Shape can be inferred from public method signatures; node/page types are not independently exported by name. Never treat `childrenComplete !== true` as a proven leaf. |
| Conservative per-node ECEF bounds | Public hierarchy metadata or node read result with conservative WGS 84 ECEF bounds and source/transform generation | 0.6.0 | No | Tiles can accept bounds from a source-neutral provider, but the Adapter contract does not establish how to derive or invalidate them. No private hierarchy bounds or unverified CRS transform is used. See #383. |
| Requested node points | `loadPreparedPointData`, `loadPointDataBuffer`, `loadPointDataView` | 0.6.0 | Partial | Public methods accept `AbortSignal`; actual `copcJsBackend` used `loadPointDataBuffer` and public preparation helper through the optional factory. `loadPreparedPointData` was absent on that backend instance. |
| Experimental E cache view | Public ECEF Float64 + prepared-height Float64 read-only node view | 0.6.0 | No | No public E cache node/read API. Do not import internal cache types. See Adapter [issue #383](https://github.com/mors119/copc-adapter/issues/383). |
| Requested standard LAS fields | `CopcPointFieldSelection` and returned attributes | 0.6.0 | Yes for tested fields | `position`, `rgb`, `intensity`, and `classification` were available on the Autzen node, and Tiles samples matched the public point-view samples. Other LAS fields and backend variants are unverified. |
| Named extra dimensions | Per-node named extra-dimension request | 0.6.0 | No | Public attribute types can represent typed extras, but public source selection does not request names per node. A named request and explicit missing-field result are proposed in #383. |
| Runtime-neutral point preparation | Public CRS preparation callable without renderer runtime | 0.6.0 | No | Public `/cesium` exports `transformPointBufferToPreparedPointData` and it passed the real browser test. No renderer-neutral helper was verified; the optional connector subpath dynamically imports the renderer entrypoint only when called. `loadPreparedPointData` is preferred when available. |
| CRS / vertical provenance | Explicit source CRS, applied correction and datum/grid provenance alongside prepared node points | 0.6.0 | Partial | Autzen WKT is preserved as unverified and vertical datum remains unknown. The connector did not apply a correction. Complete per-node transform/generation provenance is not established. |
| Source generation invalidation | Public monotonic source/transform generation or equivalent lifecycle token | 0.6.0 | No | Tiles can invalidate its own connector generation on close/switch, but cannot observe undocumented Adapter-internal transform changes. Propose a stable generation token in #383 if required by a concrete call path. |

The connector will use only public package entrypoints and will remain
separate from the source-neutral engine. Adapter issue #383 is a compatibility
gate and proposal tracker; this campaign does not modify that repository.

## Verification record

| Command / check | Result |
| --- | --- |
| `npm run typecheck` | Pass: strict source/type tests compile against public Adapter 0.6.0 types. |
| `npm run build` | Pass: Node ESM JavaScript and declarations emit under `dist/`; build clears stale output first. |
| `npm run validate:gltf` | Pass: 8 tests; Khronos validator reports zero errors/warnings for fixture outputs. Actual Autzen node GLB also reports 0/0. |
| `npm run validate:tileset` | Pass: 5 tests including CesiumGS 3D Tiles Validator; zero validator errors/warnings. |
| `npm run validate:implicit` | Pass: 5 tests including subtree fixtures and CesiumGS validator; zero validator errors/warnings. |
| `npm run validate:resources` | Pass: 9 Fetch handler tests for paths, MIME, cancellation, cache, generation, queue and cleanup. |
| `npm test` | Pass: 64 T1–T8 fixture and mocked bridge tests. |
| `COPC_TILES_BROWSER_PORT=4174 COPC_TILES_AUTZEN=/tmp/copc-tiles-autzen.copc.laz npm run test:browser` | Pass: 3 browser tests: Cesium fixture, Three fixture, and public Adapter actual Autzen node integration. Cesium/Three full real-data rendering is not asserted. |
| `npm run build` + clean tarball consumer | Pass: `npm pack` contents installed in a fresh ESM consumer; root/resource exports and TypeScript declarations resolved. Runtime dependency graph had only Tiles; Adapter remained an unmet optional peer. |
| `npm audit --omit=dev` | Pass: zero production/runtime vulnerabilities. |
| `npm audit` | 5 high findings remain in development-only validator stack (`3d-tiles-validator`, `3d-tiles-tools`, `@gltf-transform/functions`, `ndarray-pixels`, `sharp`). The official validator currently pins older Sharp; forcing an unsupported version was not done. |
| `npm run bench:engine` | Pass: deterministic one-node synthetic benchmark; figures and environment below. No Direct COPC comparison is claimed. |
| `git diff --check` | Pass on the final staged worktree. |

## Performance evidence

Run with `npm run bench:engine`, 100,000 deterministic synthetic points, one
node, RGB/intensity/classification, Node v26.12.1 on macOS arm64 / Apple M2,
8 logical CPUs, 8 GiB RAM. One GLB was 2,301,416 bytes. Retained E coordinate
buffers used 3.2 MB (ECEF + prepared height); A inputs used 8.0 MB (ECEF +
source + geographic); selected attributes used 0.9 MB. A and E views encoded
byte-identical GLBs.

| Operation | Samples | Median | p95 |
| --- | ---: | ---: | ---: |
| A view construction | 25 | 0.004 ms | 0.009 ms |
| E view construction | 25 | 0.004 ms | 0.009 ms |
| A view GLB encoding | 7 | 5.976 ms | 8.045 ms |
| E view GLB encoding | 7 | 9.636 ms | 12.752 ms |
| Pre-aborted node-read detection | 50 | 0.013 ms | 0.081 ms |
| Resource cold request | 7 | 4.116 ms | 51.568 ms |
| Resource warm request | 50 | 0.980 ms | 6.314 ms |

These are local microbenchmarks, not comparative performance guarantees. The
resource test uses an in-memory provider. Reported process memory includes
runtime and retained inputs; transient encoder allocation was not profiled.
The cold p95 outlier, A/E timing variation, and small sample sizes warrant
reruns before drawing performance conclusions. Cancellation timing covers
pre-aborted request detection only; active cancellation under network/decode
work was not timed. The actual Autzen node encoded to 151,650 bytes from
6,529 points, after 205,026 bytes of bounded COPC range reads. Those byte
counts describe different representations/work and are not a Direct-vs-Tiles
performance comparison. Browser frame time, active cancellation overhead,
cold/warm network behavior, larger node counts, and Rust/experimental-E
measurements are unavailable. No GLB decode benchmark was added because this
package provides an encoder and delegates decoding to clients.

One headless Chromium / SwiftShader browser run at 640×480 measured Cesium
fixture initial tile loading at 819.0 ms and two post-load frames at 357.3 ms;
Three fixture loading at 74.8 ms and two post-load frames at 19.5 ms. Cesium ran
first with cold fixture resources; Three then used the same resource cache.
These timings include browser/render startup and are kept as environment
evidence only, not a Cesium-versus-Three comparison or hardware GPU benchmark.

## NPM readiness

- Candidate metadata: `@frillab/copc-tiles@0.1.0`, Apache-2.0, ESM-only,
  Node `>=18`, declarations in `dist/`, source-neutral root, and resource /
  tileset / implicit / optional Adapter subpath exports.
- Runtime dependencies: none. `@frillab/copc-adapter@0.6.0` is an optional
  exact-version peer. Core import does not load Adapter code. Renderer and
  validator dependencies are development-only.
- Packed consumer check: `npm pack --dry-run --json` contains 41 files / 225,258
  unpacked bytes: built ESM/declarations, docs, README, license and changelog.
  Clean ESM and TypeScript imports passed without installing Adapter.
  `node_modules`, samples, browser outputs and tests are excluded.
- Adapter-only check: installing `@frillab/copc-adapter@0.6.0` in a fresh
  consumer produced no `@frillab/copc-tiles` dependency. No package-size or
  bundle-size comparison is claimed.
- Publishing checklist: `docs/release-checklist.md`. No package has been
  published. Production dependencies audit clean; development validator stack
  advisories remain disclosed above.

## Campaign limitations

## Release classification

**B — Tiles Engine Release Candidate.** The source-neutral engine, external
source contract, deterministic fixtures, standards checks, fixture browser
consumers, and packed consumer path pass. Full Adapter-backed COPC tileset
generation/rendering remains limited by missing public bounds, E-cache,
generation, named-attribute and cancellation APIs. Do not market this as full
COPC-to-Tiles support. The candidate remains unpublished pending maintainer
review of these limits and the development-only validator advisories.

- Deterministic fixtures are permitted for Tiles engine development, but do not
  prove COPC parsing, Range, LAZ decode, CRS preparation, or real Adapter
  compatibility.
- Adapter issue #383 is external and remains under maintainer review. Missing
  APIs are recorded here rather than replaced by private imports or copied
  implementations.
- No issue is closed, and no package is published, merged, or released by this
  campaign.
