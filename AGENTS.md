# COPC Tiles repository instructions

- Source-neutral 3D Tiles 1.1 generation and resource serving; the standalone repository owns these contracts.
- Keep the COPC Adapter dependency optional and one-way: Tiles may use public `@frillab/copc-adapter/core`, Adapter must never depend on Tiles.
- Never copy COPC hierarchy, LAZ, CRS, vertical datum, or decoding internals from Adapter.
- Preserve the public npm package name `@frillab/copc-tiles`, exports, compatibility range, and all existing contract tests.
- Validate precision, bounds coverage, malformed resources, lifecycle and cleanup, Cesium/Three compatibility, and packed external consumers.
- A new feature issue must be fully implemented and validated in its own PR; do not leave undocumented follow-up tasks for the same acceptance criteria.
- Do not publish, tag, or overwrite a release without explicit maintainer approval.
- Historical design and migration notes in `docs/` may mention the old monorepo. Treat the current standalone README and CI as authoritative.
