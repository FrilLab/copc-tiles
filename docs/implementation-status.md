# COPC Tiles implementation status

This is a running record for the T1–T12 campaign. A milestone is complete only
when its full acceptance criteria pass. Fixture evidence is not reported as
real COPC integration evidence. Commits are recorded after each implementation
unit.

## Milestone status

| Milestone | Status | Evidence / remaining work |
| --- | --- | --- |
| T1 — Input contract | Partial | Commit `d73f4cd`. Source-neutral `TilePointView`, A-shaped and E-shaped structural inputs, field selection, provenance and zero-copy fixture tests exist. Public Adapter E access and named extra-dimension acquisition are unavailable; no real source run yet. |
| T2 — Node access | Partial | Bounded page traversal, requested-node reads, source generation checks, fixture tests, and a structural bridge compatible with public `CopcSource` 0.6.0 types exist. No real COPC or copc-js/Rust backend run; public E access and in-flight hierarchy cancellation remain unavailable. |
| T3 — Precision | Planned | No tile-local encoder or precision fixtures yet. |
| T4 — GLB | Planned | No GLB encoder or Khronos validation yet. |
| T5 — Tileset geometry | Planned | No tileset bounds or geometric-error implementation yet. |
| T6 — Implicit tiling | Planned | No subtree or availability implementation yet. |
| T7 — Metadata | Planned | No glTF metadata mapping yet. |
| T8 — Resource serving | Planned | No URL-addressable provider, bounded cache, or lifecycle implementation yet. |
| T9 — Cesium | Planned | No browser integration or Direct comparison yet. |
| T10 — Three.js | Planned | No browser integration or byte-equivalence check yet. |
| T11 — Standards/security | Planned | No official validator automation or complete malformed-input suite yet. |
| T12 — Performance/package | Planned | No release build, packed consumer, bundle isolation, or comparative benchmark evidence yet. |

## Adapter public API compatibility audit

Checked the installed and registry-published `@frillab/copc-adapter@0.6.0`
package metadata and public root, `/cesium`, and `/three` entrypoints. The
registry reports version `0.6.0` with integrity
`sha512-hGIkMUemivbJ6vv2rw+CZv71EwtIHdyHjuoLEuTmsErQPn9SUng9Zl7QJetf7u3DRxfAWn/ud4sBl0l4NJwl7w==`.
The exact version is the only compatibility version asserted by this audit.
No Adapter source or package-private deep import is used by the Tiles engine.

| Capability | Required public API | Supported version | Available? | Evidence / blocker |
| --- | --- | --- | --- | --- |
| Open HTTP/File source | `CopcBackend.open` and public input/options types | 0.6.0 | Yes | Public `/cesium` and `/three` exports; connector tests still required. |
| Root hierarchy page | `CopcSource.getRootHierarchyPage()` | 0.6.0 | Yes | Public method. |
| Lazy hierarchy page access | `CopcSource.loadHierarchyPage(page, options)` | 0.6.0 | Partial | Public method and inferred page/node result types. Its options do not include `AbortSignal`; an in-flight page read cannot be cancelled through this contract. |
| Stable node keys and completeness | Public hierarchy node returned from page methods, including `key`, coordinates, chunk range, children and `childrenComplete` | 0.6.0 | Partial | Shape can be inferred from public method signatures; node/page types are not independently exported by name. Never treat `childrenComplete !== true` as a proven leaf. |
| Requested node points | `loadPreparedPointData`, `loadPointDataBuffer`, `loadPointDataView` | 0.6.0 | Yes, subject to backend | Public methods; point-load options accept `AbortSignal`. Exact fetch/decode counts and error behavior need connector tests. |
| Experimental E cache view | Public ECEF Float64 + prepared-height Float64 read-only node view | 0.6.0 | No | No public E cache node/read API. Do not import internal cache types. See Adapter [issue #383](https://github.com/mors119/copc-adapter/issues/383). |
| Requested standard LAS fields | `CopcPointFieldSelection` and returned attributes | 0.6.0 | Partial | Public selection covers position/RGB/intensity/classification. Verify backend support and missing-field behavior in integration tests. |
| Named extra dimensions | Per-node named extra-dimension request | 0.6.0 | No | Public attribute types can represent typed extras, but public source selection does not request names per node. A named request and explicit missing-field result are proposed in #383. |
| Runtime-neutral point preparation | Public CRS preparation callable without renderer runtime | 0.6.0 | Unverified / likely gap | `/cesium` exports a preparation helper, but its runtime dependency graph must be checked before connector use. The engine will not import it into core. `loadPreparedPointData` is preferred when available. |
| CRS / vertical provenance | Explicit source CRS, applied correction and datum/grid provenance alongside prepared node points | 0.6.0 | Partial | Existing public metadata/options provide some source and height information; the complete per-node provenance contract is not established. Tiles will preserve unknown/unverified values and will not invent a datum. |
| Source generation invalidation | Public monotonic source/transform generation or equivalent lifecycle token | 0.6.0 | No | Tiles can invalidate its own connector generation on close/switch, but cannot observe undocumented Adapter-internal transform changes. Propose a stable generation token in #383 if required by a concrete call path. |

The connector will use only public package entrypoints and will remain
separate from the source-neutral engine. Adapter issue #383 is a compatibility
gate and proposal tracker; this campaign does not modify that repository.

## Verification record

| Command / check | Result |
| --- | --- |
| `npm test` | Pass: 29 T1/T2 fixture and mocked bridge tests. |
| `npm run typecheck` | Pass: source and type-test compilation, including public `PreparedPointData`, `CopcSource`, and `CopcBackend.open` compatibility assertions. |
| `git diff --check` | Pass. |
| Khronos glTF Validator | Not run; no encoder exists yet. |
| Cesium 3D Tiles Validator | Not run; no tileset/subtree exists yet. |
| Browser E2E / packed consumer / performance | Not run; dependent milestones are not implemented yet. |

## Campaign limitations

- Deterministic fixtures are permitted for Tiles engine development, but do not
  prove COPC parsing, Range, LAZ decode, CRS preparation, or real Adapter
  compatibility.
- Adapter issue #383 is external and remains under maintainer review. Missing
  APIs are recorded here rather than replaced by private imports or copied
  implementations.
- No issue is closed, and no package is published, merged, or released by this
  campaign.
