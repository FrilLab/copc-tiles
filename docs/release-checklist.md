# Release checklist

This checklist records the 2026-10-29 audit. The package remains unpublished;
this campaign did not publish npm, create a GitHub Release, close issues, or
change account permissions. See the [full audit](release-audit-2026-10-29.md).

## Verified

- [x] Read repository instructions, README, all T1–T12 issue acceptance
  criteria, merged Tiles PR #13 review findings, current Adapter #383 state,
  and merged Adapter PR #391 implementation.
- [x] Record exact Tiles/Adapter commits and compare published Adapter 0.6.0
  with the merged but unpublished `/core` source API.
- [x] Record supported package engines and tested Node versions, renderer
  package versions and browser version.
- [x] `npm run typecheck`, `npm run build`, and `npm test` (68 passed) on the
  current Node 26 environment; unit tests also passed on Node 18.20.8 and
  22.23.4. Node 18.20.8 TypeScript build/typecheck passed.
- [x] Run the default browser suite: 2 passed, 2 optional real-source tests
  skipped when source paths were not configured.
- [x] Run real Autzen and opt-in SoFi browser tests on Chromium with public
  Adapter 0.6.0; both decoded actual COPC nodes and rendered real GLB points
  through Cesium and Three.
- [x] Run official Khronos glTF and CesiumGS 3D Tiles validation on fixtures
  and both real one-node wrapper artifacts; 0 errors and 0 warnings.
- [x] Pack and install Tiles/Adapter tarballs in clean consumers. Verify ESM
  imports, Tiles strict NodeNext types without Adapter, dependency trees,
  tarball/install size and minified bundle graphs.
- [x] Run `npm audit` and `npm audit --omit=dev`; distinguish five high
  development-only validator/sharp findings from zero runtime findings.
- [x] Record A/E synthetic benchmark, small repeated real-source measurements and
  missing Direct/on-demand/pre-generated comparisons in
  [`benchmark-report-2026-10-29.md`](benchmark-report-2026-10-29.md).
- [x] Keep all T1–T12 issues open.

## Required before claiming full COPC-to-Tiles support

- [ ] Adapter publishes a reviewed version with its public renderer-neutral
  node-source contract; repeat packed ESM and declaration checks against that
  exact release. Keep Adapter issue #383 open until separate Tiles proof.
- [ ] Decide and verify a conservative bound contract for undecoded nodes
  after supported horizontal and vertical transformations. Do not use global,
  guessed or decoded-point-only bounds as a substitute.
- [ ] Connect a real multi-node COPC provider directly to Tiles resource
  requests. Verify hierarchy completeness, exact content mapping, sparse and
  empty nodes, subtree boundaries, geometric error, ADD semantics and bounded
  queues.
- [ ] Render the live on-demand multi-node source in Cesium and Three through
  the same bytes/URLs. Check camera-driven refinement, zoom, cancellation,
  source switching, resource cleanup and geographic position.
- [ ] Compare Direct COPC, on-demand Tiles and pre-generated Tiles with
  equivalent source, camera path, density and style. Report repeated median,
  p95 and sample counts for cold/warm, CPU, browser memory, transfers, worker
  activity and cancellations.
- [ ] Finish real malformed Range/truncation and unsupported CRS/vertical
  transformation coverage. Do not add a Tiles-owned Range validation path.
- [ ] Decide whether the five development-only validator findings can be
  resolved through a supported validator release; do not force the audit's
  major downgrade to `3d-tiles-validator@0.4.1` without compatibility proof.
- [ ] Verify Windows/Linux/macOS package and browser support if those platforms
  are intended. Current browser validation covers Chromium only.

## npm publication gate

- [ ] Maintainer approves the final package scope, version, README examples,
  changelog and release classification.
- [ ] Decide distribution model using
  [`adapter-migration-assessment.md`](adapter-migration-assessment.md); the
  current recommendation is a separately installed Tiles package even if
  sources later share an Adapter monorepo.
- [ ] Establish and verify npm provenance and publishing workflow. No
  automated publishing/provenance workflow exists in this repository today.
- [ ] Review the final `npm pack --json` contents and clean consumer installation
  after all accepted code and documentation changes.
- [ ] Publish only with explicit maintainer authorization. Do not create a
  GitHub Release or close incomplete issues automatically.

The package candidate currently targets Node `>=18`; verified test versions
were Node `18.20.8`, `22.23.4` and `26.12.1`. The development-only
`better-sqlite3@11.10.0` dependency failed to build during a clean Node 26
development install in this environment. Use the recorded successful
toolchain until that development install is resolved.

**AWAITING MAINTAINER REVIEW**
