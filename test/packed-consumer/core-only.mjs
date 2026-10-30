import assert from 'node:assert/strict';
import * as core from '@frillab/copc-adapter/core';
import * as tiles from '@frillab/copc-tiles';
import { CopcCoreNodeSource } from '@frillab/copc-tiles/adapter/copc-core';

assert.equal(typeof core.createCopcContext, 'function');
assert.equal(typeof core.CopcContext.prototype.getConservativeNodeEcefBounds, 'function');
assert.equal(typeof tiles.encodePointCloudGlb, 'function');
assert.equal(typeof CopcCoreNodeSource, 'function');
console.log('Renderer-free packed Core consumer passed without Cesium or Three installed.');
