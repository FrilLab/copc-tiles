# COPC Tiles implementation status

Last assessed: 2026-10-29. Tiles HEAD is
`dba0d8db091f23bdb811d0c8d3b6a18f7a59bfc0`, merged PR #14. The full
acceptance-by-issue record is in
[`release-audit-2026-10-29.md`](release-audit-2026-10-29.md).

## Current result

**CONDITIONAL release status.** The independent engine, fixture hierarchy and
encoder modules, official validators, packed Tiles package checks, and
bounded real copc-js node reads have passing evidence. Autzen and SoFi real
node content rendered in both CesiumJS and Three.js. The real renderers loaded
prebuilt one-node wrapper tilesets; this does not verify full on-demand COPC
hierarchy, conservative multi-node bounds or LOD.

The latest published Adapter is `@frillab/copc-adapter@0.6.0`, integrity
`sha512-hGIkMUemivbJ6vv2rw+CZv71EwtIHdyHjuoLEuTmsErQPn9SUng9Zl7QJetf7u3DRxfAWn/ud4sBl0l4NJwl7w==`.
Its public exports are `.`, `/cesium`, and `/three`. Adapter PR #391 has
merged at `c5b563b3d0c5743b8030a79eca8c820421c9d4a7` and adds a public
renderer-neutral API to upstream package source, but no published tarball
contains `/core`. Adapter issue #383 remains open. The current 0.6.0 contract
does not provide conservative ECEF bounds for undecoded source cells, stable
Adapter transform generations, or cancellable hierarchy-page reads. See
[`adapter-api-compatibility.md`](adapter-api-compatibility.md).

## T1–T12 status

Every issue remains open. A milestone is complete only when all issue
acceptance criteria pass with the required real-source, backend and consumer
evidence.

