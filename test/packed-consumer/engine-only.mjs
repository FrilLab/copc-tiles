import assert from 'node:assert/strict';
import * as tiles from '@frillab/copc-tiles';

assert.equal(typeof tiles.TileNodeReader, 'function');
assert.equal(typeof tiles.encodePointCloudGlb, 'function');
assert.equal(typeof tiles.createTileResourceServer, 'function');
console.log('Adapter-free Tiles Engine ESM imports passed.');
