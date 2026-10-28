# Agent Instructions — COPC Tiles

Repository: `FrilLab/copc-tiles`. This is an **independent optional package**, not a folder or entrypoint within `mors119/copc-adapter`.

## Mission and boundaries

- Implement the scoped T1–T12 roadmap in the [README](README.md) and corresponding issues #1–#12. Preserve the original issue acceptance criteria unless a separately reviewed decision supersedes them.
- The dependency direction is **@frillab/copc-tiles → @frillab/copc-adapter**. Never introduce a required, optional, or peer dependency from Adapter to Tiles.
- Use only verified **public** Adapter exports and an explicit supported-version contract. Do not reach into `node_modules/@frillab/copc-adapter/packages/**`, `packages/core/**`, undocumented deep imports, or copy adapter internals to bypass an API.
- When Adapter lacks a necessary read-only hierarchy/node/point/cache view, document the exact missing capability and propose a minimal upstream interface change in a **separate Adapter issue/PR**. Do not change Adapter internals as part of a Tiles PR.
- Direct Adapter's `.`, `/cesium`, `/three` imports, defaults, binary/API compatibility, existing performance and package footprint must remain unchanged.

## Engineering contracts

- Target interoperable **3D Tiles 1.1** and **glTF 2.0 POINTS**. No proprietary Tiles extensions, renderer forks, bundled dataset or unreviewed API promises.
- Tiles owns Tiles LOD/requests; the Adapter's Direct `NodeSelector` is **not** the Tiles scheduler. Reuse COPC hierarchy, range read, LAZ/CRS preparation where public contracts permit.
- Honor A cache and experimental E (interleaved ECEF Float64 + prepared Float64 height). E must not require full `PreparedPointData` rehydration or forced ECEF-to-Geographic inversion for routine Tiles encoding.
- Preserve read-only buffer ownership, point/node identity, transform generation, source CRS, vertical-datum uncertainty, explicit manual/validated corrections, and selection of actual available attributes.
- Fail closed on malformed data, unsupported CRS/units/precision, unsafe integers, missing attributes, invalid binary lengths, stale generations and unbounded tile work. No silent zeroes, precision truncation or fabricated metadata.
- Preserve cancellation, source switching and bounded ranges/cache/Workers. Do not fetch full COPC objects or materialize the entire octree by default.
- Keep Cesium and Three integration standards-based, with identical tile bytes across consumers where intended.

## Package isolation

- Publish as a separate optional package only when reviewed. Importing/installing Adapter alone must not pull Tiles or its renderer/encoder dependencies into install or runtime graphs.
- Prefer an explicit compatible Adapter version range, supported by packed-package tests; avoid resolving multiple incompatible Adapter copies.
- Do not claim package-size improvement based only on tree shaking; test packed tarballs, lockfile dependencies and representative bundled consumers.

## Workflow

1. Read README, issue and linked original upstream issue; identify dependencies and public Adapter contract before implementation.
2. PLAN: write minimal scope, compatibility and acceptance mapping; if a missing public Adapter API blocks work, report the blocker rather than importing private files.
3. IMPLEMENT: small focused modules and PRs; maintain additive tests and versioned fixtures. No speculative API migrations.
4. VERIFY: unit/type/build, numeric & validator conformance, Cesium/Three browser E2E, malformed-input/security, cancelled requests and packed consumer coverage appropriate to the issue; report skipped or unavailable checks honestly.
5. REVIEW: document changes, results, risks, pending limitations and upstream API requirements. Stop at **AWAITING MAINTAINER REVIEW**. Never merge, publish, release or auto-close issues without explicit maintainer approval.

## Quality and documentation

- All GitHub issues, commits, PRs and code comments in English; README may be Korean.
- Never weaken tests, silently skip checks or increase timeouts to hide failures. Investigate actual root causes.
- No secret tokens, signed URLs, copyrighted source grids, huge COPC samples, generated binaries, `node_modules`, build outputs or unapproved benchmark artifacts in git.
- Preserve reproducible source/precision/performance evidence and document its hardware, browser, dataset, environment and limits. Do not invent benchmark results.
- Keep one purpose per PR. After approved merge and verification, close its issue only when acceptance is fully met; close any parent only after every required child is complete.
