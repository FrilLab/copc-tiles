import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from '@playwright/test';
import validator from 'gltf-validator';
import tilesValidator from '3d-tiles-validator';
import { resetServerStats } from './browser-utils.mjs';

test('public Adapter 0.6.0 opens the real Autzen COPC, reads one bounded node and feeds Tiles GLB encoding', {
  skip: process.env.COPC_TILES_AUTZEN ? false : 'Set COPC_TILES_AUTZEN to the verified Autzen COPC sample.',
  timeout: 120_000,
}, async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/test/browser/adapter.html');
  await resetServerStats(page);
  const result = await page.evaluate(() => window.startRealAdapterIntegration());
  const stats = await page.evaluate(async () => (await fetch('/__stats')).json());

  assert.equal(result.adapterVersion, '0.6.0');
  assert.ok(Number.isSafeInteger(result.metadataPointCount) && result.metadataPointCount > 0);
  assert.equal(result.loadedPointCount, result.nodePointCount);
  assert.equal(result.encodedPointCount, result.nodePointCount);
  assert.ok(result.nodePointCount > 0 && result.nodePointCount <= 8192);
  assert.ok(result.hierarchyPagesRead <= 64);
  assert.ok(result.ecefFirstPoint.every(Number.isFinite));
  assert.equal(result.sourceCrsStatus, 'unverified');
  assert.equal(result.verticalDatumStatus, 'unknown');
  assert.ok(result.availableFields.includes('position'));
  assert.equal(result.actualAttributes.red !== null, result.availableFields.includes('rgb'));
  assert.equal(result.actualAttributes.intensity !== null, result.availableFields.includes('intensity'));
  assert.equal(result.actualAttributes.classification !== null, result.availableFields.includes('classification'));
  assert.equal(result.actualAttributes.intensity, result.availableSamples.intensity);
  assert.equal(result.actualAttributes.classification, result.availableSamples.classification);
  assert.equal(result.actualAttributes.red, result.availableSamples.red);
  assert.equal(result.actualAttributes.green, result.availableSamples.green);
  assert.equal(result.actualAttributes.blue, result.availableSamples.blue);
  assert.ok(stats.copcRangeCount > 0, 'the browser used the local bounded HTTP Range source');
  assert.ok(stats.copcRangeBytes > 0);
  assert.ok(stats.copcRangeBytes < 81_123_042, 'the adapter did not fetch the full 81 MB object');
  assert.ok(stats.copcRequests.every((request) => request.method === 'GET' ? /^bytes=\d+-\d+$/.test(request.range) : request.method === 'HEAD'));
  const bytes = Buffer.from(result.glbBase64, 'base64');
  const gltfReport = await validator.validateBytes(new Uint8Array(bytes), { uri: 'autzen-node.glb' });
  assert.equal(gltfReport.issues.numErrors, 0, JSON.stringify(gltfReport.issues.messages));
  assert.equal(gltfReport.issues.numWarnings, 0, JSON.stringify(gltfReport.issues.messages));
  assert.deepEqual(pageErrors, []);
  console.log(`Autzen Adapter 0.6.0: ${result.nodeKey}, ${result.nodePointCount} points, fields=${result.availableFields.join(',')}, ranges=${stats.copcRangeCount}, rangeBytes=${stats.copcRangeBytes}, GLB=${Math.floor(result.glbBase64.length * 3 / 4)} bytes, Khronos errors/warnings=${gltfReport.issues.numErrors}/${gltfReport.issues.numWarnings}`);

  const directory = await mkdtemp(join(tmpdir(), 'copc-tiles-autzen-one-tile-'));
  try {
    await mkdir(join(directory, 'content'));
    await writeFile(join(directory, 'tileset.json'), JSON.stringify(result.tileset));
    await writeFile(join(directory, 'content', 'real.glb'), bytes);
    const report = await tilesValidator.Validators.validateTilesetFile(join(directory, 'tileset.json'));
    assert.deepEqual(report.issues.filter((issue) => issue.severity === 'ERROR'), [], report.serialize());
    assert.deepEqual(report.issues.filter((issue) => issue.severity === 'WARNING'), [], report.serialize());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  console.log(`Autzen real node encoding: Tileset validator errors/warnings=0/0; test wrapper is one decoded COPC node, not the complete COPC hierarchy or a production LOD tileset.`);
});