| Issue | Status | Current evidence | Remaining acceptance |
| --- | --- | --- | --- |
| [T1 #1](https://github.com/FrilLab/copc-tiles/issues/1) Input contract | Partial | `src/input/tilePointView.ts`; zero-copy A/E fixture views and strict field/identity validation; real A-shaped standard fields on Autzen and SoFi. | No public E cache or named Extra Bytes path; no Rust E evidence. |
| [T2 #2](https://github.com/FrilLab/copc-tiles/issues/2) Node reads | Partial | `src/source/tileNodeReader.ts`, Adapter connector; Autzen one node and SoFi three requested nodes at levels 2–4 with matching source node counts. | No full hierarchy; no Rust; Adapter 0.6.0 hierarchy reads cannot accept an abort signal; no adversarial real Range response. |
| [T3 #3](https://github.com/FrilLab/copc-tiles/issues/3) Precision | Partial | `src/geometry/tileLocalCoordinates.ts`; fixture transforms plus real ECEF round-trip errors below 0.000005 m. | Source CRS, datum and vertical correction remain unverified; no complete-cloud seam analysis. |
| [T4 #4](https://github.com/FrilLab/copc-tiles/issues/4) GLB | Partial | `src/gltf/pointCloudGlb.ts`; deterministic fixture output and real Autzen/SoFi GLBs pass Khronos validator. | Allocation profiling and all requested LAS field representations remain incomplete. |
| [T5 #5](https://github.com/FrilLab/copc-tiles/issues/5) Bounds / geometric error | Partial | `src/tileset/explicitTileset.ts`; fixture bounds and one-node real wrapper render with normal culling. | No conservative ECEF bound for undecoded COPC cells; no proven multi-node coverage, ADD semantics or screen-error policy. |
| [T6 #6](https://github.com/FrilLab/copc-tiles/issues/6) Implicit tiling | Partial | `src/implicit/octreeAvailability.ts`, `src/tileset/implicitOctreeTileset.ts`; sparse/empty fixture subtree validation. | No real COPC implicit tileset, subtree boundaries or network availability checks. |
| [T7 #7](https://github.com/FrilLab/copc-tiles/issues/7) Metadata | Partial | `src/gltf/pointCloudGlb.ts`; typed fixtures; real Autzen RGB/intensity/classification and SoFi intensity/classification in Three. | No named Extra Bytes, GPS Time/return-field matrix or 64-bit interoperability across renderers. |
| [T8 #8](https://github.com/FrilLab/copc-tiles/issues/8) Resource serving | Partial | `src/resources/tileResourceServer.ts`; route safety, LRU, cancellation, concurrency and generation fixture tests; same standard URL fetched by both renderers. | Real node decode is not invoked by tile-resource requests; no real camera-churn cancellation or File/Blob path. |
| [T9 #9](https://github.com/FrilLab/copc-tiles/issues/9) Cesium | Partial | Public `Cesium3DTileset.fromUrl`; real Autzen and SoFi point content fetched, decoded and rendered after camera movement. | Test wrapper is prebuilt and one content tile; no Direct comparison or actual multi-node LOD/refinement. |
| [T10 #10](https://github.com/FrilLab/copc-tiles/issues/10) Three | Partial | Public `3d-tiles-renderer`/Three; same SoFi GLB URL and bytes as Cesium; point/metadata visibility and tile cleanup. | One rendered tile only; no multilevel selection or complete consumer/version matrix. |
| [T11 #11](https://github.com/FrilLab/copc-tiles/issues/11) Standards/security | Partial | 68 unit tests; official glTF and CesiumGS validators pass fixtures and both real one-node artifacts; runtime audits clean. | Range truncation, real corruption, E/Rust/File, vertical transforms and active cancellation incomplete; five high development-only validator dependency advisories remain. |
| [T12 #12](https://github.com/FrilLab/copc-tiles/issues/12) Performance/package | Partial | Synthetic A/E medians and p95, real two-source observations, clean installs, tarball sizes and bundle graphs are recorded. | No Direct/on-demand/pre-generated comparison, full-pipeline repeated timings, peak browser memory/workers, real E or publish provenance workflow. |

## Verification summary

- `npm test`: 68 passed on Node 18.20.8, 22.23.4 and 26.12.1.
- `npm run typecheck`, `npm run build`: pass on Node 26; TypeScript build and
  typecheck also pass on Node 18.
- `npm run test:browser` without external sources: 2 passed, 2 optional real
  source tests skipped.
- `npm run validate:adapter-integration` with the local Autzen COPC: 1 passed.
- The opt-in SoFi test with
  `COPC_TILES_SECOND_COPC_URL=https://hobu-lidar.s3.amazonaws.com/sofi.copc.laz`:
  1 passed, including three requested node reads and both renderer smoke
  checks.
- Both real primary-node GLBs and wrapper tilesets: official Khronos and
  CesiumGS validators reported zero errors and warnings.
- `@frillab/copc-tiles@0.1.0` packed tarball: 73,876 compressed bytes,
  275,582 unpacked bytes; clean Tiles-only installation is 364 KiB. Clean ESM
  and strict NodeNext declaration tests
  passed without Adapter installed.
- Clean Adapter-only installation contained no Tiles. Tiles root bundle
  contained no Adapter or renderer inputs. Bundle and installation sizes are
  reported in [`benchmark-report-2026-10-29.md`](benchmark-report-2026-10-29.md).
- `npm audit --omit=dev`: zero findings. Full audit: five high findings in
  development-only validator/sharp dependencies; no unsupported validator
  downgrade or forced override was applied.

The optional integration's supported peer contract is exact Adapter 0.6.0,
but it is a bounded node connector, not a full production Tiles provider.
Adapter 0.6.0 `/cesium` ESM loads when its optional Cesium peer is installed;
its declaration file fails strict NodeNext checks on extensionless internal
imports, though it passes with bundler resolution or `skipLibCheck`. The Tiles
root and optional connector declarations pass strict NodeNext checks.

## Package and release readiness

- Package metadata: `@frillab/copc-tiles@0.1.0`, Apache-2.0, ESM, Node
  `>=18`; no required runtime dependency. Adapter `0.6.0` is an exact optional
  peer. No package has been published and no GitHub Release was created.
- The package builds and packs; ESM exports and declarations resolve in clean
  consumer installs. The npm package remains a review candidate, not a
  general-purpose real COPC-to-Tiles release.
- The development dependency graph has five high audit findings. The audit's
  available validator fix is a major downgrade to 0.4.1 and was not forced.
- No automated npm publishing/provenance workflow is present. Maintainers
  must review release provenance, version, release notes and package policy.
- See [`release-checklist.md`](release-checklist.md),
  [`benchmark-report-2026-10-29.md`](benchmark-report-2026-10-29.md), and
  [`adapter-migration-assessment.md`](adapter-migration-assessment.md).

## PR #13 review follow-up

PR #13 is merged. Its findings about child completeness, aborted in-flight
resource retry, malformed hierarchy handling, fused prepared-node fallback,
and the one-node Autzen origin/bounds alignment were addressed in merged code
and rechecked by unit or browser tests. The remaining issues listed above are
separate acceptance gaps; this audit does not close any issue.

**AWAITING MAINTAINER REVIEW**
