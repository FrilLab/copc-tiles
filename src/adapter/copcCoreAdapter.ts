// @ts-ignore -- published Adapter 0.6.0 predates /core; the packed candidate is checked separately.
import type { CopcBackendName, CopcContextOptions, CopcHierarchyNode, CopcHierarchyPage, CopcInputSource, CopcNodeSource, CopcPointField, CopcPreparedNodeData } from '@frillab/copc-adapter/core';
import {
  createTilePointViewFromA,
  snapshotTilePointFieldSelection,
  type TileNodeContext,
  type TilePointFieldSelection,
  type TilePointView,
  type TileTransformPlanProvenance,
} from '../input/tilePointView.js';
import type {
  TileHierarchyNode,
  TileHierarchyPage,
  TileHierarchyPageResult,
  TileNodeSource,
} from '../source/tileNodeSource.js';

export type CopcCoreAdapterOptions = Readonly<{
  /** Input supported by the public Core factory: URL, File/Blob, or random-access source. */
  input: CopcInputSource;
  /** Public Core backend identifier. No implicit backend fallback is performed. */
  backend?: CopcBackendName;
  /** Adapter source options, including range limits, height policy and selected Extra Bytes. */
  contextOptions?: CopcContextOptions;
  /** Opaque application-owned identity; never derive it from a signed source URL. */
  sourceIdentity: string;
  /** Optional application generation guard for source replacement outside this context. */
  isCurrent?: () => boolean;
}>;

export type CopcCoreNodeSourceOptions = Readonly<{
  source: CopcNodeSource;
  sourceIdentity: string;
  /** Destroy the supplied context on close; defaults to false. */
  ownsSource?: boolean;
  /** Optional application generation guard for source replacement outside this context. */
  isCurrent?: () => boolean;
}>;

export type CopcCoreAdapterErrorCode =
  | 'INVALID_SOURCE'
  | 'STALE_SOURCE'
  | 'NODE_MISMATCH'
  | 'INVALID_PREPARED_BOUNDS';

export class CopcCoreAdapterError extends Error {
  readonly code: CopcCoreAdapterErrorCode;
  readonly nodeKey: string | undefined;

  constructor(code: CopcCoreAdapterErrorCode, message: string, nodeKey?: string) {
    super(message);
    this.name = 'CopcCoreAdapterError';
    this.code = code;
    this.nodeKey = nodeKey;
  }
}

/**
 * Thin bridge over Adapter's renderer-neutral public CopcNodeSource contract.
 * It uses the Core source's own hierarchy, selected-node preparation,
 * cancellation, generations and immutable transform plan.
 */
export class CopcCoreNodeSource implements TileNodeSource {
  readonly sourceIdentity: string;
  readonly sourceGeneration: number;
  readonly transformGeneration: number;
  readonly #source: CopcNodeSource;
  readonly #ownsSource: boolean;
  readonly #isCurrentOverride: (() => boolean) | undefined;
  readonly #lifecycleAbort = new AbortController();
  #closed = false;

  constructor(options: CopcCoreNodeSourceOptions) {
    if (!options || typeof options !== 'object' || !options.source) {
      throw new CopcCoreAdapterError('INVALID_SOURCE', 'A public CopcNodeSource is required.');
    }
    if (typeof options.sourceIdentity !== 'string' || options.sourceIdentity.trim() === '') {
      throw new CopcCoreAdapterError('INVALID_SOURCE', 'sourceIdentity must be an opaque non-empty identifier.');
    }
    if (!Number.isSafeInteger(options.source.sourceGeneration) || options.source.sourceGeneration < 0) {
      throw new CopcCoreAdapterError('INVALID_SOURCE', 'Adapter sourceGeneration must be a non-negative safe integer.');
    }
    if (!Number.isSafeInteger(options.source.transformGeneration) || options.source.transformGeneration < 0) {
      throw new CopcCoreAdapterError('INVALID_SOURCE', 'Adapter transformGeneration must be a non-negative safe integer.');
    }
    this.#source = options.source;
    this.#ownsSource = options.ownsSource ?? false;
    this.#isCurrentOverride = options.isCurrent;
    this.sourceIdentity = options.sourceIdentity;
    this.sourceGeneration = options.source.sourceGeneration;
    this.transformGeneration = options.source.transformGeneration;
  }

