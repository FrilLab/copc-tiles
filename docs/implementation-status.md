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
| T5 — Tileset geometry | Partial | Commit `97f9fc9`. Bounded explicit hierarchy, conservative-bound containment, local boxes, placement and geometric-error policies pass fixture tests and the CesiumGS validator. The one-node Autzen wrapper was rendered with encoder-aligned placement and measured bounds; production COPC cell bounds/provenance remain unavailable. |
| T6 — Implicit tiling | Partial | Commit `dc7bd9d`. Sparse OCTREE root, Morton indexing, subtree availability and binary subtrees pass fixture tests and the CesiumGS validator. Real COPC implicit cells remain blocked by missing public bounds/provenance and complete hierarchy evidence. |
| T7 — Metadata | Partial | Commit `d232f30`; actual-node evidence in `acdfc6f`. LAS intensity/classification and supported typed extras use `EXT_structural_metadata` indexed by `EXT_mesh_features`. Fixture validators pass; the real Autzen node preserves actual RGB/intensity/classification. Named extra dimensions remain unavailable in Adapter 0.6.0. |
| T8 — Resource serving | Partial | Commit `73eccee`; browser evidence in `acdfc6f` and this run. Bounded Fetch handler, MIME, HEAD/GET, path checks, LRU, deduplication, subscriber cancellation, generation invalidation, queue limits and cleanup pass focused tests. Cesium and Three fetched the real one-node Autzen tileset and GLB through standard URLs; COPC-to-resource generation was precomputed for this test, so real on-demand node lifecycle remains unverified. |
| T9 — Cesium | Partial | Browser integration in `acdfc6f` and this run. Public CesiumJS `Viewer` and `Cesium3DTileset.fromUrl` requested the real one-node Autzen tileset/GLB, selected 6,529 visible points with normal frustum culling, rendered pixels, stayed visible after camera movement and destroyed the viewer. This is a pre-generated single-node test wrapper, not complete COPC hierarchy/LOD. See `docs/t9-cesium.md`. |
| T10 — Three.js | Partial | Browser integration in `acdfc6f` and this run. Public `3d-tiles-renderer`, Three.js, `GLTFLoader`, mesh-features and structural-metadata plugins consumed the same one-node Autzen resources, exposed points/RGB/metadata, rendered pixels after camera movement, and disposed active tiles. First-point world-coordinate error was measured against Adapter ECEF. The data was pre-generated; no real multi-node hierarchy or LOD is claimed. See `docs/t10-three.md`. |
| T11 — Standards/security | Partial | Khronos glTF and CesiumGS 3D Tiles validators pass fixture output and the actual one-node Autzen GLB/tileset wrapper with zero errors/warnings. Unit suites cover malformed binary lengths, attributes, ranges, hierarchy, unsafe numeric values, cancellation and configured work limits. Implicit subtree validation remains fixture-only; full attack-surface audit remains incomplete; five high npm advisories remain in development-only 3D Tiles validator/sharp dependencies. |
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

## Source API compatibility matrix

Rechecked on 2026-10-29 against the npm registry and the actual packed
`@frillab/copc-adapter@0.6.0` tarball. The tarball integrity is
`sha512-hGIkMUemivbJ6vv2rw+CZv71EwtIHdyHjuoLEuTmsErQPn9SUng9Zl7QJetf7u3DRxfAWn/ud4sBl0l4NJwl7w==`.
Its export map contains only `.`, `./cesium`, and `./three`; no `./core`
node-source entrypoint is published.

