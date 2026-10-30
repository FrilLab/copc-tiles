# T2 node access through Adapter Core

## Scope

`TileNodeReader` resolves only explicitly requested node keys with bounded,
lazy hierarchy traversal and bounded point-read concurrency. It does not choose
nodes from a camera, invoke Adapter's Direct `NodeSelector`, or preload the
whole octree. Fixture sources and the Adapter connector implement the same
source-neutral `TileNodeSource` contract.

## Public `/core` connector

`src/adapter/copcCoreAdapter.ts` consumes types from the public
`@frillab/copc-adapter/core` export. `createCopcCoreNodeSource()` opens a
context through `createCopcContext()` and owns it by default;
`wrapCopcCoreNodeSource()` adapts an already-open `CopcNodeSource` and leaves
ownership with its caller by default. The bridge calls only these public
methods:

- `getRootHierarchyPage()` and `loadHierarchyPage(page, { signal })` for lazy
  hierarchy access.
- `loadPreparedNodeData(node, fields, { signal, extraDimensions })` for one
  selected node.
- `isCurrent(sourceGeneration)` and `close()` for generation and lifecycle
  handling.

The prepared result's A-shaped point data is passed to `createTilePointViewFromA`
without copying ECEF or selected attribute arrays. Adapter-provided
`availableFields` and `availableExtraDimensions` decide which selected
attributes are exposed. Missing fields stay absent. Tiles stores the stable
node key, source generation, transform generation, immutable transform plan,
available fields, and the decoded-point ECEF bounds with their documented
kind. It does not create E from A or rehydrate an Adapter E cache.

Core reports decoded-point bounds only. They may bound the loaded node's point
content; they are not transformed source-cell bounds for undecoded nodes. The
connector never substitutes those bounds for a hierarchy cell envelope. This
keeps full multi-node culling and LOD as an explicit T5/T9/T10 limitation until
a conservative cell-bound policy exists.

## Limits and failure handling

The reader defaults remain 512 hierarchy pages / 64 MiB of hierarchy ranges,
500,000 hierarchy records, 512 requested nodes, 2,000,000 points per node,
4,000,000 points per batch, 64 selected Extra Dimensions, 256 MiB of point
ranges per batch, 384 MiB of decoded views per batch, and four concurrent node
reads. Configurable limits are clamped to documented hard caps.

Hierarchy ranges, page/node records, point count, point byte ranges, decoded
buffer lengths, source generations, requested node identity, and returned
prepared identity are checked before data is exposed. Invalid or mismatched
data fails without retry or fabricated values. Request signals pass through to
both Core hierarchy-page reads and prepared-node reads. Closing a connector
aborts its local requests; it closes the Core context only when it owns it.

## Acceptance evidence

| Issue #2 criterion | Evidence / status |
| --- | --- |
| Requested keys without Direct scheduler | Implemented in `src/source/tileNodeReader.ts`; repository scan shows no `NodeSelector` or `StreamingManager` imports in the Tiles connector. |
| Lazy hierarchy pages and bounded traversal | Fixture tests cover early stop, page limits, incomplete hierarchy, unsafe ranges, and missing nodes. Real Autzen and SoFi hierarchy reads passed without full object downloads. |
| Deduplicate node requests | Duplicate keys in one batch collapse to one point preparation; cross-call resource deduplication remains a T8 provider responsibility. |
| Public prepared data path | Uses `CopcNodeSource.loadPreparedNodeData()` for all nodes. No `/cesium` fallback, copied decoder, point buffer rehydration, or duplicate CRS code. |
| Cancellation and source lifecycle | Unit tests assert signals reach hierarchy and point methods, connector close aborts local work, owned context close is idempotent, and stale generations are rejected. |
| Actual attributes and precise coordinates | Both datasets return position/intensity/classification on both backends; Autzen also returns RGB while SoFi omits absent RGB. ECEF stays the exact Adapter Float64 buffer. |
| Packed package contract | Adapter candidate was packed from `c5b563b3d0c5743b8030a79eca8c820421c9d4a7` and installed by tarball path in a clean consumer. Node ESM and strict Bundler-mode declarations passed. Strict NodeNext exposes upstream TS2834 declaration errors; see the compatibility matrix. |

## Real browser evidence

Autzen was 81,123,042 bytes with SHA-256
`db2d56cdfa058bffccdc5d6019dae2fc9c6a551df10a5523c06c76a3e25a27fa`; the
file stayed in `/private/tmp`. `validate:adapter-integration` passed for both
backends in Chromium:

- `copc-js`: node `4-11-2-0`, 5,122 points, 6 COPC Range GETs / 164,880 bytes.
- Rust/WASM: same node and points, 7 COPC Range GETs / 101,455 bytes; WASM and
  worker asset reads are separate from COPC ranges.
- Both outputs passed Khronos glTF and CesiumGS 3D Tiles validators without
  errors/warnings and rendered in Cesium and Three.

The SoFi tests passed with both `copc-js` and Rust/WASM: the first hierarchy
response contained 2,599 nodes and 111 child-page references; three selected
nodes at levels 2–4 loaded with exact hierarchy point counts. `copc-js` used
8 Range GETs / 422,669 bytes; Rust/WASM used 9 / 359,053 bytes, including
test-harness repeats. The browser could not read `Content-Range`, so both
used Adapter's `head-fallback` policy.

No File/Blob, real named Extra Bytes, explicit vertical grid,
complete octree, or production multi-node LOD result is claimed. The public
Adapter candidate supports configured Extra Bytes on `copc-js`; Rust/WASM
rejects non-empty Extra Bytes requests. See the
[API compatibility matrix](./adapter-api-compatibility.md).

## Adapter #383 follow-up

The public renderer-neutral source methods, node/page types, source and
transform generations, cancellation, and A-shaped point preparation are now
available in the packed candidate and exercised by Tiles. Remaining notes for
[Adapter issue #383](https://github.com/mors119/copc-adapter/issues/383):

1. Publish a release with `/core`; the immutable npm `0.6.0` artifact does not
   include this API, although the source-built candidate's manifest says
   `0.6.0`.
2. Fix declaration imports so strict `NodeNext` consumers can typecheck the
   packed `/core` entry.
3. If full Tiles traversal needs culling before point decode, review a minimal
   Adapter-owned conservative transformed-cell-bound contract. Tiles will not
   treat the current decoded-point `ecefBounds` as that bound.
4. No read-only E cache view is exposed. This is not required for the A
   baseline; if Tiles later uses E, expose retained ECEF Float64 and prepared
   height Float64 through a narrow public view instead of rehydrating A.
