import { encodePointCloudGlb } from '../../src/gltf/pointCloudGlb.js';
import { createExperimentalETilePointView, type TileNodeContext } from '../../src/input/tilePointView.js';
import { createExplicitTileset } from '../../src/tileset/explicitTileset.js';

const sourceIdentity = 'browser-fixture-wgs84-ecef-v1';
const transformGeneration = 1;
const sourceCrs = Object.freeze({
  status: 'identified' as const,
  identifier: 'EPSG:4978',
  horizontalUnit: 'metre',
  verticalUnit: 'metre',
});
const verticalDatum = Object.freeze({
  status: 'verified' as const,
  identifier: 'WGS 84 ellipsoidal height',
  corrections: Object.freeze([]),
});

const nodes = Object.freeze([
  {
    node: {
      key: 'root', level: 0, x: 0, y: 0, z: 0,
      pointCount: 3, pointDataOffset: 100, pointDataLength: 72,
      children: ['left'], childrenComplete: true,
    },
    bounds: { minimum: [6378130, -10, -10], maximum: [6378140, 10, 10] },
    origin: [6378135, 0, 0],
    points: [
      [6378135, -2, 0], [6378135, 0, 0], [6378135, 2, 0],
    ],
    attributes: {
      red: new Uint16Array([65535, 0, 0]),
      green: new Uint16Array([0, 65535, 0]),
      blue: new Uint16Array([0, 0, 65535]),
      intensity: new Uint16Array([100, 200, 300]),
      classification: new Uint8Array([1, 2, 3]),
    },
  },
  {
    node: {
      key: 'left', level: 1, x: 0, y: 0, z: 0,
      pointCount: 3, pointDataOffset: 172, pointDataLength: 72,
      children: [], childrenComplete: true,
    },
    bounds: { minimum: [6378130, -10, -10], maximum: [6378135, 0, 0] },
    origin: [6378132.5, -5, -5],
    points: [
      [6378132.5, -7, -5], [6378132.5, -5, -5], [6378132.5, -3, -5],
    ],
    attributes: {
      red: new Uint16Array([65535, 0, 65535]),
      green: new Uint16Array([65535, 65535, 0]),
      blue: new Uint16Array([0, 65535, 65535]),
      intensity: new Uint16Array([400, 500, 600]),
      classification: new Uint8Array([4, 5, 6]),
    },
  },
]);

function encodeNode(node: (typeof nodes)[number]): Uint8Array {
  const context: TileNodeContext = {
    sourceIdentity,
    nodeKey: node.node.key,
    transformGeneration,
    sourceCrs,
    verticalDatum,
    heightOffsetMeters: 0,
  };
  const pointCount = node.points.length;
  const ecef = new Float64Array(node.points.flat());
  const pointView = createExperimentalETilePointView({
    pointCount,
    ecef,
    height: new Float64Array(pointCount),
    attributes: node.attributes,
  }, context, { sourceIdentity, transformGeneration }, {
    attributes: { rgb: true, intensity: true, classification: true },
  });
  const encoded = encodePointCloudGlb(pointView, {
    precision: { originEcef: new Float64Array(node.origin) },
  });
  if (!encoded) throw new Error(`Expected non-empty GLB content for ${node.node.key}.`);
  return encoded.bytes;
}

export function makeBrowserFixtureResources(): ReadonlyMap<string, Uint8Array> {
  const tileset = createExplicitTileset(nodes.map(({ node, bounds }) => ({ node, bounds })));
  const resources = new Map<string, Uint8Array>();
  resources.set('tileset.json', new TextEncoder().encode(JSON.stringify(tileset)));
  for (const node of nodes) {
    resources.set(`content/${[...new TextEncoder().encode(node.node.key)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}.glb`, encodeNode(node));
  }
  return resources;
}

export const browserFixtureExpected = Object.freeze({
  sourceIdentity,
  transformGeneration,
  totalPoints: 6,
  expectedPointEcef: [6378135, -2, 0],
  expectedMetadata: { intensity: 100, classification: 1 },
});
