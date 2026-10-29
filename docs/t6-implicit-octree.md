# T6 — Implicit octree and subtree availability

`createImplicitOctreeTileset` emits a 3D Tiles 1.1 `OCTREE` root and binary
`.subtree` resources from a complete, source-neutral hierarchy. It sets
`availableLevels` from the deepest supplied node, uses coordinate templates
for both tile content and subtree resources, and returns subtree bytes by
their URL path. Empty hierarchy nodes remain tile-available while their
content-availability bit is zero.

Availability follows the official Morton Z-order per level. The subtree
binary contains a `subt` version-1 header, padded JSON and a padded binary
chunk. Bitstreams use the 3D Metadata least-significant-bit-first order, with
unused trailing bits zeroed and buffer-view offsets aligned to 8 bytes.
Tile and content availability cover the subtree's `subtreeLevels`; child
subtree availability covers the next global level. Constant availability is
used when every bit has the same value.

The implementation caps subtree depth at 6, nodes at 100,000 by default
(500,000 hard maximum), subtree resources at 10,000 by default (100,000 hard
maximum), and total encoded subtree bytes at 64 MiB by default (512 MiB hard
maximum). All limits can be lowered or raised within their hard bounds.
Hierarchy nodes must form one complete connected octree with unique keys and
coordinates. Each supplied conservative ECEF bound must fit the node's
regularly subdivided root cell. A mismatch fails closed.

The implicit root's one ECEF placement transform applies to descendants. The
returned `contentOriginEcef` is the Float64 origin to use when encoding every
content GLB under that implicit root; the encoder must enforce its existing
Float32 precision budget relative to this origin. This keeps one world
placement transform and avoids implying per-descendant transforms that
implicit tiling does not provide. Very large root extents can therefore fail
the Float32 position budget; use smaller independent implicit roots or the
explicit T5 hierarchy when tighter per-tile origins are required.

Fixture verification is `npm run validate:implicit`. It checks Morton indices,
bit offsets and lengths, empty content, fixed-size subtrees, URL templates,
hierarchy/bounds failures, configured work limits, and the CesiumGS 3D Tiles
Validator on a generated tileset with GLB content and binary subtrees.

The encoding follows the [CesiumGS implicit tiling specification](https://github.com/CesiumGS/3d-tiles/blob/main/specification/ImplicitTiling/README.adoc)
and its [availability indexing rules](https://github.com/CesiumGS/3d-tiles/blob/main/specification/ImplicitTiling/AVAILABILITY.adoc).

The public Adapter does not currently provide the conservative per-node ECEF
bounds and transform generation needed to establish those cells. No real COPC
octree is claimed; the required public capability is tracked in Adapter
[issue #383](https://github.com/mors119/copc-adapter/issues/383).
Adapter [PR #391](https://github.com/mors119/copc-adapter/pull/391) is merged
in upstream source but is not in the published 0.6.0 package. The source API
does not establish transformed conservative ECEF bounds for undecoded
descendants.
