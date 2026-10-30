import assert from 'node:assert/strict';
import * as adapter from '@frillab/copc-adapter';
import * as core from '@frillab/copc-adapter/core';
import * as cesium from '@frillab/copc-adapter/cesium';
import * as three from '@frillab/copc-adapter/three';
import * as tiles from '@frillab/copc-tiles';
import { CopcCoreNodeSource } from '@frillab/copc-tiles/adapter/copc-core';

assert.ok(Object.keys(adapter).length > 0);
assert.equal(typeof core.createCopcContext, 'function');
assert.equal(typeof core.CopcContext.prototype.getConservativeNodeEcefBounds, 'function');
assert.ok(Object.keys(cesium).length > 0);
assert.ok(Object.keys(three).length > 0);
assert.equal(typeof tiles.encodePointCloudGlb, 'function');
assert.equal(typeof CopcCoreNodeSource, 'function');
console.log('Packed consumer ESM imports passed for Adapter root/core/cesium/three and Tiles root/Core connector.');
