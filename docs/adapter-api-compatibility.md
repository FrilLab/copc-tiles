# Adapter API compatibility — 2026-10-30

## Supported published artifact

Tiles supports exactly `@frillab/copc-adapter@0.7.0`. Both the optional peer
dependency and development dependency use this exact version. No older or
newer version is claimed compatible.

The package was verified from npm Registry metadata and its actual packed
tarball:

| Registry field | Value |
| --- | --- |
| Latest version | `0.7.0` |
| Public exports | `.`, `./core`, `./cesium`, `./three` |
| Tarball | `https://registry.npmjs.org/@frillab/copc-adapter/-/copc-adapter-0.7.0.tgz` |
| `dist.integrity` | `sha512-5HxipG4l8GFSMls3xEtZP2uixrlvXoAyjzkA9/wjkXx3lTF7d5fU8g/Q5uBJaNJ5gKxJNobduf7kvTVJ8sMIDg==` |
| `dist.shasum` | `f773f4e271c252ace1746773410815c7694eab77` |
| npm `gitHead` | `211f9a80f5dd53d084ddb21da033c1f6ad572421` |
| Packed / unpacked | 638,050 bytes / approximately 2.3 MB, 124 files |

The published `package.json` export map and `dist/core.d.ts` were compared
with upstream source at the exact npm `gitHead`; the public `packages/core.ts`
entrypoint exports the same Core types and runtime API. Adapter PR #391 was
merged at `c5b563b3d0c5743b8030a79eca8c820421c9d4a7`. Tiles does not import or
copy Adapter source files.

## Public contract inventory

| Operation | Public Adapter 0.7.0 API | Data and ownership | Cancellation and lifecycle | Tiles coverage and limits |
| --- | --- | --- | --- | --- |
| Open source | `createCopcContext(input, backend, options)` from `@frillab/copc-adapter/core`; `CopcContext` | Accepts URL, `File`/`Blob`, or public random-access source; backend is explicitly `copc-js` or `rust`. | Context has idempotent `close()` and lifetime `sourceGeneration`. | Installed-package ESM import and both real HTTP backends pass. File/Blob has not been tested in Tiles. |
| Read source metadata | `CopcNodeSource.getMetadata()`; `CopcMetadata` | Includes source-space bounds/cube and CRS evidence. Connector returns a recursively copied and frozen metadata value; it does not relabel source bounds. | Connector checks source freshness before reading. | Connector unit test covers defensive copy/freeze and source-coordinate semantics. |
| Traverse hierarchy | `getRootHierarchyPage()`, `loadHierarchyPage(page, { signal })`; `CopcHierarchyNode`, `CopcHierarchyPage` | Page/node records include hierarchy key, node level/coordinates, point count/range, known child keys and completeness. Cell coordinates remain source CRS/units. | Page requests accept `AbortSignal`; closing the source invalidates pending work/results. | Autzen selected reads and SoFi page read pass. A complete production hierarchy-to-Tileset route is not implemented. |
| Read a cell bound | `CopcNodeSource.getNodeCellBounds(nodeKey)`; `CopcHierarchyBounds` | Bounds are in COPC source axes and CRS units. Connector returns a separate frozen value. | Source generation applies. | Never treated as an ECEF or 3D Tiles bound. |
| Prepare one node | `loadPreparedNodeData(node, fields, options)`; `CopcPreparedNodeData` | A-shaped `PreparedPointData` contains source/geographic/ECEF Float64 coordinates plus only actual requested fields. Adapter-owned typed arrays are read-only by contract and may be retained; connector aliases ECEF/attribute buffers. | Per-call signal and source close reject stale results. Synchronous `copc-js` decoding may finish before rejection; backend physical cancellation is not guaranteed. | Autzen and SoFi node count/attributes tested on both backends. |
| Select fields / Extra Dimensions | `CopcPointFieldSelection`, `CopcPointField`, and `extraDimensions` option; result `availableFields` and `availableExtraDimensions` | Exact case-sensitive Extra Dimension names and supported `Float64Array`, `BigInt64Array`, or `BigUint64Array` values are preserved. Missing values are omitted, never zero-filled. | Uses the same request signal and generation checks. | Real RGB/intensity/classification coverage tested. Real Extra Bytes not tested; Rust/WASM rejects non-empty Extra Dimension requests. |
| Preserve transform evidence | `sourceGeneration`, `transformGeneration`, `transformPlan`, `isCurrent()` on `CopcNodeSource`; same provenance on prepared result | Immutable public `CoordinateTransformPlan`; includes CRS/unit/vertical evidence, operations and transform identity. | Source close and generation checks reject stale operations. | Connector exposes plan and validates result identity/generations. No public E-cache view exists. |
| Bound decoded content | `CopcPreparedNodeData.ecefBounds`, `ecefBoundsKind` | `ecefBoundsKind` is `decoded-point-content`; ECEF bounds enclose only that prepared node's decoded points. | Bound belongs to prepared result generations. | Existing one-node wrapper pads decoded-content bounds by observed Float32 encoding error and minimum tolerance. This does not cover unread content. |
| Bound an undecoded transformed cell | No public operation in Adapter 0.7.0 | `getNodeCellBounds()` is source-space; decoded `ecefBounds` is not a cell bound. | No bound-specific signal or provenance contract exists. | Blocks safe production multi-node Tilesets for Autzen and arbitrary nonlinear CRS/vertical transforms. The proposed API is in [`adapter-383-bounds-followup.md`](./adapter-383-bounds-followup.md). |

## Connector behavior

`src/adapter/copcCoreAdapter.ts` is the versioned public connector. It imports
only `@frillab/copc-adapter/core`, calls `createCopcContext()` and
`loadPreparedNodeData()`, maps hierarchy records, and requests position plus
selected fields. It preserves actual field availability, source/node identity,
transform plan and generation. Prepared ECEF/attribute arrays are aliased into
the Tiles view; the connector does not decode COPC, transform CRS, reconstruct
E data, or invoke Direct `NodeSelector`.

## Compatibility verification

- `npm run typecheck`, `npm run typecheck:adapter-core`, and package build pass
  against the installed Registry package.
- Public `/core` runtime imports pass from the published package. The root
  Tiles Engine does not import Adapter, Cesium, or Three.
- Strict TypeScript Bundler-mode checking passes for the packed connector.
- Strict external `NodeNext` checking fails with TS2834 in Adapter's emitted
  `dist/core.d.ts`: relative declaration imports omit `.js` extensions. This
  is an Adapter package declaration issue; Tiles does not rewrite those types.
- Autzen node `4-11-2-0` (5,122 points) passed single-node validation/rendering
  in Cesium and Three with both backends. SoFi nodes at levels 2–4 were read
  and encoded with both backends; only the primary node was rendered. These
  checks do not demonstrate production multi-node LOD.
- Clean packed consumers passed for Tiles Engine without Adapter, Tiles with
  Adapter Core, Tiles with Cesium, Tiles with Three, and Direct Adapter with
  Cesium without Tiles. Install and bundle sizes are recorded in the PR and
  current implementation report.

Adapter Direct `/`, `/cesium`, and `/three` defaults were not changed. Adapter
issue #383 remains open for the conservative transformed-cell-bounds contract;
Tiles has not modified upstream code or issues.
