# Future Adapter monorepo migration assessment — 2026-10-29

This is an assessment only. No repository migration or Adapter change was
performed. Migration remains a post-T12 option and requires a dedicated,
reviewed PR.

## Transferable modules

The following modules are source-neutral and can move into a future optional
Tiles package with no algorithm rewrite, subject to import/build path changes:

- `src/input/tilePointView.ts`
- `src/geometry/tileLocalCoordinates.ts`
- `src/gltf/pointCloudGlb.ts`
- `src/implicit/octreeAvailability.ts`
- `src/tileset/explicitTileset.ts`
- `src/tileset/implicitOctreeTileset.ts`
- `src/resources/tileResourceServer.ts`
- `src/source/tileNodeSource.ts` and `src/source/tileNodeReader.ts`

They currently depend on web platform primitives, TypeScript types local to
Tiles and each other, not on Direct Cesium/Three renderers. The module graph
and clean bundle measurements found no cycle and no renderer package in the
Tiles root output.

The current public Adapter connector modules
(`src/adapter/copcAdapterNodeSource.ts` and
`src/adapter/copcJsAdapter.ts`) are boundary code, not core algorithms. Once a
published renderer-neutral Adapter source contract is supported, the
0.6.0-specific buffer/preparation fallback should be removed or retained only
as a separately versioned compatibility bridge. A future connector should
map `CopcNodeSource` identity, generation, prepared fields and cancellation to
`TileNodeSource`; it must not copy hierarchy, Range, LAZ or CRS code.

Tests, fixtures, browser consumers, validators, benchmark evidence and release
documents must migrate with the code. A migration that moves modules but drops
this evidence would lose the acceptance record.

## Public API and dependency boundary

Current published use is constrained to Adapter 0.6.0 public
`@frillab/copc-adapter/cesium` exports. Merged upstream commit
`c5b563b3d0c5743b8030a79eca8c820421c9d4a7` adds a source-side `./core` export
with `CopcContext`, `CopcNodeSource`, a hierarchy loader and prepared A output,
but the registry package remains 0.6.0 without that export. Issue #383 remains
open. A migration cannot assume the merged workspace API is installed by
consumers.

Even after a packed Adapter release, source-cell bounds in COPC CRS and ECEF
bounds over decoded points do not by themselves prove a conservative ECEF
bound for an undecoded source cell under nonlinear transforms. The future
Tiles connector needs a reviewed policy and evidence for culling bounds,
height corrections and generation. Do not solve this by importing Adapter
internals.

Keep the import graph one-way:

```text
Adapter Core  ─────►  optional Tiles package
Direct Cesium/Three ─► no Tiles import
Tiles renderers ─────► renderer peers used only by applications/tests
```

If Tiles modules live in the Adapter monorepo, Core must not re-export or
runtime-import the Tiles entrypoint. The Direct root, `/cesium`, `/three`,
their defaults, package graph and performance need their existing regression
gates.

## Distribution comparison

| Model | Install and bundle effect | API/release cost | Assessment |
| --- | --- | --- | --- |
| **A. `@frillab/copc-adapter/tiles` optional export** | If Tiles files are added to the Adapter tarball, every Adapter installation receives them, even when Direct users never import `/tiles`. Current Tiles candidate is 73,876 bytes compressed / 275,582 unpacked and adds 364 KiB in a clean install. A candidate Adapter tarball is still needed to measure deduplication and exact delta. Subpath bundling can remain lazy if the export graph is isolated, but that does not reduce npm install size. | One package/version can simplify coordinated releases and allow the internal connector to use Core directly. It also makes every Adapter release and package footprint review responsible for Tiles changes. The `/tiles` export must not be pulled into `.`, `/cesium` or `/three`. | Viable if the Adapter maintainers prioritize one release surface and accept the package growth. The optional path must remain a separate build entry. |
| **B. `@frillab/copc-tiles` package from a shared monorepo** | Preserves the measured standalone install: 73,876-byte tarball, 275,582 unpacked, 364 KiB installed; Adapter-only consumer remains 6,428 KiB with no Tiles files. Tiles root bundle was 30,879 bytes raw / 9,173 gzip, with no Adapter or WASM input. | Requires a separate package version, peer compatibility range, release notes, provenance and packed-consumer job. A small Tiles connector can use the monorepo's public Core package without adding a Core→Tiles dependency. | **Recommended**, provided the package is emitted separately from the shared repository and continues to pin/test the public Core API. It preserves the Direct Adapter install boundary and matches measured isolation. |

These measurements come from separately packed current artifacts. Model A's
package delta is an estimate based on the existing Tiles tarball, not an
observed Adapter `/tiles` tarball. No tree-shaking-only size claim is used.

## Recommendation and migration gates

Keep the separate `@frillab/copc-tiles` package as the distribution boundary,
even if its source later moves into a shared Adapter monorepo. Reconsider only
if maintainers value a single version/release surface more than keeping the
Adapter tarball and install graph unchanged. No repository layout change is
needed to make that decision today.

Before migration, require:

1. A reviewed, published Adapter public API with an explicit supported
   version and packed ESM/TypeScript consumer tests.
2. A dedicated PR with an import-graph audit that proves no reverse or
   renderer dependency reaches Adapter Core, Direct `.`, `/cesium` or `/three`.
3. Full affected Adapter unit, type, browser and Direct performance regressions.
4. Packed consumers for Adapter-only, Tiles-only and combined applications,
   with npm install size, runtime bundle, WASM and renderer peers measured.
5. Preservation of the T1–T12 precision, validator, malformed-input,
   multi-node Cesium/Three, cancellation and A/E benchmark evidence.
6. Maintainer approval. Do not merge, publish or close issues as part of this
   assessment.
