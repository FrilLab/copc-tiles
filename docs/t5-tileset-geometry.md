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
non-conservative bounds, and resource-limit violations. The packed Adapter
`/core` candidate supplies public node/page access, generations, transform
provenance, and decoded-point ECEF bounds. Those point-content bounds do not
establish a transformed conservative bound for an undecoded cell. The public
`getNodeCellBounds()` returns source-CRS bounds; the public point transformer
does not promise an interval bound when applied to cell corners. Tiles does
not use either corners or decoded points as an ECEF cell bound.

The primary Autzen source declares horizontal EPSG:2992 (NAD83 / Oregon GIC
Lambert, international feet) and vertical EPSG:6360 (NAVD88, US survey feet).
Its transform plan has no configured vertical grid and marks the vertical
conversion as a compatibility pass-through. A safe multi-node tileset needs
the bound to enclose the exact Adapter transform over every point in each
source cell. The required public operation is proposed in
[`adapter-383-bounds-followup.md`](./adapter-383-bounds-followup.md). Until
that API exists, the real Autzen path stops before creating tileset bounds.

Fixture verification:

- `npm run validate:tileset` runs hierarchy/bounds/security tests and the
  CesiumGS 3D Tiles Validator against a generated tileset and GLB content.
- `npm run typecheck` checks the exported TypeScript implementation.

The existing one-node Autzen wrapper uses the Adapter-returned decoded-point
bounds only for its already-decoded single content node. It is a renderer
placement check, not evidence for parent/child cell bounds or production LOD.
The wrapper is not used as a fallback for the missing undecoded-cell bounds.
See the [packed API compatibility matrix](./adapter-api-compatibility.md).
