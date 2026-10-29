# T1 Tile input contract

## Scope and compatibility

T1 defines an internal, renderer-neutral point view for later Tiles work. Its
types have no Adapter dependency. The `PreparedPointDataAInput` structural
shape mirrors the fields consumed from A; an optional compile-time check uses
the public declaration for `@frillab/copc-adapter@0.6.0` to detect drift. The
Adapter remains optional for applications that provide another valid source.

The A view reads `PreparedPointData.world.coordinates` and, when explicitly
requested, the existing `source.coordinates`, `geographic.coordinates`, and
attribute arrays. These are read-only aliases: creating a view does not copy
point buffers, transform ECEF back to Geographic, fetch source data, or
rehydrate another cache layout. Tile code must treat all shared typed arrays as
immutable. Typed arrays cannot be made immutable by `Object.freeze`, so this is
an ownership contract documented on the internal API and checked by the
zero-copy identity tests.

The experimental E view accepts a Tiles-owned structural input with required
`ecef` and prepared-height buffers and optional independently retained Source
and Geographic buffers. It aliases those buffers directly. This structural
type does not import or promise compatibility with Adapter internals.

## Adapter integration blocker

The packed `0.6.0` public `/cesium` and `/three` entrypoints export the
A-shaped `PreparedPointData` and public streaming types. They do not export
`CompactEPointCacheNode`, an E cache reader, or a read-only node point view for
the experimental E cache. The experimental E storage therefore cannot be
integrated through a verified Adapter public API. Do not import its private
implementation or infer optional Source storage from a `sourceCompatibility`
property; that property is not part of the clarified E contract.

The remaining upstream contract is tracked in Adapter issue #383. PR #391 is
merged in upstream source but its API has not been published in a package; it
does not supply conservative transformed bounds for undecoded source cells.
An initial Tiles integration needs renderer-neutral prepared A node data with
stable source/transform generation and CRS/height provenance, cancellation on
hierarchy-page reads, and conservative transformed ECEF bounds for undecoded
hierarchy cells. Bounds over decoded points cannot keep unread descendants
traversable. E remains optional: if later exposed, its read-only node view may
include interleaved ECEF Float64 XYZ, prepared-height Float64, requested
attributes, and only already-retained Source/Geographic buffers. It must not
invoke Direct `NodeSelector`, rehydrate E to `PreparedPointData`, or perform
implicit re-decode / inverse transforms for unavailable optional buffers. No
Adapter files are changed here.

The public `CopcPointFieldSelection` supports position, RGB, intensity, and
classification. `CopcPointAttributes` can represent named extra dimensions as
Float64, BigInt64, or BigUint64 arrays, but the public streaming selection does
not request those dimensions by name. Tiles can preserve a supplied extra
dimension by exact name; acquiring it through the current public streaming
contract remains an upstream capability gap. The upstream proposal should add
named extra-dimension requests without changing existing defaults.

## View and selection rules

- ECEF is always required: interleaved WGS84 ECEF XYZ in metres, Float64, with
  exactly `pointCount * 3` values.
- `pointCount` is a non-negative safe integer. Source and Geographic are
  optional, independently requested Float64 XYZ triples. Prepared height is
  optional on the general view; E supplies it directly, while A has no
  separate contiguous height buffer to alias.
- Position is implicit in field selection and cannot be disabled. RGB requests
  all three Uint16 channels. Intensity is Uint16, classification is Uint8.
  Extra dimensions are requested by exact name and retain their Float64,
  BigInt64, or BigUint64 typed array without narrowing or conversion.
- A requested missing coordinate buffer or attribute is an error. A partial
  RGB tuple, wrong typed-array class, invalid length, invalid generation, or
  mismatched source identity is an error. Missing values are never filled with
  zero. BigInt arrays remain exact in the view; later encoders must support
  their declared representation or fail explicitly.
- Available but unrequested attributes are omitted from the view. The point
  identity is `(context.nodeKey, pointIndex)`; no synthetic point IDs are
  allocated.
- Context carries the opaque source identity, node key, transform generation,
  source CRS evidence (including unknown or unverified status), vertical datum
  evidence, applied height offset, and explicit manual / validated corrections.
  Identified CRSs need an identifier or definition, and a verified vertical
  datum needs an identifier. Every view creation checks source identity and
  transform generation against the caller's current expectation, rejecting
  stale work.

## Acceptance mapping

| Issue #1 criterion | Implementation |
| --- | --- |
| Renderer-neutral `TilePointView` and explicit node provenance | `src/input/tilePointView.ts`; `TileNodeContext` is separate from the point arrays. |
| A-shaped input uses prepared ECEF without copies | `createTilePointViewFromA()` aliases `world.coordinates`; requested Source, Geographic, and attribute buffers are also aliases. A compile-time compatibility assertion checks the shape against the public `PreparedPointData` declaration. |
| E uses ECEF / height buffers directly, with optional coordinates | `createExperimentalETilePointView()` aliases the structural input. Public Adapter integration is blocked and documented above. |
| Explicit field selection and missing-field policy | `TilePointFieldSelection`; requested absent fields throw `TilePointViewError`. |
| Identity, lengths, BigInt, and stale-generation checks | `test/tilePointView.test.mjs`. |

## Review limits

This contract does not define a Tiles scheduler, node hierarchy reader, GLB
attribute encoding, or stable package export. The E function proves the
zero-copy Tiles boundary against its declared input shape; it is not evidence
that a consumer can obtain that shape from Adapter `0.6.0`. T2 must use only
public Adapter hierarchy / node-read capabilities or document and propose the
specific missing capability before integration. T1 validates coordinate tags,
typed-array classes, lengths, and provenance without scanning every point
value; T3/T11 must validate numeric finiteness and precision before encoding.
