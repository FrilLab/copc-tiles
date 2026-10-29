# T5 — Tileset bounds and geometric error

`createExplicitTileset` builds a standards-based 3D Tiles 1.1 explicit
hierarchy from complete source-neutral node records and caller-supplied
conservative WGS 84 ECEF axis-aligned bounds. It reads hierarchy metadata only
and does not request or decode point payloads.

Each tile uses a local, zero-centered box and one translation to its ECEF
bounds center. A child translation is relative to its parent tile origin. GLB
content is addressed through UTF-8 hex encoding of the node key, so source keys
cannot become paths. Empty nodes have no content URI; `ADD` refinement keeps
non-empty point sets from parent and child nodes visible together.

The geometric-error policy is the largest child half-diagonal or descendant
error. This is a conservative spatial-cell coverage proxy in metres, not an
estimate of point density or visual error. It is monotone toward the root and
does not use decoded point data. Degenerate axes receive a 1 mm minimum half
extent. Input node count and accumulated point count have configurable, hard
bounds.

The module rejects incomplete child discovery, disconnected or cyclic
hierarchies, invalid octree coordinates, unsafe integers, non-finite or
non-conservative bounds, and resource-limit violations. It does not infer
bounds from the Adapter, transform source-CRS bounds, or claim that fixture
bounds came from a COPC file. Adapter 0.6.0 does not expose the complete
public per-node ECEF-bound/provenance contract required for that integration;
the gap is tracked in Adapter [issue #383](https://github.com/mors119/copc-adapter/issues/383).
Adapter [PR #391](https://github.com/mors119/copc-adapter/pull/391) is merged
in upstream source but is not in the published 0.6.0 package. Its available
source-cell bounds are expressed in COPC CRS, and bounds over decoded points do
not establish a transformed conservative bound for an undecoded cell. Neither
can stand in for a parent ECEF volume that must keep undiscovered descendants
traversable without a reviewed transform-aware bound contract.

Fixture verification:

- `npm run validate:tileset` runs hierarchy/bounds/security tests and the
  CesiumGS 3D Tiles Validator against a generated tileset and GLB content.
- `npm run typecheck` checks the exported TypeScript implementation.

The one-node Autzen browser wrapper uses the encoder origin and transform, its
actual decoded point bounds, and a non-zero root geometric error equal to the
measured bound half-diagonal. This allowed Cesium's normal screen-space
selection to request the real GLB. It is only a placement/culling check for one
decoded node; it does not validate conservative bounds for an undecoded COPC
cell or the geometric-error progression of a real COPC hierarchy.
