# Release checklist

This checklist is for a maintainer after review. This campaign does not publish
or release the package.

- [ ] Review every T1–T12 acceptance result in `implementation-status.md`.
- [ ] Resolve the public Adapter API blockers in
  [Adapter #383](https://github.com/mors119/copc-adapter/issues/383), or approve
  a release scope that explicitly supports external `TileNodeSource` providers
  and discloses the incomplete real COPC hierarchy connector.
- [ ] Review the exact Adapter peer contract (`0.6.0`) and optional
  `adapter/copc-js` entrypoint.
- [ ] Review all changes and commits; do not close incomplete issues.
- [ ] Use Node `22.23.4` for the repository toolchain unless a newer major is
  separately verified; Node `26.12.1` failed compiling the current
  development-only `better-sqlite3@11.10.0` dependency on this machine.
- [ ] Run `npm ci`, `npm run typecheck`, `npm run build`, `npm test`,
  `npm run validate:gltf`, `npm run validate:tileset`,
  `npm run validate:implicit`, `npm run validate:resources`, and
  `COPC_TILES_AUTZEN=/path/to/verified-autzen.copc.laz npm run test:browser`,
  and `npm run bench:engine`.
  Install Chromium first with `npx playwright install chromium`; on Linux,
  install its system dependencies with `npx playwright install --with-deps chromium`.
  The browser run includes Cesium/Three fixtures and a real one-node Adapter
  render when the verified dataset is supplied. It does not replace the
  blocked real multi-node/on-demand acceptance checks.
- [ ] Run `npm audit --omit=dev` and decide how to address the development-only
  validator dependency advisories before release.
- [ ] Run `npm pack --dry-run --json`, then install the actual tarball in a
  clean consumer with and without the optional Adapter peer.
- [ ] Compare the packed standalone package with a candidate Adapter `/tiles`
  subpath, including lockfile/install footprint, runtime bundle graphs,
  renderer dependency isolation, API compatibility and release overhead.
- [ ] Verify the npm account, package access, provenance policy, version and
  release notes. Confirm the tarball contains no datasets, browser outputs,
  `node_modules`, or build/test scratch files.
- [ ] Publish only after explicit maintainer authorization.