  isCurrent(): boolean {
    return !this.#closed &&
      this.#source.isCurrent(this.sourceGeneration) &&
      (this.#isCurrentOverride?.() ?? true);
  }

  getRootHierarchyPage(): TileHierarchyPage {
    this.#assertCurrent();
    return copyPage(this.#source.getRootHierarchyPage());
  }

  async loadHierarchyPage(page: TileHierarchyPage, signal?: AbortSignal): Promise<TileHierarchyPageResult> {
    const operation = combineSignals(signal, this.#lifecycleAbort.signal);
    try {
      this.#assertCurrent(operation.signal);
      const result = await this.#source.loadHierarchyPage(copyPage(page), { signal: operation.signal });
      this.#assertCurrent(operation.signal);
      if (!result || !Array.isArray(result.nodes) || !Array.isArray(result.pages)) {
        return result as unknown as TileHierarchyPageResult;
      }
      return Object.freeze({
        nodes: Object.freeze(result.nodes.map(copyCoreNode)),
        pages: Object.freeze(result.pages.map(copyPage)),
      });
    } finally {
      operation.dispose();
    }
  }

  async loadNode(
    node: TileHierarchyNode,
    selection: TilePointFieldSelection,
    signal?: AbortSignal,
  ): Promise<TilePointView> {
    const operation = combineSignals(signal, this.#lifecycleAbort.signal);
    try {
      this.#assertCurrent(operation.signal);
      const selected = snapshotTilePointFieldSelection(selection);
      const fields: CopcPointField[] = ['position'];
      if (selected.attributes?.rgb) fields.push('rgb');
      if (selected.attributes?.intensity) fields.push('intensity');
      if (selected.attributes?.classification) fields.push('classification');
      const extras = selected.attributes?.extraDimensions ?? [];

      const prepared = await this.#source.loadPreparedNodeData(
        copyNodeToCore(node),
        new Set(fields),
        {
          signal: operation.signal,
          ...(extras.length > 0 ? { extraDimensions: extras } : {}),
        },
      );
      this.#assertCurrent(operation.signal);
      validatePreparedIdentity(prepared, node, this.#source, this.sourceGeneration, this.transformGeneration);
      validateDecodedPointBounds(prepared, node.key);

      const context = createNodeContext(
        this.sourceIdentity,
        node.key,
        prepared,
      );
      const view = createTilePointViewFromA(
        prepared.pointData,
        context,
        { sourceIdentity: this.sourceIdentity, transformGeneration: this.transformGeneration },
        selected,
      );
      if (view.pointCount !== node.pointCount || view.context.nodeKey !== node.key) {
        throw new CopcCoreAdapterError('NODE_MISMATCH', 'Prepared data does not match the requested node identity or point count.', node.key);
      }
      return view;
    } finally {
      operation.dispose();
    }
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#lifecycleAbort.abort();
    if (this.#ownsSource) this.#source.close();
  }

  #assertCurrent(signal?: AbortSignal): void {
    if (signal?.aborted) {
      const error = new Error('COPC node read was cancelled.', { cause: signal.reason });
      error.name = 'AbortError';
      throw error;
    }
    if (!this.isCurrent()) {
      throw new CopcCoreAdapterError('STALE_SOURCE', 'COPC source is closed or belongs to a stale generation.');
    }
  }
}

/** Open and own a context through the public `@frillab/copc-adapter/core` entrypoint. */
export async function createCopcCoreNodeSource(options: CopcCoreAdapterOptions): Promise<CopcCoreNodeSource> {
  if (!options || typeof options !== 'object') {
    throw new CopcCoreAdapterError('INVALID_SOURCE', 'Core adapter options are required.');
  }
  const core = await importCoreApi();
  const source = await core.createCopcContext(
    options.input,
    options.backend ?? 'copc-js',
    options.contextOptions ?? {},
  );
  try {
    return new CopcCoreNodeSource({
      source,
      sourceIdentity: options.sourceIdentity,
      ownsSource: true,
      ...(options.isCurrent === undefined ? {} : { isCurrent: options.isCurrent }),
    });
  } catch (error) {
    source.close();
    throw error;
  }
}

/** Wrap an already-open Core context; ownership stays with the caller by default. */
export function wrapCopcCoreNodeSource(options: CopcCoreNodeSourceOptions): CopcCoreNodeSource {
  return new CopcCoreNodeSource(options);
}

// @ts-ignore -- published Adapter 0.6.0 predates /core; the packed candidate is checked separately.
type CopcCoreRuntime = typeof import('@frillab/copc-adapter/core');

async function importCoreApi(): Promise<CopcCoreRuntime> {
  // @ts-ignore -- published Adapter 0.6.0 predates /core; the packed candidate is checked separately.
  return import('@frillab/copc-adapter/core');
}

function copyPage(page: CopcHierarchyPage | TileHierarchyPage): TileHierarchyPage {
  if (!isRecord(page)) return page as TileHierarchyPage;
  return Object.freeze({
    key: page.key as string,
    pageOffset: page.pageOffset as number,
    pageLength: page.pageLength as number,
  });
}

function copyCoreNode(node: CopcHierarchyNode): TileHierarchyNode {
  if (!isRecord(node)) return node as TileHierarchyNode;
  const children = node.children;
  return Object.freeze({
    key: node.key as string,
    level: node.level as number,
    x: node.x as number,
    y: node.y as number,
    z: node.z as number,
    pointCount: node.pointCount as number,
    pointDataOffset: node.pointDataOffset as number,
    pointDataLength: node.pointDataLength as number,
    ...(children === undefined ? {} : {
      children: Array.isArray(children) ? Object.freeze([...children]) as readonly string[] : children as string[],
    }),
    ...(node.childrenComplete === undefined ? {} : { childrenComplete: node.childrenComplete as boolean }),
  });
}

function copyNodeToCore(node: TileHierarchyNode): CopcHierarchyNode {
  return {
    key: node.key,
    level: node.level,
    x: node.x,
    y: node.y,
    z: node.z,
    pointCount: node.pointCount,
    pointDataOffset: node.pointDataOffset,
    pointDataLength: node.pointDataLength,
    ...(node.children === undefined ? {} : { children: [...node.children] }),
    ...(node.childrenComplete === undefined ? {} : { childrenComplete: node.childrenComplete }),
  };
}

function createNodeContext(
  sourceIdentity: string,
  nodeKey: string,
  prepared: CopcPreparedNodeData,
): TileNodeContext {
  const plan = prepared.transformPlan;
  const horizontal = plan.source.horizontalCrs;
  const identifier = horizontal?.authority && horizontal.code
    ? `${horizontal.authority}:${horizontal.code}`
    : horizontal?.name;
  const crsStatus = horizontal?.certainty === 'explicit'
    ? 'identified'
    : horizontal?.certainty === 'inferred'
      ? 'unverified'
      : 'unknown';
  const corrections = [];
  if (plan.manualHeightOffsetMeters !== 0) {
    corrections.push({ kind: 'manual-offset' as const, offsetMeters: plan.manualHeightOffsetMeters });
  }
  if (plan.verticalGrid) {
    corrections.push({ kind: 'validated-grid' as const, identifier: plan.verticalGrid.id });
  }
  const verticalStatus = plan.verticalGrid?.compatibility === 'validated'
    ? 'verified'
    : corrections.length > 0
      ? 'unverified'
      : 'unknown';
  const bounds = prepared.ecefBounds;
  return Object.freeze({
    sourceIdentity,
    nodeKey,
    sourceGeneration: prepared.sourceGeneration,
    transformGeneration: prepared.transformGeneration,
    sourceCrs: Object.freeze({
      status: crsStatus,
      ...(identifier === undefined ? {} : { identifier }),
      ...(plan.provenance.sourceWkt === undefined ? {} : { definition: plan.provenance.sourceWkt }),
      ...(plan.source.horizontalUnits.name === undefined ? {} : { horizontalUnit: plan.source.horizontalUnits.name }),
      ...(plan.source.verticalUnits.name === undefined ? {} : { verticalUnit: plan.source.verticalUnits.name }),
    }),
    verticalDatum: Object.freeze({
      status: verticalStatus,
      ...(plan.source.verticalCrs?.authority && plan.source.verticalCrs.code
        ? { identifier: `${plan.source.verticalCrs.authority}:${plan.source.verticalCrs.code}` }
        : plan.source.verticalCrs?.name === undefined ? {} : { identifier: plan.source.verticalCrs.name }),
      corrections: Object.freeze(corrections),
    }),
    heightOffsetMeters: plan.manualHeightOffsetMeters,
    transformPlan: plan as TileTransformPlanProvenance,
    availableFields: Object.freeze([...prepared.availableFields]),
    availableExtraDimensions: Object.freeze([...prepared.availableExtraDimensions]),
    ...(bounds === undefined ? {} : {
      decodedPointEcefBounds: bounds,
      decodedPointEcefBoundsKind: prepared.ecefBoundsKind,
    }),
  });
}

function validatePreparedIdentity(
  prepared: CopcPreparedNodeData,
  requestedNode: TileHierarchyNode,
  source: CopcNodeSource,
  sourceGeneration: number,
  transformGeneration: number,
): void {
  if (
    !prepared ||
    prepared.node.key !== requestedNode.key ||
    prepared.node.pointCount !== requestedNode.pointCount ||
    prepared.pointData.pointCount !== requestedNode.pointCount ||
    prepared.sourceIdentity !== source.source ||
    prepared.sourceGeneration !== sourceGeneration ||
    prepared.transformGeneration !== transformGeneration ||
    prepared.sourceGeneration !== source.sourceGeneration ||
    prepared.transformGeneration !== source.transformGeneration ||
    prepared.transformPlan.identity.key !== source.transformPlan.identity.key ||
    prepared.ecefBoundsKind !== 'decoded-point-content'
  ) {
    throw new CopcCoreAdapterError('NODE_MISMATCH', 'Adapter preparation returned stale data or mismatched node/source provenance.', requestedNode.key);
  }
}

function validateDecodedPointBounds(prepared: CopcPreparedNodeData, nodeKey: string): void {
  const bounds = prepared.ecefBounds;
  if (prepared.pointData.pointCount === 0) {
    if (bounds !== undefined) {
      throw new CopcCoreAdapterError('INVALID_PREPARED_BOUNDS', 'An empty decoded node cannot have point-content ECEF bounds.', nodeKey);
    }
    return;
  }
  if (bounds === undefined) return;
  const values = [bounds.minX, bounds.minY, bounds.minZ, bounds.maxX, bounds.maxY, bounds.maxZ];
  if (
    bounds.coordinateSystem !== 'wgs84-ecef-meters' ||
    values.some((value) => !Number.isFinite(value)) ||
    bounds.minX > bounds.maxX || bounds.minY > bounds.maxY || bounds.minZ > bounds.maxZ
  ) {
    throw new CopcCoreAdapterError('INVALID_PREPARED_BOUNDS', 'Adapter returned malformed decoded-point ECEF bounds.', nodeKey);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function combineSignals(
  requestSignal?: AbortSignal,
  lifecycleSignal?: AbortSignal,
): Readonly<{ signal: AbortSignal; dispose: () => void }> {
  const controller = new AbortController();
  const relayRequest = (): void => controller.abort(requestSignal?.reason);
  const relayLifecycle = (): void => controller.abort(lifecycleSignal?.reason);
  if (requestSignal?.aborted) relayRequest();
  else requestSignal?.addEventListener('abort', relayRequest, { once: true });
  if (lifecycleSignal?.aborted) relayLifecycle();
  else lifecycleSignal?.addEventListener('abort', relayLifecycle, { once: true });
  return Object.freeze({
    signal: controller.signal,
    dispose: () => {
      requestSignal?.removeEventListener('abort', relayRequest);
      lifecycleSignal?.removeEventListener('abort', relayLifecycle);
    },
  });
}
