import assert from 'node:assert/strict';
import test from 'node:test';
import { createExperimentalETilePointView } from '../src/input/tilePointView.ts';
import {
  CopcAdapterNodeSource,
  CopcAdapterNodeSourceError,
  openCopcAdapterNodeSource,
} from '../src/adapter/copcAdapterNodeSource.ts';
import { TileNodeReader } from '../src/source/tileNodeReader.ts';

const node = {
  key: '0-0-0-0',
  level: 0,
  x: 0,
  y: 0,
  z: 0,
  pointCount: 2,
  pointDataOffset: 128,
  pointDataLength: 40,
  children: [],
  childrenComplete: true,
};

const contextForNode = () => ({
  sourceCrs: { status: 'identified', identifier: 'EPSG:26910', horizontalUnit: 'metre', verticalUnit: 'metre' },
  verticalDatum: { status: 'unverified', identifier: 'source metadata incomplete', corrections: [] },
  heightOffsetMeters: 0,
});

function preparedA(count = 2) {
  const sourceCoordinates = new Float64Array(count * 3).fill(1);
  const geographic = new Float64Array(count * 3).fill(2);
  const ecef = new Float64Array(count * 3).fill(3);
  return {
    pointCount: count,
    source: { coordinateSystem: 'copc-source', pointCount: count, coordinates: sourceCoordinates },
    geographic: { coordinateSystem: 'wgs84-geographic', pointCount: count, coordinates: geographic },
    world: { coordinateSystem: 'wgs84-ecef-meters', pointCount: count, coordinates: ecef },
    coordinates: geographic,
    sourceCoordinates,
    worldCoordinates: ecef,
    attributes: {
      red: new Uint16Array(count).fill(10),
      green: new Uint16Array(count).fill(20),
      blue: new Uint16Array(count).fill(30),
      intensity: new Uint16Array(count).fill(100),
      classification: new Uint8Array(count).fill(2),
    },
  };
}

function eView(nodeKey, context, selection) {
  const count = node.pointCount;
  return createExperimentalETilePointView({
    pointCount: count,
    ecef: new Float64Array(count * 3).fill(3),
    height: new Float64Array(count).fill(12),
    ...(selection.attributes?.rgb ? {
      attributes: {
        red: new Uint16Array(count).fill(1),
        green: new Uint16Array(count).fill(2),
        blue: new Uint16Array(count).fill(3),
      },
    } : {}),
  }, { ...context, nodeKey }, {
    sourceIdentity: 'opaque-source-id',
    transformGeneration: 5,
  }, selection);
}

function makeSource(overrides = {}) {
  return {
    getRootHierarchyPage: () => ({ key: 'root', pageOffset: 0, pageLength: 32 }),
    loadHierarchyPage: async () => ({ nodes: [node], pages: [] }),
    loadPointDataView: async () => ({ tag: 'view' }),
    ...overrides,
  };
}

function makeBridge(source, overrides = {}) {
  return new CopcAdapterNodeSource({
    source,
    sourceIdentity: 'opaque-source-id',
    transformGeneration: 5,
    provenanceForNode: contextForNode,
    ...overrides,
  });
}

test('uses the public fused prepared-point method and forwards a minimal field set', async () => {
  let calls = 0;
  let receivedFields;
  const prepared = preparedA();
  const source = makeSource({
    loadPreparedPointData: async (_node, fields) => {
      calls += 1;
      receivedFields = fields;
      return prepared;
    },
  });
  const bridge = makeBridge(source);
  const view = await bridge.loadNode(node, { attributes: { rgb: true, intensity: true } });
  assert.equal(calls, 1);
  assert.deepEqual([...receivedFields].sort(), ['intensity', 'position', 'rgb']);
  assert.equal(view.context.nodeKey, node.key);
  assert.equal(view.ecef, prepared.world.coordinates);
  assert.equal(view.attributes.red[0], 10);
});

test('runs requested-node traversal through the public Adapter bridge exactly once', async () => {
  const pageCalls = [];
  const pointCalls = [];
  const prepared = preparedA();
  const source = makeSource({
    getRootHierarchyPage: () => ({ key: 'root', pageOffset: 0, pageLength: 32 }),
    loadHierarchyPage: async (page) => {
      pageCalls.push(page.key);
      return page.key === 'root'
        ? { nodes: [], pages: [{ key: 'point-node-page', pageOffset: 32, pageLength: 32 }] }
        : { nodes: [node], pages: [] };
    },
    loadPreparedPointData: async (requestedNode) => {
      pointCalls.push(requestedNode.key);
      return prepared;
    },
  });
  const reader = new TileNodeReader(makeBridge(source));
  const views = await reader.readNodes([node.key, node.key], { attributes: { rgb: true } });
  assert.deepEqual(pageCalls, ['root', 'point-node-page']);
  assert.deepEqual(pointCalls, [node.key]);
  assert.deepEqual([...views.keys()], [node.key]);
  assert.equal(views.get(node.key).ecef, prepared.world.coordinates);
});

