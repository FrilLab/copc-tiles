# T2 node access

## Scope

`TileNodeReader` owns bounded lookup of explicitly requested node keys and
bounded point-read concurrency. It does not select nodes from a camera, invoke
Direct `NodeSelector`, or preload the whole hierarchy. The fixture source and
the Adapter bridge both implement the same source-neutral `TileNodeSource`
contract.

The reader follows opaque page references returned by the source. It loads
pages until it finds every requested key, reaches a configured bound, or the
loaded hierarchy proves the key absent. It does not parse an Adapter-specific
key format. Duplicate keys in one request are read once. Node payloads are
requested only after all keys resolve, so a partial key lookup does not cause
partial point decoding.

`childrenComplete` is retained from each hierarchy record. If a key is missing
and any loaded record reports incomplete child discovery, the reader returns
`INCOMPLETE_HIERARCHY`; it does not infer a leaf or report a proven absence.

## Public Adapter 0.6.0 bridge

The optional `CopcAdapterNodeSource` is typed against a structural subset of
the public `CopcSource` API. A compile-time assertion checks that
`CopcSource` from `@frillab/copc-adapter/cesium` satisfies that subset. The
structural bridge imports no Adapter runtime module or private path.

The bridge calls `loadPreparedPointData` when that public method exists. That
path aliases the prepared A buffers through T1 and supplies a generation and
CRS/vertical provenance callback. If fused preparation is unavailable, the
bridge can call the public point-buffer or point-view APIs, but requires an
application-supplied preparation callback. The point-view path also requires
an application-supplied decoder. These callbacks must use public Adapter
capabilities and return validated `TilePointView` data. The Tiles package does
not duplicate LAZ decoding, Range reads, or coordinate transforms.

`createCopcJsAdapterNodeSource` is the optional integration factory for the
public `@frillab/copc-adapter/cesium` entrypoint. When fused preparation is
absent, it dynamically imports the public
`transformPointBufferToPreparedPointData` helper and maps its A buffers into
the source-neutral view. This renderer-entrypoint fallback is isolated from
the engine initialization graph; a renderer-neutral public preparation API
is still preferable and remains part of the proposal below.

Public Adapter point-load methods accept `AbortSignal`. Hierarchy page loading
does not: the bridge checks cancellation and generation before and after the
page request, so it stops follow-on work but cannot interrupt an in-flight
Adapter hierarchy read. Closing a bridge aborts its own point operations; it
calls Adapter-wide cancel/destroy methods only when it owns that source.

## Current bounds

Default limits are 512 hierarchy pages / 64 MiB of hierarchy ranges, 500,000
hierarchy records, 512 requested nodes, 2,000,000 points per node, 4,000,000
points per batch, 64 selected extra dimensions, 256 MiB of point-data ranges
per batch, 384 MiB of decoded views per batch, and four concurrent node reads.
Every limit can be lowered or raised up to a hard cap. These are defensive
defaults, not performance measurements.

The point-data byte and point-count bounds are checked before point reads. The
decoded view byte bound is checked after the source returns its arrays; source
implementations must honor the node and field request bounds while preparing
those arrays.

## Acceptance mapping and limits

| Issue #2 criterion | Evidence / status |
| --- | --- |
| Request node keys without Direct `NodeSelector` or `StreamingManager` | Implemented in `src/source/tileNodeReader.ts`; repository scan shows neither is imported. |
| Lazy hierarchy pages and bounded traversal | Implemented; fixture tests assert early stop, page bounds, incomplete hierarchy and safe ranges. |
| Avoid duplicate requests | Duplicate requested keys in a batch are collapsed; exact fixture point-call count is one per unique key. Cross-call concurrent deduplication is a T8 resource-provider concern. |
| Prepared and buffer/view outputs | Public fused reads are preferred; `createCopcJsAdapterNodeSource` provides a dynamic public-helper fallback. Real `copcJsBackend` output was tested with Autzen; Rust backend remains untested. |
| Cancellation and generations | Point reads receive a composed `AbortSignal`; source/transform generation is checked before and after awaits. Adapter hierarchy page reads cannot be aborted in flight. |
| Damaged Range and malformed hierarchy | Errors propagate without retry; malformed/unsafe hierarchy ranges fail before node data reads. The real Autzen check used a local bounded HTTP Range endpoint and confirmed six requests / 205,026 bytes rather than downloading the 81,123,042-byte object. |

## Real Autzen evidence

On the campaign machine, the public Adapter 0.6.0 `copcJsBackend` opened the
public Autzen sample (`https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz`;
81,123,042 bytes; SHA-256
`db2d56cdfa058bffccdc5d6019dae2fc9c6a551df10a5523c06c76a3e25a27fa`) using
local HTTP Range responses. To rerun the browser check, provide the verified
file path with `COPC_TILES_AUTZEN=/path/to/autzen-classified.copc.laz`.
The Tiles reader
resolved hierarchy pages and requested node `5-8-6-0` (6,529 points) under
the configured 8,192-point / 2 MiB point-data limits. Available fields were
`position`, `rgb`, `intensity`, and `classification`; returned samples were
compared with the public Adapter point view. Six Range requests transferred
205,026 bytes. The public buffer preparation helper produced ECEF Float64
coordinates; source CRS was retained as unverified WKT and vertical datum as
unknown. The encoded 151,650-byte GLB passed Khronos validation with zero
errors and warnings. Its test-only one-node wrapper passed the CesiumGS
validator and was rendered in both browser consumers.

This does not verify the full COPC hierarchy, on-demand COPC-to-resource
generation, or production multi-node LOD. Actual preparation used the public
`/cesium` entrypoint because a fused prepared-point method was not present in
this backend instance. No Adapter internals were imported.

## Adapter issue #383 proposal

The current integration is pinned to the only verified package release,
`0.6.0`; Adapter PR #391 is open and cannot be used as a released contract. The
minimal remaining public contract for full multi-node tiles is tracked in
[Adapter #383](https://github.com/mors119/copc-adapter/issues/383):

1. Expose a transform-aware conservative ECEF bound for each undecoded
   hierarchy cell, or a minimal adapter-owned operation to derive that bound
   under the active horizontal/vertical transform. A bound over decoded points
   cannot keep undiscovered descendants traversable.
2. Attach stable source identity and transform generation to hierarchy pages,
   node preparation and bound results, and reject stale results after source or
   transform changes.
3. Propagate `AbortSignal` through hierarchy page reads as well as point reads.
4. Publish named hierarchy/node/page types and a renderer-neutral A prepared
   node operation. These are needed for a stable packed connector; experimental
   E buffers and named extra dimensions are optional for an initial A baseline.

No Adapter files or issues are changed by this campaign.

Adapter PR [#391](https://github.com/mors119/copc-adapter/pull/391) proposes a
renderer-neutral `./core` node-source API, but it is not merged or published.
The current connector remains pinned to the verified `0.6.0` public exports.
The proposed API's decoded-point ECEF bounds do not supply conservative ECEF
cell bounds for descendants that have not been read, so it does not by itself
remove the production hierarchy/culling blocker.

## Evidence boundary

Tests use deterministic source fixtures and structurally compatible mocked
Adapter sources, plus the bounded real Autzen/copc-js run above. Type tests
compile against the published public 0.6.0 package types. This verifies one
real public backend path, not the Rust backend, experimental E cache, full
production tileset hierarchy, or in-flight hierarchy-page cancellation.
