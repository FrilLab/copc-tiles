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
bridge imports no Adapter runtime module and no Adapter private path.

The bridge calls `loadPreparedPointData` when that public method exists. That
path aliases the prepared A buffers through T1 and supplies a generation and
CRS/vertical provenance callback. If fused preparation is unavailable, the
bridge can call the public point-buffer or point-view APIs, but requires an
application-supplied preparation callback. The point-view path also requires
an application-supplied decoder. These callbacks must use public Adapter
capabilities and return validated `TilePointView` data. The Tiles package does
not duplicate LAZ decoding, Range reads, or coordinate transforms.

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
| Prepared and buffer/view outputs | Adapter bridge supports public fused prepared reads; buffer/view paths use explicit callbacks. Mocked public-shape tests pass. Actual copc-js and Rust backend outputs have not been run. |
| Cancellation and generations | Point reads receive a composed `AbortSignal`; source/transform generation is checked before and after awaits. Adapter hierarchy page reads cannot be aborted in flight. |
| Damaged Range and malformed hierarchy | Errors propagate without retry; malformed/unsafe hierarchy ranges fail before node data reads. No real HTTP Range endpoint has been exercised. |

## Adapter issue #383 proposal

The current connector does not justify changing Adapter. If maintainers want
the remaining capabilities, the minimal public contract to review in
[Adapter #383](https://github.com/mors119/copc-adapter/issues/383) is:

1. Add `AbortSignal` to hierarchy-page load options and propagate it into the
   existing range request.
2. Expose a read-only experimental E node result containing node key,
   source/transform generation, interleaved ECEF Float64, prepared Float64
   height, selected attributes, and optional already-retained Source or
   Geographic buffers. Missing optional buffers must be explicit; no E
   rehydration or ECEF inverse transform.
3. Add named per-node extra-dimension selection with exact typed-array
   semantics and explicit unsupported/missing-field results.
4. Publish named hierarchy node/page/subtree types if maintainers intend those
   shapes to be a supported connector contract. The current bridge infers
   compatible shapes from public method signatures rather than deep imports.
5. If callers need raw point-buffer fallback without an app callback, expose a
   renderer-neutral public preparation function. No renderer-coupled helper is
   imported by the Tiles engine in this implementation.

No Adapter files or issues are changed by this campaign.

## Evidence boundary

Tests use deterministic source fixtures and structurally compatible mocked
Adapter sources. Type tests compile against the published public 0.6.0 package
types. This verifies shape compatibility, not a real COPC read, backend decode,
HTTP Range behavior, or a production E cache path.
