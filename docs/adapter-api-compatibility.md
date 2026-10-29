# Adapter API and compatibility audit — 2026-10-29

## Versions that were actually inspected

The Tiles working tree is based on merge commit
`dba0d8db091f23bdb811d0c8d3b6a18f7a59bfc0` (PR #14). The upstream Adapter
mainline is at `c5b563b3d0c5743b8030a79eca8c820421c9d4a7`; PR
[#391](https://github.com/mors119/copc-adapter/pull/391), head
`005fe49b3ae6e27fa415abc1481a2923f3c39e9d`, merged at that commit.

The latest published Adapter version and the version in the packed consumer
test are both `@frillab/copc-adapter@0.6.0`. Its registry integrity is
`sha512-hGIkMUemivbJ6vv2rw+CZv71EwtIHdyHjuoLEuTmsErQPn9SUng9Zl7QJetf7u3DRxfAWn/ud4sBl0l4NJwl7w==`.
The published `exports` map contains `.`, `./cesium`, and `./three`. Importing
`@frillab/copc-adapter/core` from that package fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED`.

PR #391 adds a renderer-neutral `./core` export to the Adapter repository's
`packages/package.json`, including `CopcContext`, `CopcNodeSource`, a lazy
`HierarchyLoader`, `loadPreparedNodeData()`, source/transform generations,
transform-plan provenance and cancellation. This is merged source, not a
published package that Tiles can install. The `packages/package.json` still
identifies itself as version `0.6.0`, while the registry's immutable 0.6.0
tarball has no `./core` export. No future Adapter release number is assumed.
Adapter issue [#383](https://github.com/mors119/copc-adapter/issues/383)
remains open pending packed compatibility and separate Tiles integration.

## API inventory used by this repository

The optional connector imports only the public `/cesium` subpath from the
published 0.6.0 package. The source-neutral engine does not import Adapter
runtime code. No `node_modules/@frillab/copc-adapter/packages/**` or other
private path is used.

| Import / operation | Public path and version | Input, output and ownership | Cancellation / lifecycle | Evidence and limit |
| --- | --- | --- | --- | --- |
| `copcJsBackend.open()` | `@frillab/copc-adapter/cesium`, `0.6.0` | HTTP URL and backend options produce a public `CopcSource`. | Source exposes `destroy()`; connector ownership is explicit. | Real Autzen local Range and public SoFi HTTP source opened. File/Blob and Rust backend were not tested. |
| `CopcSource.getRootHierarchyPage()` / `loadHierarchyPage()` | Same public subpath, `0.6.0` | Page and node records are returned by public source methods; the page/node record types are structurally inferred rather than exported by name. | `loadHierarchyPage()` has no `AbortSignal` option in 0.6.0. Tiles can stop consuming the result and reject stale generations, but cannot cancel an in-flight hierarchy read through this API. | Autzen node lookup passed. SoFi returned 2,599 hierarchy entries at levels 0–7 and 111 child-page references in its first page. The full tree was not traversed. |
| `CopcSource.loadPointDataBuffer()` / `loadPointDataView()` | Same public subpath, `0.6.0` | Requested standard fields are supplied using public `createCopcPointFieldSelection()`. Buffer data is passed to the public preparation helper; Tiles creates read-only views and does not mutate Adapter buffers. | Point-load options accept `AbortSignal`; the connector composes a request signal with its own close signal. | Real copc-js node content decoded on Autzen and SoFi. Three SoFi node keys at levels 2, 3 and 4 returned the exact hierarchy point counts. Rust was not tested. |
| `transformPointBufferToPreparedPointData()` | Same public subpath, `0.6.0` | Public source metadata and point buffer produce A-shaped prepared data with ECEF Float64 coordinates and available standard fields. | Synchronous preparation after the cancellable point read; no public source/transform generation is attached to the result. | Used by the optional connector. It is renderer-subpath coupled; 0.6.0 has no renderer-neutral `/core` import. |
| `createCopcPointFieldSelection()` | Same public subpath, `0.6.0` | Requests position, RGB, intensity and classification where the dataset exposes them. | Not applicable. | Autzen exposed all four; SoFi exposed position, intensity and classification but no RGB. Named extra dimensions are not selectable through the verified path. |
| Source / transform provenance | Caller-supplied Tiles context, not an Adapter 0.6.0 result contract | Tiles preserves opaque source identity, caller generation, source WKT and height status. Autzen and SoFi WKT is marked unverified; vertical datum is unknown. | Tiles rejects its own stale generation after source close/switch. | It cannot observe an Adapter transform-plan change or prove a vertical correction from the 0.6.0 source. |
| Conservative bounds for an undecoded node | No suitable public API in 0.6.0 | COPC cube bounds are source-CRS values. Point bounds can be measured only after decoding the node. | Not applicable. | **Release blocker for production hierarchy/culling.** No safe ECEF cell envelope is available for arbitrary/nonlinear CRS and vertical transformations. |
| Experimental E point-cache view | No public API in 0.6.0 | No verified ECEF Float64 + prepared-height Float64 public node view. | Not applicable. | E is fixture-only; no private cache import or Adapter E default change is made. |

The tested connector API compatibility is therefore limited to bounded
copc-js node reads and A-shaped preparation using `/cesium`. It is not a
complete hierarchy-to-tileset provider and does not establish multi-node
culling bounds, implicit availability, or renderer LOD.

## What merged Adapter PR #391 adds—and does not add

At upstream commit `c5b563b3d0c5743b8030a79eca8c820421c9d4a7`, the package
source has a public `./core` export with:

- `createCopcContext()` source lifetime management, source and
  transform generations, immutable `CoordinateTransformPlan` provenance,
  public copc-js/Rust selection, selected attributes, and prepared A output.
- Abortable `loadPreparedNodeData()` and a lazy hierarchy query API. A query
  signal can detach a caller promptly; an already shared hierarchy page read
  may continue, and closed/stale source results are rejected.
- `getNodeCellBounds()` and `getCopcHierarchyCellBounds()` in the source COPC
  coordinate system. The contract explicitly says these are **not ECEF
  bounds**. Prepared ECEF bounds enclose decoded point content only.

The new API removes several 0.6.0 gaps, but it does not provide a conservative
ECEF bound for an undecoded COPC cell after arbitrary coordinate and vertical
transforms. The separate Tiles integration must still decide whether to
require a reviewed transformed-cell-bound contract or use a documented
root-only/decoded-node policy. This repository does not infer or manufacture
such bounds.

## Runtime, CORS and diagnostics findings

- The SoFi object returned `206` for every ranged GET and `200` for HEAD. The
  browser could read `Content-Length`, but `Content-Range` was not exposed to
  JavaScript. The test therefore used Adapter's existing
  `rangeValidation: 'head-fallback'` policy. This does not prove the requested
  offset from a readable `Content-Range`; strict validation cannot be used by
  this browser origin with the current response headers.
- Tiles adds no URL logging. A mocked network failure through published
  Adapter 0.6.0 was tested with sentinel username, password and signed-query
  values. The resulting `CopcBackendError` contained the source host and path,
  but none of those credential/query sentinels. The host/path can still be
  sensitive in private deployments, so applications should review their own
  error logging policy. The opt-in browser test also omits source URLs from
  normal output and redacts URLs from surfaced test errors.
- The connector accepts a caller-supplied source; Tiles does not provide a
  hostname allowlist or proxy policy. Applications that accept source URLs
  from untrusted users need to apply their own network-access policy.
- The Tiles connector does not implement a second HTTP Range reader, LAZ
  decoder, or CRS/vertical transformation path. It uses the Adapter's public
  fetch, decode and preparation methods.

## Packed consumer checks

The packed Tiles tarball imported and type-checked from a clean consumer with
no Adapter installed. The optional connector subpath also resolved as ESM and
TypeScript without statically loading Adapter. Its real call path needs the
optional peer.

The Adapter 0.6.0 `/cesium` ESM entrypoint imports at runtime when its optional
`cesium` peer is not installed; clean renderer consumers pass when the declared
peer is installed. TypeScript `NodeNext` checking of the Adapter 0.6.0
`/cesium` declarations fails on extensionless relative imports (TS2834). The
same declarations pass with `moduleResolution: bundler` or `skipLibCheck`.
Tiles' own root and `adapter/copc-js` declarations pass strict `NodeNext`
checking. This Adapter declaration issue is another reason the exact
published package is not a stable full-integration contract.

No Adapter files were changed in this campaign. Keep #383 open until a new
version is published, the packed declarations and runtime API are rechecked,
and multi-node Tiles bounds/cancellation/rendering evidence passes.
