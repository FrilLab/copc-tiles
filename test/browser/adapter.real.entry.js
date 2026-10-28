import {
  copcJsBackend,
  createCopcPointFieldSelection,
} from '@frillab/copc-adapter/cesium';
import { encodePointCloudGlb } from '../../src/gltf/pointCloudGlb.ts';
import { createCopcJsAdapterNodeSource } from '../../src/adapter/copcJsAdapter.ts';
import { createTileTranslationTransform } from '../../src/geometry/tileLocalCoordinates.ts';
import { TileNodeReader } from '../../src/source/tileNodeReader.ts';

const MAX_NODE_POINTS = 8192;
const MAX_NODE_BYTES = 2 * 1024 * 1024;

function toBase64(bytes) {
  let binary = '';
  const blockSize = 0x8000;
  for (let offset = 0; offset < bytes.byteLength; offset += blockSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + blockSize, bytes.byteLength)));
  }
  return btoa(binary);
}

window.startRealAdapterIntegration = async () => {
  const source = await copcJsBackend.open('/__copc/autzen.copc.laz', {
    rangeValidation: 'strict',
    maxRangeBytes: MAX_NODE_BYTES,
    maxConcurrentRangeRequests: 2,
  });
  let connector;
  try {
    const metadata = source.getMetadata();
    const fields = createCopcPointFieldSelection(['position', 'rgb', 'intensity', 'classification']);
    const queue = [source.getRootHierarchyPage()];
    const seenPages = new Set();
    let node;
    let hierarchyPagesRead = 0;
    while (queue.length > 0 && hierarchyPagesRead < 64 && !node) {
      const page = queue.shift();
      if (!page || seenPages.has(page.key)) continue;
      seenPages.add(page.key);
      hierarchyPagesRead += 1;
      const result = await source.loadHierarchyPage(page);
      node = result.nodes.find((candidate) => (
        candidate.pointCount > 0 && candidate.pointCount <= MAX_NODE_POINTS &&
        candidate.pointDataLength > 0 && candidate.pointDataLength <= MAX_NODE_BYTES
      ));
      if (!node) queue.push(...result.pages);
    }
    if (!node) throw new Error('No non-empty bounded Autzen node was found within 64 hierarchy pages.');

    const availableView = await source.loadPointDataView(node, fields);
    const availableFields = availableView.availableFields;
    if (!availableFields.has('position')) throw new Error('The actual COPC point view lacks positions.');
    const attributeSelection = {
      ...(availableFields.has('rgb') ? { rgb: true } : {}),
      ...(availableFields.has('intensity') ? { intensity: true } : {}),
      ...(availableFields.has('classification') ? { classification: true } : {}),
    };
    const availableSamples = {
      intensity: availableFields.has('intensity') ? availableView.getter('intensity')(0) : null,
      classification: availableFields.has('classification') ? availableView.getter('classification')(0) : null,
      red: availableFields.has('rgb') ? availableView.getter('red')(0) : null,
      green: availableFields.has('rgb') ? availableView.getter('green')(0) : null,
      blue: availableFields.has('rgb') ? availableView.getter('blue')(0) : null,
    };
    const sourceCrs = metadata.wkt
      ? { status: 'unverified', definition: metadata.wkt, reason: 'The Tiles connector preserves source WKT but does not independently validate its axis/unit interpretation.' }
      : { status: 'unknown', reason: 'The Adapter public metadata did not provide a WKT definition.' };
    connector = await createCopcJsAdapterNodeSource({
      source,
      sourceIdentity: 'autzen-sha256-db2d56cdfa058bffccdc5d6019dae2fc9c6a551df10a5523c06c76a3e25a27fa',
      transformGeneration: 1,
      provenanceForNode: () => ({
        sourceCrs,
        verticalDatum: { status: 'unknown', reason: 'No independently validated vertical datum correction was supplied.', corrections: [] },
        heightOffsetMeters: source.preparedHeightOffsetMeters ?? 0,
      }),
      ownsSource: false,
    });
    const reader = new TileNodeReader(connector, {
      maxHierarchyPages: 64,
      maxHierarchyNodes: 50_000,
      maxRequestedNodes: 1,
      maxPointsPerNode: MAX_NODE_POINTS,
      maxTotalPoints: MAX_NODE_POINTS,
      maxPointDataBytesPerNode: MAX_NODE_BYTES,
      maxTotalPointDataBytes: MAX_NODE_BYTES,
      maxDecodedBytesPerNode: 4 * 1024 * 1024,
      maxTotalDecodedBytes: 4 * 1024 * 1024,
      maxConcurrentNodeReads: 1,
    });
    const views = await reader.readNodes([node.key], {
      coordinates: { source: true, geographic: true },
      attributes: attributeSelection,
    });
    const view = views.get(node.key);
    if (!view) throw new Error(`The Tiles connector returned no view for node ${node.key}.`);
    const encoded = encodePointCloudGlb(view);
    if (!encoded) throw new Error('The actual non-empty COPC node encoded to no GLB content.');
    const minimum = [Infinity, Infinity, Infinity];
    const maximum = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < view.ecef.length; index += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        minimum[axis] = Math.min(minimum[axis], view.ecef[index + axis]);
        maximum[axis] = Math.max(maximum[axis], view.ecef[index + axis]);
      }
    }
    const origin = minimum.map((value, axis) => value + (maximum[axis] - value) / 2);
    const halfExtents = minimum.map((value, axis) => Math.max((maximum[axis] - value) / 2, 0.01));
    const box = [
      0, 0, 0,
      halfExtents[0], 0, 0,
      0, halfExtents[1], 0,
      0, 0, halfExtents[2],
    ];
    const tileset = {
      asset: { version: '1.1' },
      geometricError: 0,
      root: {
        boundingVolume: { box },
        geometricError: 0,
        refine: 'ADD',
        transform: [...createTileTranslationTransform(new Float64Array(origin))],
        content: { uri: 'content/real.glb', boundingVolume: { box: [...box] } },
      },
    };
    return {
      adapterVersion: '0.6.0',
      metadataPointCount: metadata.pointCount,
      nodeKey: node.key,
      nodePointCount: node.pointCount,
      loadedPointCount: view.pointCount,
      availableFields: [...availableFields],
      selectedAttributes: attributeSelection,
      actualAttributes: {
        intensity: view.attributes?.intensity?.[0] ?? null,
        classification: view.attributes?.classification?.[0] ?? null,
        red: view.attributes?.red?.[0] ?? null,
        green: view.attributes?.green?.[0] ?? null,
        blue: view.attributes?.blue?.[0] ?? null,
      },
      availableSamples,
      ecefFirstPoint: Array.from(view.ecef.slice(0, 3)),
      sourceCrsStatus: view.context.sourceCrs.status,
      verticalDatumStatus: view.context.verticalDatum.status,
      hierarchyPagesRead,
      encodedPointCount: encoded.pointCount,
      encodedMetadataProperties: encoded.metadataProperties,
      originEcef: origin,
      halfExtents,
      tileset,
      glbBase64: toBase64(encoded.bytes),
    };
  } finally {
    connector?.close();
    source.destroy?.();
  }
};
