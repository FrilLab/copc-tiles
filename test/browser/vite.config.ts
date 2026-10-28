import { open, readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { createTileResourceServer, type TileResourceProvider } from '../../src/resources/tileResourceServer.js';
import { makeBrowserFixtureResources } from './fixture.js';

const resourceMap = makeBrowserFixtureResources();
const httpRequests: string[] = [];
const providerReads: string[] = [];
const copcRequests: Array<Readonly<{ method: string; range?: string }>> = [];
let copcRangeBytes = 0;
let copcRangeCount = 0;
const realCopcPath = process.env.COPC_TILES_AUTZEN;
const browserPort = Number(process.env.COPC_TILES_BROWSER_PORT ?? 4173);
const browserOrigin = `http://127.0.0.1:${browserPort}`;
const cesiumBuild = resolve(process.cwd(), 'node_modules/cesium/Build/Cesium');
const MIME_TYPES: Readonly<Record<string, string>> = Object.freeze({
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ktx2': 'image/ktx2',
  '.bin': 'application/octet-stream',
  '.glsl': 'text/plain; charset=utf-8',
});

const provider: TileResourceProvider = Object.freeze({
  sourceIdentity: 'browser-fixture-source',
  generation: 1,
  getResource: async (uri: string, signal: AbortSignal) => {
    providerReads.push(uri);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const bytes = resourceMap.get(uri);
    return bytes === undefined ? undefined : bytes.slice();
  },
});
const resourceServer = createTileResourceServer(provider, {
  basePath: '/fixture/',
  maxResourceBytes: 4 * 1024 * 1024,
  maxCacheBytes: 4 * 1024 * 1024,
  maxCacheEntries: 16,
  maxConcurrentLoads: 4,
  maxQueuedLoads: 8,
});
function browserResourcesPlugin(): Plugin {
  return {
    name: 'copc-tiles-browser-fixture-resources',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const rawUrl = request.url ?? '/';
        const pathname = new URL(rawUrl, browserOrigin).pathname;
        if (pathname === '/__stats') {
          if (new URL(rawUrl, browserOrigin).searchParams.has('reset')) {
            httpRequests.length = 0;
            providerReads.length = 0;
            copcRequests.length = 0;
            copcRangeBytes = 0;
            copcRangeCount = 0;
          }
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({
            httpRequests: [...httpRequests],
            providerReads: [...providerReads],
            copcRequests: [...copcRequests],
            copcRangeBytes,
            copcRangeCount,
            cache: resourceServer.getStats(),
          }));
          return;
        }
        if (pathname.startsWith('/fixture/')) {
          httpRequests.push(pathname.slice('/fixture/'.length));
          try {
            const url = new URL(rawUrl, browserOrigin);
            const requestSignal = new AbortController();
            request.on('aborted', () => requestSignal.abort());
            const tileRequest = new Request(url, {
              method: request.method ?? 'GET',
              headers: request.headers as HeadersInit,
              signal: requestSignal.signal,
            });
            const tileResponse = await resourceServer.handle(tileRequest);
            response.statusCode = tileResponse.status;
            tileResponse.headers.forEach((value, key) => response.setHeader(key, value));
            if (tileResponse.body === null) {
              response.end();
            } else {
              response.end(Buffer.from(await tileResponse.arrayBuffer()));
            }
          } catch (error) {
            if (response.headersSent) return;
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : String(error));
          }
          return;
        }
        if (pathname === '/__copc/autzen.copc.laz') {
          if (!realCopcPath) {
            response.statusCode = 404;
            response.end('Set COPC_TILES_AUTZEN to serve the real sample by byte range.');
            return;
          }
          const range = request.headers.range;
          copcRequests.push({ method: request.method ?? 'GET', ...(typeof range === 'string' ? { range } : {}) });
          try {
            const { size } = await stat(realCopcPath);
            response.setHeader('Accept-Ranges', 'bytes');
            response.setHeader('Content-Type', 'application/vnd.copc');
            if (request.method === 'HEAD') {
              response.statusCode = 200;
              response.setHeader('Content-Length', size);
              response.end();
              return;
            }
            if (request.method !== 'GET' || typeof range !== 'string') {
              response.statusCode = 416;
              response.setHeader('Content-Range', `bytes */${size}`);
              response.end('A bounded Range header is required.');
              return;
            }
            const match = /^bytes=(\d+)-(\d+)$/.exec(range);
            if (!match) {
              response.statusCode = 416;
              response.setHeader('Content-Range', `bytes */${size}`);
              response.end('A single explicit byte range is required.');
              return;
            }
            const start = Number(match[1]);
            const end = Number(match[2]);
            const length = end - start + 1;
            if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= size || length > 16 * 1024 * 1024) {
              response.statusCode = 416;
              response.setHeader('Content-Range', `bytes */${size}`);
              response.end('The requested range is invalid or exceeds 16 MiB.');
              return;
            }
            const file = await open(realCopcPath, 'r');
            try {
              const bytes = Buffer.allocUnsafe(length);
              const result = await file.read(bytes, 0, length, start);
              if (result.bytesRead !== length) throw new Error(`Short file read ${result.bytesRead}/${length}`);
              copcRangeBytes += length;
              copcRangeCount += 1;
              response.statusCode = 206;
              response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
              response.setHeader('Content-Length', length);
              response.setHeader('Cache-Control', 'no-store');
              response.end(bytes);
            } finally {
              await file.close();
            }
          } catch (error) {
            if (response.headersSent) return;
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : String(error));
          }
          return;
        }
        if (pathname.startsWith('/Cesium/')) {
          let relative: string;
          try {
            relative = decodeURIComponent(pathname.slice('/Cesium/'.length));
          } catch {
            response.statusCode = 400;
            response.end('Malformed asset URL');
            return;
          }
          const filePath = resolve(cesiumBuild, relative);
          if (filePath !== cesiumBuild && !filePath.startsWith(`${cesiumBuild}${sep}`)) {
            response.statusCode = 400;
            response.end('Invalid asset path');
            return;
          }
          try {
            const bytes = await readFile(filePath);
            response.setHeader('Content-Type', MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream');
            response.setHeader('Cache-Control', 'public, max-age=3600');
            response.end(bytes);
          } catch {
            response.statusCode = 404;
            response.end('Cesium static asset not found');
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [browserResourcesPlugin()],
  root: process.cwd(),
  appType: 'spa',
  server: {
    host: '127.0.0.1',
    port: browserPort,
    strictPort: true,
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify('/Cesium/'),
  },
});
