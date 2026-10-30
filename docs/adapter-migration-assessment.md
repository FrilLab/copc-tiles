# Future Adapter monorepo migration assessment — 2026-10-30

This is a comparison, not a distribution decision. No repository migration or
Adapter change was performed. Migration remains a post-T12 option requiring a
dedicated reviewed PR.

## Transferable modules

These modules remain source-neutral and can move into a future optional Tiles
package, subject to import and build path changes:

- `src/input/tilePointView.ts`
- `src/geometry/tileLocalCoordinates.ts`
- `src/gltf/pointCloudGlb.ts`
- `src/implicit/octreeAvailability.ts`
- `src/tileset/explicitTileset.ts`
- `src/tileset/implicitOctreeTileset.ts`
- `src/resources/tileResourceServer.ts`
- `src/source/tileNodeSource.ts` and `src/source/tileNodeReader.ts`

The connector at `src/adapter/copcCoreAdapter.ts` is boundary code. It uses
only the public `@frillab/copc-adapter/core` entrypoint and maps
`CopcNodeSource` identity, generations, prepared A data, field availability
and cancellation to `TileNodeSource`. It contains no hierarchy parser, Range
reader, LAZ decoder, CRS implementation or cache conversion. Tests, fixtures,
browser consumers, validators, benchmark evidence and release documents must
move with these modules to preserve the T1–T12 acceptance record.

## Public API and dependency boundary

Adapter PR [#391](https://github.com/mors119/copc-adapter/pull/391) merged at
`c5b563b3d0c5743b8030a79eca8c820421c9d4a7`. The source-built package from
that SHA exposes `./core`, and its packed ESM import, strict Bundler-mode
declarations and browser build passed in a clean consumer. Its package label
is still `0.6.0`; the published npm `0.6.0` artifact has no `./core` export.
The candidate's strict `NodeNext` declaration check fails TS2834 because
relative imports in `dist/core.d.ts` omit `.js` extensions. See the
[versioned compatibility matrix](./adapter-api-compatibility.md) for the
artifact hash, exact contract and validation evidence.

Issue [Adapter #383](https://github.com/mors119/copc-adapter/issues/383)
remains open for a released, versioned API and declaration follow-up. A
decoded `ecefBounds` encloses only prepared points for that node. It is not a
conservative bound for undecoded hierarchy cells under nonlinear CRS or
vertical transforms. Tiles does not infer those cell bounds from corners or
decoded points; if full traversal requires them, propose a narrow public
Adapter operation separately.

The dependency direction stays one-way:

```text
Adapter Core ───────► optional Tiles connector
Direct Cesium/Three ─► no Tiles import
Tiles renderers ────► consumer renderer peers
```

Core must not re-export or runtime-import Tiles if Tiles later moves into the
Adapter monorepo. Adapter `.`, `/cesium` and `/three` must retain their current
defaults, APIs, dependency graph and performance.

## Distribution comparison

The current packed artifacts provide a baseline, not a final package choice.
For a same-machine install comparison, each tarball was installed into a new
directory with scripts disabled and `npm ls --depth=0` inspected. `du -sk`
reported Adapter-only at 6,696 KiB, Tiles-only at 376 KiB, and combined at
7,068 KiB for the current review tarball. Tiles-only installed no Adapter or
renderer peers because the Adapter peer is optional. The combined install
needed `--legacy-peer-deps` because the tested source candidate is labeled
`0.6.0`, below Tiles' reserved peer range.

| Model | Observed package and runtime effect | Release and compatibility cost |
| --- | --- | --- |
| **A. Optional `@frillab/copc-adapter/tiles` subpath** | The current Tiles tarball is about 79 kB packed / 293 kB unpacked. Embedding its modules in Adapter would add those files to Adapter tarballs, including Direct-only installs. That naive layout fails the current Adapter-only install-isolation gate unless another packaging design proves no Tiles files or dependencies are installed. The root bundle is 30,879 bytes raw / 9,173 gzip and does not load its connector. | Could coordinate one release surface, but every Adapter release and Direct isolation audit would include Tiles. `/tiles` must stay outside `.`, `/cesium` and `/three`; a compliant package layout, exact compatibility and release overhead remain to be measured. |
| **B. Separate `@frillab/copc-tiles` package from a shared monorepo** | Current installs were 6,696 KiB Adapter-only, 376 KiB Tiles-only, and 7,068 KiB combined. The packed Tiles consumer resolved the public Core ESM entry and built in Vite without Cesium or Three installed. The connector is a dynamic import of Adapter `/core`; actual browser integration passed with the packed candidate. | Keeps package versions, compatibility range, provenance and releases separate, while adding another package release workflow. The public Core version range must be based on a released and packed API, not the source candidate's `0.6.0` label. |

The current source candidate Adapter tarball is 638.1 kB packed / 2.3 MB
unpacked, but it does not contain this Tiles package. Therefore it does not
measure model A's exact tarball delta. The install measurements are disk
footprints from this environment and include filesystem allocation rounding;
they are not universal npm-size guarantees. The packed consumer used
`--legacy-peer-deps` because Tiles reserves `>=0.6.1 <1.0.0` while the source
candidate is mislabeled `0.6.0`; that check validates the API artifact, not a
released peer-resolution workflow. Do not choose a distribution model based
only on tree shaking or these source-candidate sizes.

Before choosing, compare both models with packed Adapter-only, Tiles-only and
combined consumers: installed footprint and lockfile, runtime bundle graph,
WASM and renderer dependencies, API compatibility, and release overhead. Keep
the distribution decision open until those measurements and T12 review are
complete.

## Migration gates

Before moving modules into Adapter, require:

1. A released public Core API with a supported-version contract and passing
   packed ESM and TypeScript checks, including NodeNext declarations.
2. A dedicated reviewed PR and import-graph audit proving no reverse or
   renderer dependency reaches Core, Direct `.`, `/cesium` or `/three`.
3. Full affected Adapter unit, type, browser and Direct performance
   regressions, plus packed Adapter-only, Tiles-only and combined consumers.
4. Preservation of numeric precision, official Tiles/glTF conformance,
   A/E cache ownership evidence, and Cesium/Three consumer tests.
5. Maintainer approval. Do not merge, publish, release or close issues as part
   of this assessment.
