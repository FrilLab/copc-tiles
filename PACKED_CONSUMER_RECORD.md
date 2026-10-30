# Packed consumer verification record — 2026-10-30

Repository-only test record. This file is excluded from the npm package so the
Tiles tarball checksum is not embedded inside the artifact it checksums.

## Artifacts

| Package | Source | Tarball | SHA-256 | Size |
| --- | --- | --- | --- | --- |
| `@frillab/copc-adapter` candidate | `c5b563b3d0c5743b8030a79eca8c820421c9d4a7` | `frillab-copc-adapter-0.6.0.tgz` | `89b16b209496ff848c22405c99962bb167746aacbcac2415840dc6133f110838` | 638.1 kB packed / 2.3 MB unpacked |
| `@frillab/copc-tiles@0.1.0` | This reviewed worktree snapshot | `frillab-copc-tiles-0.1.0.tgz` | `440776a0773a96f4a8305f9109c49f1ab59a8effdeba15407644e7ecfe8120ce` | 78.7 kB packed / 293.2 kB unpacked |

The Adapter source candidate was built with `npm ci` and `npm run
build:library`, then packed from `packages/`. The Tiles artifact was produced
with `npm pack`; its prepack build completed successfully. Both tarballs were
installed by file path into clean temporary consumers. The Adapter candidate
still reports version `0.6.0`, which conflicts with Tiles' reserved
`>=0.6.1 <1.0.0` peer range; the combined install therefore used
`--legacy-peer-deps` to validate this exact pre-release candidate.

## Consumer checks

- Node ESM resolved `@frillab/copc-adapter/core`,
  `@frillab/copc-tiles/adapter/copc-core`, and `@frillab/copc-tiles`. The Tiles
  root did not export the Adapter connector.
- TypeScript 5.9.3 strict checking passed with `moduleResolution: "Bundler"`
  and `skipLibCheck: false`.
- Strict `NodeNext` checking fails with TS2834 in the Adapter candidate's
  `dist/core.d.ts`, whose relative declaration imports omit `.js` extensions.
- Vite 7.3.7 built a browser consumer. The consumer had no Cesium or Three
  package installed; Adapter worker/WASM assets appeared in the browser build.
- Repacked the current review snapshot on 2026-10-30 and installed it with the
  exact Adapter candidate by tarball path in a fresh consumer. Node ESM imports,
  strict TypeScript 5.9.3 Bundler-resolution checking with skipLibCheck false,
  and Vite 7.3.7 browser bundling all passed. Strict NodeNext checking still
  fails with Adapter declaration TS2834 errors.
- A real-source Chromium integration used the packed Adapter candidate through
  the Tiles connector. Autzen and SoFi passed with both `copc-js` and Rust/WASM.
  Real tests also confirm bounded preparation and GLB encoding for three SoFi
  nodes across levels 2–4; only the primary node is rendered.
  See `docs/adapter-api-compatibility.md` for source, nodes, range counts,
  attributes, validator results, renderers and precision.

Fresh package-only installs measured by `du -sk node_modules`:

| Consumer | Installed size | Dependency check |
| --- | ---: | --- |
| Adapter only | 6,696 KiB | No Tiles package |
| Tiles only | 376 KiB | Only Tiles installed; optional Adapter peer and renderer packages absent |
| Adapter + Tiles | 7,068 KiB | Separate tarballs; `--legacy-peer-deps` required for the candidate version mismatch |

These installed sizes are local disk footprints with allocation rounding, not
registry download-size guarantees. No artifact was published.
