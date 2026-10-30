# Release checklist — 2026-10-30

This is a current review record for the Adapter `/core` integration. The
2026-10-29 package audit remains historical in
[`release-audit-2026-10-29.md`](release-audit-2026-10-29.md). No npm package was
published, no GitHub Release was created, and no issues were closed.

## Verified in this pass

- [x] Read repository instructions, README, implementation status, relevant
  Tiles issue criteria, Adapter issue #383 and merged Adapter PR #391.
- [x] Build and pack Adapter source commit
  `c5b563b3d0c5743b8030a79eca8c820421c9d4a7`; record its tarball SHA-256.
- [x] Replace the previous bridge with the public
  `@frillab/copc-adapter/core` connector and remove the old `/cesium` bridge.
- [x] Install the Adapter and Tiles tarballs in clean consumers. Verify public
  ESM resolution, strict Bundler-mode TypeScript declarations, and a Vite
  browser build. See [`adapter-api-compatibility.md`](adapter-api-compatibility.md)
  and the repository-only [`PACKED_CONSUMER_RECORD.md`](../PACKED_CONSUMER_RECORD.md).
- [x] Run `npm run typecheck`, `npm run typecheck:adapter-core`, `npm run
  build`, and `npm test` (66 passed). The test suite covers source close,
  cancellation, stale generations, actual attribute availability, exact named
  Extra Dimension selection, and BigUint64 buffer identity.
- [x] Run real-source Chromium integration with the packed Adapter candidate:
  Autzen and SoFi with both `copc-js` and Rust/WASM. Khronos glTF and CesiumGS
  Tiles validators reported zero errors/warnings for the tested real content.
- [x] Re-run the fixture browser suite and the real sources after adding
  retained point-view buffer accounting. SoFi prepared and encoded three
  hierarchy nodes at levels 2–4, including a stable parent/child pair; only
  the primary node was placed and rendered by the one-node wrapper.
- [x] Record per-run node preparation, GLB encoding, rendered-node timing,
  retained point-view buffer bytes and generated GLB bytes. Peak temporary
  memory and total retained browser/Adapter memory were not measured.
- [x] Measure clean Adapter-only, Tiles-only, and combined installs. Tiles-only
  installs no Adapter or renderer packages; exact sizes and the release
  candidate tarball checksum are recorded in `PACKED_CONSUMER_RECORD.md`.
- [x] Record candidate limits honestly: published Adapter `0.6.0` lacks
  `/core`; candidate strict NodeNext types fail TS2834; real named Extra Bytes,
  File/Blob and explicit vertical grids were not exercised.
- [x] Keep all T1–T12 issues open. Adapter #383 remains open for a released
  public contract and any reviewed transformed-cell-bound capability.

## Remaining before full COPC-to-Tiles support

- [ ] Adapter publishes a reviewed version containing `/core`, with strict
  NodeNext declaration imports fixed; rerun packed checks against that exact
  release and establish the supported version range.
- [ ] Review a public conservative transformed ECEF bound for undecoded cells
  if production traversal requires it. Decoded-point `ecefBounds` cannot serve
  as that bound.
- [ ] Connect production multi-node COPC reads to Tiles resource requests.
  Verify hierarchy completeness, sparse/empty nodes, subtree boundaries,
  geometric error, ADD semantics, bounded queues and request cancellation.
- [ ] Render live multi-node/refining sources in Cesium and Three with the same
  bytes and URLs. Verify source switching and cleanup during camera requests.
- [ ] Compare Direct COPC, on-demand Tiles and pre-generated Tiles using the
  same dataset and camera path; record repeated median/p95, transfer, CPU,
  browser memory, worker activity and cancellation results.
- [ ] Test real named Extra Bytes, File/Blob input, malformed real Range
  responses, supported CRS/vertical transforms and independent CRS reference
  data. Rust/WASM currently rejects non-empty Extra Bytes requests.
- [ ] Complete the intended browser and operating-system matrix. This pass
  covers Chromium on macOS arm64; Firefox, WebKit, Windows and Linux remain
  unverified.
- [ ] Reconcile the prior `npm audit` findings with supported validator
  releases; the audit was not rerun in this pass.

## Distribution and publication gate

- [ ] Compare an optional Adapter `/tiles` subpath with a separately published
  Tiles package from a shared monorepo using packed install and runtime graphs,
  renderer dependencies, API compatibility and release overhead. A naive
  Adapter tarball containing Tiles files fails the current Adapter-only
  install-isolation requirement. Keep the eventual distribution decision open
  until a compliant package design is measured.
- [ ] Maintainer approves package scope, version, README examples, changelog,
  provenance and release workflow.
- [ ] Run final packed consumer checks after all accepted changes. Do not merge,
  publish, release or close issues without explicit maintainer approval.

The candidate package targets Node `>=18`. This pass used Node `26.12.1`.
Normal `npm ci` failed to build development-only `better-sqlite3@11.10.0` in
this environment; `npm ci --ignore-scripts` followed by the documented Sharp
rebuild enabled the test suite. See
[`implementation-status.md`](implementation-status.md) for complete commands
and limitations.

**AWAITING MAINTAINER REVIEW**