test('uses the public point-buffer fallback only with an explicit preparation callback', async () => {
  let bufferReads = 0;
  let preparationCalls = 0;
  const source = makeSource({
    loadPointDataBuffer: async () => { bufferReads += 1; return { sourceBytes: new Uint8Array([1, 2]) }; },
  });
  const bridge = makeBridge(source, {
    preparePointBuffer: (buffer, requestedNode, context, selection) => {
      preparationCalls += 1;
      assert.deepEqual(buffer.sourceBytes, new Uint8Array([1, 2]));
      return eView(requestedNode.key, context, selection);
    },
  });
  const view = await bridge.loadNode(node, {});
  assert.equal(bufferReads, 1);
  assert.equal(preparationCalls, 1);
  assert.equal(view.ecef.length, 6);
});

test('uses the public point-view fallback through supplied decode and prepare functions', async () => {
  let viewReads = 0;
  let decodes = 0;
  let preparations = 0;
  const source = makeSource({ loadPointDataView: async () => { viewReads += 1; return { tag: 'copc-view' }; } });
  const bridge = makeBridge(source, {
    decodePointView: async (view) => {
      decodes += 1;
      assert.deepEqual(view, { tag: 'copc-view' });
      return { pointCount: 2, coordinateSystem: 'copc-source' };
    },
    preparePointBuffer: (buffer, requestedNode, context, selection) => {
      preparations += 1;
      assert.equal(buffer.coordinateSystem, 'copc-source');
      return eView(requestedNode.key, context, selection);
    },
  });
  await bridge.loadNode(node, {});
  assert.equal(viewReads, 1);
  assert.equal(decodes, 1);
  assert.equal(preparations, 1);
});

test('does not silently fall back when public point preparation is unavailable', async () => {
  let reads = 0;
  const source = makeSource({ loadPointDataBuffer: async () => { reads += 1; return {}; } });
  const bridge = makeBridge(source);
  await assert.rejects(
    bridge.loadNode(node, {}),
    (error) => error instanceof CopcAdapterNodeSourceError && error.code === 'PREPARATION_UNAVAILABLE',
  );
  assert.equal(reads, 0);
});

test('propagates cancellation into point reads and does not retry damaged ranges', async () => {
  let observedSignal;
  let reads = 0;
  const source = makeSource({
    loadPreparedPointData: (_node, _fields, options) => new Promise((resolve, reject) => {
      observedSignal = options.signal;
      options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }),
  });
  const bridge = makeBridge(source);
  const controller = new AbortController();
  const pending = bridge.loadNode(node, {}, controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(observedSignal.aborted, true);

  const damaged = makeBridge(makeSource({
    loadPointDataBuffer: async () => { reads += 1; throw new Error('invalid Range response'); },
  }), { preparePointBuffer: () => { throw new Error('must not prepare'); } });
  await assert.rejects(damaged.loadNode(node, {}), /invalid Range response/);
  assert.equal(reads, 1);
});

test('empty nodes avoid point requests while returning valid zero-length requested fields', async () => {
  let calls = 0;
  const source = makeSource({ loadPreparedPointData: async () => { calls += 1; throw new Error('must not read'); } });
  const bridge = makeBridge(source);
  const view = await bridge.loadNode({ ...node, pointCount: 0, pointDataLength: 0 }, { attributes: { rgb: true } });
  assert.equal(calls, 0);
  assert.equal(view.pointCount, 0);
  assert.equal(view.attributes.red.length, 0);
});

test('shared source close is local; owned source close cancels and destroys its lifecycle', () => {
  let cancelled = 0;
  let destroyed = 0;
  const shared = makeSource({ cancelPendingPointJobs: () => { cancelled += 1; }, destroy: () => { destroyed += 1; } });
  makeBridge(shared).close();
  assert.equal(cancelled, 0);
  assert.equal(destroyed, 0);
  makeBridge(shared, { ownsSource: true }).close();
  assert.equal(cancelled, 1);
  assert.equal(destroyed, 1);
});

test('opens an owned source through the supplied public backend and closes it once', async () => {
  let openedWith;
  let destroyed = 0;
  const source = makeSource({ destroy: () => { destroyed += 1; } });
  const backend = { open: async (input, options) => { openedWith = { input, options }; return source; } };
  const input = { uri: 'fixture-only' };
  const options = { backend: 'rust' };
  const bridge = await openCopcAdapterNodeSource(backend, input, options, {
    sourceIdentity: 'opaque-source-id',
    transformGeneration: 5,
    provenanceForNode: contextForNode,
  });
  assert.deepEqual(openedWith, { input, options });
  bridge.close();
  bridge.close();
  assert.equal(destroyed, 1);
});

