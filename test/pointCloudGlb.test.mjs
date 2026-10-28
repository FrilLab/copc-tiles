import assert from 'node:assert/strict';
import test from 'node:test';
import validator from 'gltf-validator';
import { createExperimentalETilePointView } from '../src/input/tilePointView.ts';
import { encodePointCloudGlb, GlbEncodingError } from '../src/gltf/pointCloudGlb.ts';

const context = {
  sourceIdentity: 'glb-fixture',
  nodeKey: 'node-1',
  transformGeneration: 1,
  sourceCrs: { status: 'identified', identifier: 'EPSG:4978', horizontalUnit: 'metre', verticalUnit: 'metre' },
  verticalDatum: { status: 'verified', identifier: 'WGS 84 ellipsoidal height', corrections: [] },
  heightOffsetMeters: 0,
};

function pointView({ points = [[6378137, 0, 0], [6378137.25, 0.5, 0.75]], attributes } = {}) {
  const ecef = new Float64Array(points.flat());
  const pointCount = points.length;
  return createExperimentalETilePointView({
    pointCount,
    ecef,
    height: new Float64Array(pointCount),
    ...(attributes === undefined ? {} : { attributes }),
  }, context, { sourceIdentity: context.sourceIdentity, transformGeneration: context.transformGeneration },
  attributes === undefined ? {} : { attributes: {
    ...(attributes.red === undefined ? {} : { rgb: true }),
    ...(attributes.intensity === undefined ? {} : { intensity: true }),
    ...(attributes.classification === undefined ? {} : { classification: true }),
  } });
}

function parseGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  assert.equal(view.getUint32(16, true), 0x4e4f534a);
  const jsonStart = 20;
  const jsonBytes = bytes.subarray(jsonStart, jsonStart + jsonLength);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes).trimEnd());
  const binaryHeader = jsonStart + jsonLength;
  const binaryLength = view.getUint32(binaryHeader, true);
  assert.equal(view.getUint32(binaryHeader + 4, true), 0x004e4942);
  const binaryStart = binaryHeader + 8;
  assert.equal(binaryStart + binaryLength, bytes.byteLength);
  return { json, view, binaryStart, binaryLength };
}

function assertEncodingError(code, action) {
  assert.throws(action, (error) => error instanceof GlbEncodingError && error.code === code);
}

test('writes a deterministic glTF 2.0 POINTS GLB with aligned chunks and correct accessors', async () => {
  const points = [[6378137, -10, 20], [6378137.25, -9.5, 21]];
  const input = pointView({ points });
  const encoded = encodePointCloudGlb(input);
  assert.ok(encoded);
  assert.equal(encoded.mimeType, 'model/gltf-binary');
  assert.equal(encoded.pointCount, 2);
  assert.equal(encoded.hasColor, false);

  const { json, binaryStart } = parseGlb(encoded.bytes);
  assert.deepEqual(json.asset, { version: '2.0', generator: '@frillab/copc-tiles' });
  assert.equal(json.meshes[0].primitives[0].mode, 0);
  assert.deepEqual(json.meshes[0].primitives[0].attributes, { POSITION: 0 });
  assert.equal(json.accessors[0].componentType, 5126);
  assert.equal(json.accessors[0].count, 2);
  assert.equal(json.accessors[0].type, 'VEC3');
  assert.deepEqual(json.nodes, [{ mesh: 0 }]);
  assert.equal(Object.hasOwn(json.nodes[0], 'matrix'), false);
  assert.equal(json.bufferViews[0].byteOffset % 4, 0);
  assert.equal(json.buffers[0].byteLength, 24);
  assert.equal(binaryStart % 4, 0);
  assert.equal(encoded.bytes.byteLength % 4, 0);

  const firstPosition = Array.from({ length: 3 }, (_, axis) => new DataView(encoded.bytes.buffer).getFloat32(binaryStart + axis * 4, true));
  assert.ok(firstPosition.every(Number.isFinite));
  assert.deepEqual(encoded.bytes, encodePointCloudGlb(pointView({ points })).bytes);
});

test('preserves full Uint16 LAS RGB as normalized COLOR_0 without narrowing', async () => {
  const rgb = {
    red: new Uint16Array([0, 65535]),
    green: new Uint16Array([257, 32768]),
    blue: new Uint16Array([65535, 1]),
  };
  const encoded = encodePointCloudGlb(pointView({ attributes: rgb }));
  assert.ok(encoded?.hasColor);
  const { json, view, binaryStart } = parseGlb(encoded.bytes);
  assert.deepEqual(json.meshes[0].primitives[0].attributes, { POSITION: 0, COLOR_0: 1 });
  assert.equal(json.accessors[1].componentType, 5123);
  assert.equal(json.accessors[1].normalized, true);
  assert.equal(json.accessors[1].count, 2);
  assert.equal(json.bufferViews[1].byteOffset, 24);
  assert.equal(json.bufferViews[1].byteLength, 16);
  assert.equal(json.bufferViews[1].byteStride, 8);
  const colorOffset = binaryStart + json.bufferViews[1].byteOffset;
  assert.deepEqual([
    view.getUint16(colorOffset, true),
    view.getUint16(colorOffset + 2, true),
    view.getUint16(colorOffset + 4, true),
    view.getUint16(colorOffset + 8, true),
    view.getUint16(colorOffset + 10, true),
    view.getUint16(colorOffset + 12, true),
  ], [0, 257, 65535, 65535, 32768, 1]);
  assert.equal(json.buffers[0].byteLength, 40);
  assert.equal(json.accessors[1].min, undefined);
  assert.equal(json.accessors[1].max, undefined);
});

test('omits empty-node content and does not write a zero-count accessor', () => {
  assert.equal(encodePointCloudGlb(pointView({ points: [] })), null);
});

test('rejects inspection fields instead of silently dropping them before T7 metadata support', () => {
  assertEncodingError('UNSUPPORTED_ATTRIBUTES', () => encodePointCloudGlb(pointView({
    attributes: {
      intensity: new Uint16Array([1, 2]),
      classification: new Uint8Array([2, 3]),
    },
  })));
});

test('fails on malformed RGB, excessive point counts, and output sizes', () => {
  const partialRgb = pointView();
  const malformed = { ...partialRgb, attributes: { red: new Uint16Array([1, 2]) } };
  assertEncodingError('INVALID_INPUT', () => encodePointCloudGlb(malformed));
  assertEncodingError('POINT_LIMIT', () => encodePointCloudGlb(pointView(), { maxPoints: 1 }));
  assertEncodingError('OUTPUT_LIMIT', () => encodePointCloudGlb(pointView(), { maxOutputBytes: 32 }));
});

test('generated GLBs pass the official Khronos glTF Validator', async () => {
  const fixtures = [
    encodePointCloudGlb(pointView()),
    encodePointCloudGlb(pointView({ attributes: {
      red: new Uint16Array([0, 65535]),
      green: new Uint16Array([1, 32768]),
      blue: new Uint16Array([65535, 0]),
    } })),
  ];
  for (const fixture of fixtures) {
    assert.ok(fixture);
    const report = await validator.validateBytes(new Uint8Array(fixture.bytes), { uri: 'point-cloud.glb' });
    assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues.messages));
    assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues.messages));
  }
});

