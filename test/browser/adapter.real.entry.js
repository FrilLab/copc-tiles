import {
  copcJsBackend,
  createCopcPointFieldSelection,
} from '@frillab/copc-adapter/cesium';
import { encodePointCloudGlb } from '../../src/gltf/pointCloudGlb.ts';
import { createCopcJsAdapterNodeSource } from '../../src/adapter/copcJsAdapter.ts';
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

window.startRealAdapterIntegration = async (options = {}) => {
  const integrationStartedAt = performance.now();
  const sourceUrl = options.url ?? '/__copc/autzen.copc.laz';
  const sourceIdentity = options.sourceIdentity ?? 'autzen-sha256-db2d56cdfa058bffccdc5d6019dae2fc9c6a551df10a5523c06c76a3e25a27fa';
  const rangeValidation = options.rangeValidation ?? 'strict';
  const requestedSourceUrl = new URL(sourceUrl, window.location.href);
  const nativeFetch = window.fetch.bind(window);
  const sourceRequests = [];
  window.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const response = await nativeFetch(input, init);
    const requestUrl = new URL(request.url);
    sourceRequests.push({
      isCopcSource: requestUrl.origin === requestedSourceUrl.origin && requestUrl.pathname === requestedSourceUrl.pathname,
      method: request.method,
      range: request.headers.get('Range'),
      status: response.status,
      contentLength: response.headers.get('Content-Length'),
      contentRange: response.headers.get('Content-Range'),
    });
    return response;
  };
  let stageStartedAt = performance.now();
  let source;
  let connector;
  try {
    source = await copcJsBackend.open(sourceUrl, {
      rangeValidation,
      maxRangeBytes: MAX_NODE_BYTES,
      maxConcurrentRangeRequests: 2,
    });
    const sourceOpenMilliseconds = performance.now() - stageStartedAt;
    const metadata = source.getMetadata();
    const fields = createCopcPointFieldSelection(['position', 'rgb', 'intensity', 'classification']);
    const queue = [source.getRootHierarchyPage()];
    stageStartedAt = performance.now();
    const seenPages = new Set();
    const requestedNodeCount = options.nodeCount ?? 1;
    if (!Number.isSafeInteger(requestedNodeCount) || requestedNodeCount < 1 || requestedNodeCount > 8) {
      throw new Error('nodeCount must be an integer between 1 and 8.');
    }
    const selectedNodes = [];
    const selectedLevels = new Set();
    let hierarchyPagesRead = 0;
    let hierarchyNodeCount = 0;
    let hierarchyChildPageRefs = 0;
    const hierarchyLevelCounts = {};
    const maxHierarchyPages = options.maxHierarchyPages ?? 64;
    while (queue.length > 0 && hierarchyPagesRead < maxHierarchyPages && selectedNodes.length < requestedNodeCount) {
      const page = queue.shift();
      if (!page || seenPages.has(page.key)) continue;
      seenPages.add(page.key);
      hierarchyPagesRead += 1;
      const result = await source.loadHierarchyPage(page);
      hierarchyNodeCount += result.nodes.length;
      hierarchyChildPageRefs += result.pages.length;
      for (const item of result.nodes) hierarchyLevelCounts[item.level] = (hierarchyLevelCounts[item.level] ?? 0) + 1;
      const candidates = result.nodes.filter((candidate) => (
        candidate.pointCount > 0 && candidate.pointCount <= MAX_NODE_POINTS &&
        candidate.pointDataLength > 0 && candidate.pointDataLength <= MAX_NODE_BYTES
      )).sort((a, b) => a.level - b.level || a.key.localeCompare(b.key));
      for (const candidate of candidates) {
        if (selectedNodes.length >= requestedNodeCount) break;
        if (options.distinctLevels && selectedLevels.has(candidate.level)) continue;
        if (selectedNodes.some((selected) => selected.key === candidate.key)) continue;
        selectedNodes.push(candidate);
        selectedLevels.add(candidate.level);
      }
      if (selectedNodes.length < requestedNodeCount) queue.push(...result.pages);
    }
    const hierarchyMilliseconds = performance.now() - stageStartedAt;
    if (selectedNodes.length < requestedNodeCount) throw new Error(`Found ${selectedNodes.length} of ${requestedNodeCount} requested non-empty bounded nodes within ${maxHierarchyPages} hierarchy pages.`);
    const node = selectedNodes[0];

    stageStartedAt = performance.now();
    const availableView = await source.loadPointDataView(node, fields);
    const publicViewMilliseconds = performance.now() - stageStartedAt;
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
      sourceIdentity,
      transformGeneration: 1,
      provenanceForNode: () => ({
        sourceCrs,
        verticalDatum: { status: 'unknown', reason: 'No independently validated vertical datum correction was supplied.', corrections: [] },
        heightOffsetMeters: source.preparedHeightOffsetMeters ?? 0,
      }),
      ownsSource: false,
    });
    const reader = new TileNodeReader(connector, {
      maxHierarchyPages,
      maxHierarchyNodes: 50_000,
      maxRequestedNodes: requestedNodeCount,
      maxPointsPerNode: MAX_NODE_POINTS,
      maxTotalPoints: MAX_NODE_POINTS * requestedNodeCount,
      maxPointDataBytesPerNode: MAX_NODE_BYTES,
      maxTotalPointDataBytes: MAX_NODE_BYTES * requestedNodeCount,
      maxDecodedBytesPerNode: 4 * 1024 * 1024,
      maxTotalDecodedBytes: 4 * 1024 * 1024 * requestedNodeCount,
      maxConcurrentNodeReads: 1,
    });
    stageStartedAt = performance.now();
    const views = await reader.readNodes(selectedNodes.map((selected) => selected.key), {
      coordinates: {},
      attributes: attributeSelection,
    });
    const nodePreparationMilliseconds = performance.now() - stageStartedAt;
    const view = views.get(node.key);
    if (!view) throw new Error(`The Tiles connector returned no view for node ${node.key}.`);
    stageStartedAt = performance.now();
    const encoded = encodePointCloudGlb(view);
    const glbEncodingMilliseconds = performance.now() - stageStartedAt;
    if (!encoded) throw new Error('The actual non-empty COPC node encoded to no GLB content.');
    const multiNodeSummary = selectedNodes.map((selected) => {
      const selectedView = views.get(selected.key);
      const selectedGlb = selected.key === node.key ? encoded : selectedView ? encodePointCloudGlb(selectedView) : undefined;
      return {
        nodeKey: selected.key,
        level: selected.level,
        parentKey: selected.level === 0 ? null : `${selected.level - 1}-${Math.floor(selected.x / 2)}-${Math.floor(selected.y / 2)}-${Math.floor(selected.z / 2)}`,
        declaredChildren: selected.children ?? [],
        hierarchyPointCount: selected.pointCount,
        loadedPointCount: selectedView?.pointCount ?? null,
        encodedPointCount: selectedGlb?.pointCount ?? null,
        identityMatches: selectedView?.context.nodeKey === selected.key,
        glbBytes: selectedGlb?.bytes.byteLength ?? null,
      };
    });
    const origin = encoded.originEcef;
    const halfExtents = [0, 0, 0];
    for (let index = 0; index < view.ecef.length; index += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        const local = Math.abs(view.ecef[index + axis] - origin[axis]);
        halfExtents[axis] = Math.max(halfExtents[axis], local);
      }
    }
    for (let axis = 0; axis < 3; axis += 1) {
      halfExtents[axis] = Math.max(halfExtents[axis] + encoded.maxAbsoluteErrorMeters, 0.01);
    }
    let pointsInsideBounds = true;
    for (let index = 0; index < view.ecef.length; index += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        if (Math.abs(view.ecef[index + axis] - origin[axis]) > halfExtents[axis]) pointsInsideBounds = false;
      }
    }
    const box = [
      0, 0, 0,
      halfExtents[0], 0, 0,
      0, halfExtents[1], 0,
      0, 0, halfExtents[2],
    ];
    const geometricError = Math.hypot(...halfExtents);
    const tileset = {
      asset: { version: '1.1' },
      geometricError,
      root: {
        boundingVolume: { box },
        geometricError,
        refine: 'ADD',
        transform: [...encoded.tileTransform],
        content: { uri: 'content/real.glb', boundingVolume: { box: [...box] } },
      },
    };
    stageStartedAt = performance.now();
    const glbBase64 = toBase64(encoded.bytes);
    const base64ConversionMilliseconds = performance.now() - stageStartedAt;
    return {
      adapterVersion: '0.6.0',
      sourceRequests,
      pipelineTimingsMilliseconds: {
        sourceOpen: sourceOpenMilliseconds,
        hierarchyDiscovery: hierarchyMilliseconds,
        publicPointView: publicViewMilliseconds,
        nodePreparation: nodePreparationMilliseconds,
        glbEncoding: glbEncodingMilliseconds,
        base64TransferConversion: base64ConversionMilliseconds,
        sourceOpenThroughGlb: glbEncodingMilliseconds + nodePreparationMilliseconds + publicViewMilliseconds + hierarchyMilliseconds + sourceOpenMilliseconds,
        totalThroughBase64: performance.now() - integrationStartedAt,
      },
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
      hierarchyNodeCount,
      hierarchyChildPageRefs,
      hierarchyLevelCounts,
      multiNodeSummary,
      encodedPointCount: encoded.pointCount,
      encodedMetadataProperties: encoded.metadataProperties,
      originEcef: origin,
      halfExtents,
      pointsInsideBounds,
      maxAbsoluteErrorMeters: encoded.maxAbsoluteErrorMeters,
      tileset,
      glbBase64,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Adapter integration error.';
    throw new Error(message.replace(/https?:\/\/[^\s"'<>]+/gi, '[redacted URL]'));
  } finally {
    connector?.close();
    source?.destroy?.();
    window.fetch = nativeFetch;
  }
};