Adapter PR [#391](https://github.com/mors119/copc-adapter/pull/391) proposes
the renderer-neutral `./core` API and reports packed-consumer and Autzen checks,
but was open and had no submitted reviews at this audit. The PR body explicitly
says the published `0.6.0` artifact predates that API. It is not a version Tiles
can declare compatibility with. Its proposed per-node ECEF bounds cover
decoded point content; its source-space cell bounds do not conservatively cover
an undecoded cell after arbitrary CRS/vertical transformations. The real
hierarchy integration therefore remains blocked even if that proposal is
merged without an additional bound contract.

| Operation | Published `0.6.0` package | Proposed Adapter PR #391 | Tiles compatibility result |
| --- | --- | --- | --- |
| Open HTTP / Blob source | `CopcBackend.open()` and `CopcSource`, available through `/cesium`; the packed export map has no `/core` | `createCopcContext()` from `/core` | `0.6.0` HTTP `copc-js` open is verified for one bounded Autzen node; Blob and Rust are not verified here |
| Lazy hierarchy pages | Public root-page and `loadHierarchyPage()` methods; page options have no `AbortSignal` | `CopcContext` and bounded `HierarchyLoader` | Page traversal is usable, but an in-flight page read cannot be cancelled on `0.6.0` |
| Stable node identity / completeness | Public hierarchy result has key and child-completeness fields; named hierarchy types are not exported by the current entrypoints | Named `CopcHierarchyNode` and hierarchy loader contract | One real node was resolved; complete multi-level coverage is not asserted |
| Requested node data / attributes | Public node view and optional buffer/prepared methods; standard selection covers position, RGB, intensity, classification | `loadPreparedNodeData()` with actual available fields and optional configured Extra Bytes | A-shaped ECEF Float64 data and RGB/intensity/classification are verified on one Autzen node; no E cache path is used |
| Conservative bounds before decode | Metadata bounds and octree cell coordinates are in source CRS; no public conservative ECEF bound for an undecoded node cell | `ecefBounds` encloses decoded point content; source cell bounds remain source CRS | **Blocker:** no safe parent/descendant culling volume is available without decoding descendants or inventing a CRS bound |
| CRS / height provenance and generations | Metadata and a manual prepared height offset are observable; no stable transform-plan/generation token is attached to hierarchy results | `transformPlan`, source generation, and prepared result provenance | `0.6.0` connector values are caller-supplied and marked unknown/unverified for Autzen; insufficient for full compatibility claims |
| Cancellation / lifecycle | Point reads accept `AbortSignal`; page reads do not. `destroy()` and point-job cancellation are optional source methods | Request signals, `close()`, `isCurrent()`, stale-result rejection | Point cancellation is partial on `0.6.0`; hierarchy cancellation is missing |
| Runtime renderer isolation | No renderer-neutral `/core`; the verified fallback preparation function is exported from `/cesium` | `/core` is renderer-neutral | Proposed API is not shipped; no supported packed consumer can import it yet |

The existing `@frillab/copc-tiles/adapter/copc-js` contract is therefore
limited to opening a public `0.6.0` source, loading requested nodes, preparing
one bounded A-shaped node, and encoding it. It is not a complete hierarchy,
tileset, or renderer integration. Do not change the supported Adapter version
or add a speculative `./core` import until a reviewed Adapter release is
published and its packed consumer has been tested from this repository.

## Merged PR #13 review findings

PR #13 is merged. Its later review findings were checked against the current
code and addressed where they were independent of the Adapter release gate:

- Explicit hierarchy output no longer marks every listed child set complete;
  `childrenComplete: false` remains incomplete in generated records.
- An aborted in-flight content load no longer permanently poisons same-URI
  deduplication; its outstanding work still counts against queue/concurrency
  bounds until it settles.
- The Adapter bridge preserves malformed hierarchy results long enough for the
  bounded reader to reject them. A fused prepared-node method no longer imports
  Cesium or requires metadata.
- Playwright skip/timeout handling now uses supported test APIs.
- The exploratory Autzen wrapper now shares the encoder's origin and tile
  transform, expands measured point bounds by encoding error, and uses the
  measured bounds half-diagonal as geometric error. Cesium's normal tile
  selection had skipped the prior zero-error content without requesting it.

The merged PR's independent concerns about complete Adapter hierarchy bounds,
transform provenance, implicit real-source coverage, packed renderer isolation,
and multi-level browser behavior remain open acceptance items.

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
| `COPC_TILES_BROWSER_PORT=4174 COPC_TILES_AUTZEN=/tmp/copc-tiles-autzen.copc.laz npm run validate:adapter-integration` | Pass: public Adapter 0.6.0 read one 6,529-point Autzen node through six bounded ranges (205,026 bytes), encoded a 151,650-byte GLB, and actual Cesium and Three fetched and rendered that GLB through `/fixture/autzen/*` URLs. Cesium and Three each represented 6,529 points; the test did not generate the COPC hierarchy on demand. |
| `COPC_TILES_BROWSER_PORT=4174 COPC_TILES_AUTZEN=/tmp/copc-tiles-autzen.copc.laz npm run test:browser` | Pass: all 3 browser tests (real one-node Autzen, Cesium fixture, Three fixture). The real test reports 6,529 visible points in both renderers; the adapter-prepared origin is -123.070412°, 44.052407°; Cesium/Three rendered 10,038/5,257 initial non-background pixels and 9,777/5,164 after camera movement. This does not establish real multi-node coverage. |
| `npm run build` + clean tarball consumer | Pass: `npm pack` contents installed in a fresh ESM consumer; root/resource exports and TypeScript declarations resolved. Runtime dependency graph had only Tiles; Adapter remained an unmet optional peer. |
| `npm audit --omit=dev` | Pass: zero production/runtime vulnerabilities. |
| `npm audit` | 5 high findings remain in development-only validator stack (`3d-tiles-validator`, `3d-tiles-tools`, `@gltf-transform/functions`, `ndarray-pixels`, `sharp`). The official validator currently pins older Sharp; forcing an unsupported version was not done. |
| `npm run bench:engine` | Pass: deterministic one-node synthetic A/E benchmark with byte-identical output; rerun values and environment below. No real Adapter A/E comparison or Direct COPC comparison is claimed. |
| `git diff --check` | Pass on the final staged worktree. |

## Performance evidence

Reran `npm run bench:engine` with 100,000 deterministic synthetic points, one
node, RGB/intensity/classification, Node v22.23.4 on macOS arm64 / Apple M2,
8 logical CPUs, 8 GiB RAM. One byte-identical A/E GLB was 2,301,416 bytes.
The A input coordinates used 7.2 MB (ECEF + source + geographic); E used
3.2 MB (ECEF + prepared height); selected attributes used 0.9 MB. The selected
zero-copy A and E views retained 3.3 MB and 4.1 MB of typed-array buffers,
respectively. The GLB output retained 2,301,416 bytes. This records retained
buffers, not temporary encoder allocations or COPC source/decode preparation.

| Operation | Samples | Median | p95 |
| --- | ---: | ---: | ---: |
| A view construction / buffer selection | 25 | 0.002 ms | 0.007 ms |
| E view construction / buffer selection | 25 | 0.002 ms | 0.004 ms |
| A view GLB encoding | 7 | 8.331 ms | 9.156 ms |
| E view GLB encoding | 7 | 7.736 ms | 15.609 ms |
| A view construction + GLB encoding | 7 | 7.703 ms | 8.961 ms |
| E view construction + GLB encoding | 7 | 7.682 ms | 8.178 ms |
| Pre-aborted node-read detection | 50 | 0.016 ms | 0.069 ms |
| Resource cold request | 7 | 0.978 ms | 21.249 ms |
| Resource warm request | 50 | 0.361 ms | 1.097 ms |

These are local microbenchmarks, not comparative performance guarantees. A/E
encoders produced identical bytes and their median encode and prepare-plus-
encode times were within measurement noise; seven samples and the E p95 spread
are too small to justify changing the A default. The resource test uses an
in-memory provider. Retained output and selected-view buffer sizes are
reported, but temporary encoder allocation was not profiled. Cancellation
timing covers pre-aborted request detection only; active cancellation during
network/decode work was not timed. In the real one-node browser run, source
open through GLB encoding took 70.4 ms, Cesium loaded/rendered in 1,127.5 ms,
and Three in 172.0 ms; these include local test/browser overhead and are not a
Direct comparison or production latency guarantee. The real Autzen node encoded
to 151,650 bytes from 6,529 points after 205,026 bytes of bounded COPC range
reads. Those byte counts describe different representations/work. Larger
multi-node workloads, A/E Adapter paths, active cancellation, Rust, and hardware
GPU measurements remain unavailable. No GLB decode benchmark was added because
this package provides an encoder and delegates decoding to clients.

One headless Chromium / SwiftShader browser run at 640×480 measured Cesium
fixture initial tile loading at 819.0 ms and two post-load frames at 357.3 ms;
Three fixture loading at 74.8 ms and two post-load frames at 19.5 ms. Cesium ran
first with cold fixture resources; Three then used the same resource cache.
These timings include browser/render startup and are kept as environment
evidence only, not a Cesium-versus-Three comparison or hardware GPU benchmark.

## NPM readiness

- The standalone repository is the current development boundary, not a final
  distribution decision. After T12 review, compare (a) an optional Adapter
  `/tiles` subpath with (b) a separately published `@frillab/copc-tiles`
  package from a shared monorepo. The comparison still needs packed tarballs,
  lockfile/install footprint, representative runtime bundle graphs, renderer
  dependency isolation, public API compatibility and release-work overhead.
  No size improvement based only on tree shaking is claimed.
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
source contract, deterministic fixtures, standards checks, fixture consumers,
and one-node real rendering pass. Full Adapter-backed on-demand hierarchy and
LOD remain blocked by missing public conservative ECEF cell bounds, stable
transform provenance/generation and in-flight hierarchy cancellation. E-cache
and named Extra Bytes remain unsupported capabilities, but are not substituted
with private Adapter internals. Do not market this as full COPC-to-Tiles
support. The candidate remains unpublished pending maintainer review of these
limits and the development-only validator advisories.

- Deterministic fixtures are permitted for Tiles engine development, but do not
  prove COPC parsing, Range, LAZ decode, CRS preparation, or real Adapter
  compatibility.
- Adapter issue #383 is external and remains under maintainer review. Missing
  APIs are recorded here rather than replaced by private imports or copied
  implementations.
- No issue is closed, and no package is published, merged, or released by this
  campaign.
