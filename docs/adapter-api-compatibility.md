# Adapter API compatibility matrix — 2026-10-30

## Tested Adapter artifact

The public `/core` contract was inspected from the merged Adapter PR
[#391](https://github.com/mors119/copc-adapter/pull/391), merge commit
`c5b563b3d0c5743b8030a79eca8c820421c9d4a7` (the current upstream `main` SHA
when tested). The source package still reports version `0.6.0`.

Adapter was built and packed from that checkout with `npm ci` and
`npm pack --pack-destination /tmp/copc-adapter-packed` in `packages/`.
Candidate tarball:

- File: `frillab-copc-adapter-0.6.0.tgz`
- SHA-256: `89b16b209496ff848c22405c99962bb167746aacbcac2415840dc6133f110838`
- Packed size: 638.1 kB; unpacked size: 2.3 MB
- Import map includes `.`, `./core`, `./cesium`, and `./three`.

This is a source-built candidate, **not** the npm `0.6.0` artifact. Published
Adapter `0.6.0` has no `./core` export. No released npm version containing
`./core` has been verified, so the version string `0.6.0` alone does not
identify a compatible artifact. Tiles reserves the peer range
`>=0.6.1 <1.0.0` to exclude the immutable published `0.6.0`; a future release
must still pass the packed check below before it is considered supported.

## Packed Tiles consumer artifact

Tiles was built and packed as `@frillab/copc-tiles@0.1.0` for this check:

- File: `frillab-copc-tiles-0.1.0.tgz`
- Packed size: about 79 kB; unpacked size: about 293 kB (current review snapshot)
- Public connector: `@frillab/copc-tiles/adapter/copc-core`

The exact Tiles tarball checksum is recorded in the repository-only
`PACKED_CONSUMER_RECORD.md`; that checksum record is excluded from the npm
package to avoid embedding a tarball's hash inside the tarball itself.

The exact Adapter candidate tarball and Tiles tarball were installed by file
path into a clean consumer. Node ESM resolved static imports from Adapter
`/core`, the Tiles connector and the Tiles engine root. The root exposes no
Adapter connector. Strict TypeScript 5.9.3 with Bundler resolution and
`skipLibCheck: false` passed; strict NodeNext reaches the candidate declaration
gap described below. Vite 7.3.7 produced a browser build, and the real-source
Chromium integration exercised the packed Adapter candidate through the Tiles
connector.

Fresh install measurements on this machine used `npm install --ignore-scripts
--no-save` and `du -sk node_modules`: Adapter-only 6,696 KiB, Tiles-only 376
KiB, and combined 7,068 KiB. The current Tiles-only install did not install
Adapter or renderer packages because its Adapter peer is optional. The combined
install used `--legacy-peer-deps`: candidate metadata says `0.6.0`, but Tiles
reserves `>=0.6.1 <1.0.0` to exclude the published `0.6.0` artifact that lacks
`/core`. These measurements are environment-specific disk footprints, not
registry release-size guarantees.

## Public contract inventory

| Operation | Public export and tested artifact | Data and ownership | Cancellation and lifecycle | Coverage and limits |
| --- | --- | --- | --- | --- |
| Open source | `createCopcContext()` from `@frillab/copc-adapter/core`; packed source candidate at the SHA above | Accepts URL, `File`/`Blob`, or a public random-access source; selects `copc-js` or `rust` explicitly. | Source context owns its opened resources and exposes idempotent `close()`. | Real browser test passed for HTTP Range with both built-in backends. File/Blob was not exercised. |
| Traverse hierarchy | `CopcNodeSource.getRootHierarchyPage()` and `loadHierarchyPage(page, { signal })` | Returns public hierarchy page and node records, including node key, point count, point byte range, known children, and completeness. Page/cell coordinates stay in COPC source CRS. | Hierarchy page calls accept `AbortSignal`; closing the context invalidates source work. | Autzen root and selected node pages passed. SoFi's first page returned 2,599 entries and 111 child-page references. Full-tree traversal is not claimed. |
| Prepare one node | `CopcNodeSource.loadPreparedNodeData(node, fields, options)` | Returns A-shaped `PreparedPointData`: Source, Geographic, and WGS84 ECEF Float64 buffers plus only attributes actually returned. Buffers are owned JavaScript arrays, read-only by contract, retainable after close, and must not be mutated or transferred. | Per-read `AbortSignal`; source and transform generations are attached to the result. Stale results are rejected. | The connector passes the returned prepared arrays into a zero-copy Tile view. It does not reconstruct E cache entries or run an extra coordinate transform. |
| Select fields | `createCopcPointFieldSelection()` and `CopcPointFieldSelection` from `/core`; named Extra Bytes on `loadPreparedNodeData()` options | `availableFields` and `availableExtraDimensions` report actual results. Absent fields are omitted, never zero-filled. Extra Dimension names are exact and case-sensitive. | Request options include the same read signal. | RGB, intensity, classification, and position passed on Autzen. SoFi had no RGB and Tiles omitted it. Real named Extra Bytes were not exercised. `copc-js` supports exact configured Extra Bytes where descriptors permit; Rust/WASM rejects non-empty Extra Bytes requests. |
| Preserve transform/source identity | `sourceGeneration`, `transformGeneration`, `transformPlan`, `isCurrent()` on `CopcNodeSource`; same fields on prepared-node result | Tiles stores the opaque caller source identity separately and retains Adapter generations and the immutable transform plan with each point view. | `isCurrent(generation)` and `close()` reject stale work. | Covered by packed type checks and connector unit tests for source close, cancellation, mismatched generation, and stale results. |
| Read an octree cell box | `CopcNodeSource.getNodeCellBounds(nodeKey)` on candidate `c5b563b3d0c5743b8030a79eca8c820421c9d4a7` | Returns source-space bounds in COPC CRS axes and units. | Source generation applies. | Suitable for hierarchy/metadata inspection; not directly a WGS 84 ECEF 3D Tiles bound. |
| Use decoded ECEF bounds | `CopcPreparedNodeData.ecefBounds`, `ecefBoundsKind` | `ecefBoundsKind` is `decoded-point-content`; bounds enclose decoded, transformed points only. | Tied to that prepared result's generations. | Used only to bound the loaded node's point content. Tiles never treats decoded-point bounds as a conservative bound for an undecoded cell. |
| Bound an undecoded transformed cell | No public operation in the packed `c5b563b3d0c5743b8030a79eca8c820421c9d4a7` candidate | `createPointTransformer()` maps individual points but declares no interval/enclosure guarantee for a source cell. | No bound-specific cancellation or generation contract exists. | Blocks real multi-node tilesets for nonlinear CRS/vertical transforms. Proposed minimal contract and tests: [`adapter-383-bounds-followup.md`](./adapter-383-bounds-followup.md). |
| Renderer isolation | `@frillab/copc-adapter/core` | The public entrypoint is renderer-neutral; its packed ESM import works without installing CesiumJS or Three.js. | Not applicable. | Vite browser consumer build and real Chromium tests passed. Direct `/`, `/cesium`, `/three` were not changed by this Tiles change. |

## Packed consumer checks

The source-built tarball was installed by tarball path in a clean npm consumer.
The consumer used a public static import of
`@frillab/copc-adapter/core`; Node ESM resolved `createCopcContext`,
`CopcContext`, `HierarchyLoader`, and `createCopcPointFieldSelection`.
Strict TypeScript 5.9.3 checking passed with `moduleResolution: "Bundler"`
and `skipLibCheck: false`.

Strict `NodeNext` checking **fails** on the candidate's emitted
`dist/core.d.ts`: relative declaration imports omit `.js` extensions and
produce TS2834. This is a public declaration packaging gap in the Adapter
candidate, not a Tiles connector mismatch. Do not claim strict NodeNext
declaration compatibility until Adapter fixes and repacks it. A browser Vite
consumer and the real-source browser connector tests passed against the
candidate tarball.

## Real-source evidence

The browser validation used Chromium on macOS arm64, Node `26.12.1`, and the
Autzen sample (81,123,042 bytes, SHA-256
`db2d56cdfa058bffccdc5d6019dae2fc9c6a551df10a5523c06c76a3e25a27fa`). The
file remained in `/private/tmp`, not the repository.

| Backend / source | Reads and attributes | Precision and consumers |
| --- | --- | --- |
| Autzen, `copc-js` | Requested node `4-11-2-0`, 5,122 points; 6 Range GETs / 164,880 bytes; position, RGB, intensity, classification available. | GLB passed Khronos validation with zero errors/warnings. Cesium and Three each rendered 5,122 points and fetched identical GLB bytes. Encoder maximum error: `0.0000019626 m`; Three first-point world error: `0.0000014947 m`. |
| Autzen, Rust/WASM | Same node and fields; 7 COPC Range GETs / 101,455 bytes; worker/WASM asset requests were separate from COPC ranges. | GLB passed Khronos and CesiumGS validation with zero errors/warnings. Cesium and Three rendered 5,122 points. Encoder maximum error: `0.0000019651 m`; Three first-point world error: `0.0000014956 m`. |
| SoFi, `copc-js` | Public HTTP source, 2,599 first-page entries; three selected nodes at levels 2–4 loaded and encoded with exact hierarchy point counts. 8 Range GETs / 422,669 bytes including repeated reads. Position, intensity, classification available; RGB absent. | Primary 1,131-point GLB passed both validators and rendered in Cesium and Three. Encoder maximum error: `0.0000041748 m`; Three first-point world error: `0.0000023888 m`. Browser could not read `Content-Range`; Adapter's `head-fallback` policy was used. |
| SoFi, Rust/WASM | Same three nodes and actual fields; 9 Range GETs / 359,053 bytes including repeated reads. | Primary GLB passed both validators and rendered in Cesium and Three. Encoder maximum error: `0.0000041749 m`; Three first-point world error: `0.0000023885 m`. Browser used the same `head-fallback` range-validation policy. |

These are one-node renderer wrappers. They verify real Core preparation and
consumer rendering, not production multi-node LOD, full-cloud coverage,
vertical datum correctness, or conservative ECEF bounds for undecoded cells.
SoFi passed with both `copc-js` and Rust/WASM. File/Blob, named Extra Bytes,
and explicit vertical-grid transforms were not exercised in Tiles.

## Remaining Adapter #383 notes

The `/core` API, named public hierarchy/node types, source and transform
generations, prepared A data, and request cancellation close the original
connector API gaps identified in [Adapter issue #383](https://github.com/mors119/copc-adapter/issues/383).
The bounded Tiles node-preparation connector is verified against the packed
candidate. Full on-demand Tiles remains blocked by the missing conservative
transformed-cell bound. Keep #383 open for release, declaration, and bounds
follow-up:

1. Publish a release with `./core` and declaration paths that pass strict
   `NodeNext`; the source-built candidate's `0.6.0` label is not sufficient.
2. If Adapter intends to support full nonlinear-CRS Tiles traversal, consider
   a narrowly scoped conservative transformed-cell bound operation. The exact
   gap, Autzen transform evidence, proposed read-only method, and required
   validation are recorded in
   [`adapter-383-bounds-followup.md`](./adapter-383-bounds-followup.md).
   Decoded `ecefBounds` cannot bound undiscovered octree cells. Tiles currently
   does not infer that bound from source-cell corners or decoded point content.
3. The candidate does not expose a read-only E cache view. This does not block
   the A-shaped Tiles baseline. If a future Tiles E path is required, expose a
   narrow public view of retained interleaved ECEF Float64 and prepared-height
   Float64 data; do not rehydrate E through `PreparedPointData`.

The connector does not implement a second hierarchy parser, Range reader,
LAZ decoder, CRS transform, or cache conversion. Direct Cesium/Three defaults
and Adapter source were not changed.
