import {
  createTilePointViewFromA,
  validateTilePointView,
  type PreparedPointDataAInput,
  type TileNodeContext,
  type TilePointFieldSelection,
  type TilePointView,
} from '../input/tilePointView.js';
import type {
  TileHierarchyNode,
  TileHierarchyPage,
  TileHierarchyPageResult,
  TileNodeSource,
} from '../source/tileNodeSource.js';

export type PublicCopcPointField = 'position' | 'rgb' | 'intensity' | 'classification';

type PublicCopcNode = Readonly<{
  key: string;
  level: number;
  x: number;
  y: number;
  z: number;
  pointCount: number;
  pointDataOffset: number;
  pointDataLength: number;
  children?: string[];
  childrenComplete?: boolean;
}>;

/** Structural subset of CopcSource's verified public 0.6.0 API. */
export interface PublicCopcNodeSource {
  getMetadata?(): unknown;
  getRootHierarchyPage(): TileHierarchyPage;
  loadHierarchyPage(page: TileHierarchyPage): Promise<Readonly<{ nodes: readonly PublicCopcNode[]; pages: readonly TileHierarchyPage[] }>>;
  loadPointDataView(
    node: PublicCopcNode,
    fields: ReadonlySet<PublicCopcPointField>,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<unknown>;
  loadPointDataBuffer?(
    node: PublicCopcNode,
    fields: ReadonlySet<PublicCopcPointField>,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<unknown>;
  loadPreparedPointData?(
    node: PublicCopcNode,
    fields: ReadonlySet<PublicCopcPointField>,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<PreparedPointDataAInput>;
  cancelPendingPointJobs?(): void;
  destroy?(): void;
}

export type CopcNodeProvenance = Readonly<Pick<
  TileNodeContext,
  'sourceCrs' | 'verticalDatum' | 'heightOffsetMeters'
>>;

export type CopcPointBufferPreparer = (
  buffer: unknown,
  node: TileHierarchyNode,
  context: TileNodeContext,
  selection: TilePointFieldSelection,
  signal: AbortSignal | undefined,
) => Promise<TilePointView> | TilePointView;

export type CopcPointViewDecoder = (
  view: unknown,
  node: TileHierarchyNode,
  selection: TilePointFieldSelection,
  signal: AbortSignal | undefined,
) => Promise<unknown>;

export type CopcAdapterNodeSourceOptions = Readonly<{
  source: PublicCopcNodeSource;
  sourceIdentity: string;
  transformGeneration: number;
  provenanceForNode: (node: TileHierarchyNode) => CopcNodeProvenance;
  preparePointBuffer?: CopcPointBufferPreparer;
  decodePointView?: CopcPointViewDecoder;
  /** Lets the owner invalidate this adapter when it replaces or reconfigures the source. */
  isCurrent?: () => boolean;
  /** Destroy the supplied CopcSource on close; defaults to false. */
  ownsSource?: boolean;
}>;

export type CopcAdapterNodeSourceErrorCode = 'PREPARATION_UNAVAILABLE' | 'STALE_SOURCE';

export class CopcAdapterNodeSourceError extends Error {
  readonly code: CopcAdapterNodeSourceErrorCode;
  readonly nodeKey: string | undefined;

  constructor(code: CopcAdapterNodeSourceErrorCode, message: string, nodeKey?: string) {
    super(message);
    this.name = 'CopcAdapterNodeSourceError';
    this.code = code;
    this.nodeKey = nodeKey;
  }
}

/**
 * Thin optional bridge for the public CopcSource methods. It never imports
 * Adapter runtime code or Direct NodeSelector / StreamingManager.
 */
export class CopcAdapterNodeSource implements TileNodeSource {
  readonly sourceIdentity: string;
  readonly transformGeneration: number;
  readonly #options: CopcAdapterNodeSourceOptions;
  readonly #lifecycleAbort = new AbortController();
  #closed = false;

  constructor(options: CopcAdapterNodeSourceOptions) {
    if (!options || typeof options !== 'object' || !options.source) {
      throw new CopcAdapterNodeSourceError('STALE_SOURCE', 'A public CopcSource-compatible object is required.');
    }
    if (typeof options.sourceIdentity !== 'string' || options.sourceIdentity.trim() === '') {
      throw new CopcAdapterNodeSourceError('STALE_SOURCE', 'sourceIdentity must be an opaque non-empty identifier.');
    }
    if (!Number.isSafeInteger(options.transformGeneration) || options.transformGeneration < 0) {
      throw new CopcAdapterNodeSourceError('STALE_SOURCE', 'transformGeneration must be a non-negative safe integer.');
    }
    if (typeof options.provenanceForNode !== 'function') {
      throw new CopcAdapterNodeSourceError('STALE_SOURCE', 'A provenanceForNode callback is required.');
    }
    this.#options = options;
    this.sourceIdentity = options.sourceIdentity;
    this.transformGeneration = options.transformGeneration;
  }

  isCurrent(): boolean {
    return !this.#closed && (this.#options.isCurrent?.() ?? true);
  }

  getRootHierarchyPage(): TileHierarchyPage {
    this.#assertCurrent();
    return copyPage(this.#options.source.getRootHierarchyPage());
  }

  async loadHierarchyPage(page: TileHierarchyPage, signal?: AbortSignal): Promise<TileHierarchyPageResult> {
    const operation = combineSignals(signal, this.#lifecycleAbort.signal);
    try {
      this.#assertCurrent(operation.signal);
      // Public Adapter 0.6.0 has no AbortSignal in hierarchy-page load options.
      const result = await this.#options.source.loadHierarchyPage(copyPage(page));
      this.#assertCurrent(operation.signal);
      if (
        !result || typeof result !== 'object' ||
        !Array.isArray((result as { nodes?: unknown }).nodes) ||
        !Array.isArray((result as { pages?: unknown }).pages)
      ) {
        return result as unknown as TileHierarchyPageResult;
      }
      return Object.freeze({
        nodes: Object.freeze(result.nodes.map(copyNode)),
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
      return await this.#loadNode(node, selection, operation.signal);
    } finally {
      operation.dispose();
    }
  }

  async #loadNode(
    node: TileHierarchyNode,
    selection: TilePointFieldSelection,
    signal: AbortSignal,
  ): Promise<TilePointView> {
    this.#assertCurrent(signal);
    const context = Object.freeze({
      sourceIdentity: this.sourceIdentity,
      nodeKey: node.key,
      transformGeneration: this.transformGeneration,
      ...this.#options.provenanceForNode(node),
    });
    const fields = adapterFields(selection);

    if (node.pointCount === 0) {
      const empty = new Float64Array(0);
      const attributes = {
        ...(selection.attributes?.rgb ? { red: new Uint16Array(0), green: new Uint16Array(0), blue: new Uint16Array(0) } : {}),
        ...(selection.attributes?.intensity ? { intensity: new Uint16Array(0) } : {}),
        ...(selection.attributes?.classification ? { classification: new Uint8Array(0) } : {}),
      };
      return createTilePointViewFromA({
        pointCount: 0,
        source: { coordinateSystem: 'copc-source', pointCount: 0, coordinates: empty },
        geographic: { coordinateSystem: 'wgs84-geographic', pointCount: 0, coordinates: empty },
        world: { coordinateSystem: 'wgs84-ecef-meters', pointCount: 0, coordinates: empty },
        coordinates: empty,
        sourceCoordinates: empty,
        worldCoordinates: empty,
        ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
      }, context, expectedFor(this), selection);
    }

    let view: TilePointView;
    if (this.#options.source.loadPreparedPointData) {
      const prepared = await this.#options.source.loadPreparedPointData(copyNode(node), fields, { signal });
      this.#assertCurrent(signal);
      view = createTilePointViewFromA(prepared, context, expectedFor(this), selection);
    } else if (this.#options.source.loadPointDataBuffer) {
      if (!this.#options.preparePointBuffer) {
        throw new CopcAdapterNodeSourceError(
          'PREPARATION_UNAVAILABLE',
          'This source has no fused prepared-point method; supply a public-API point-buffer preparation callback.',
          node.key,
        );
      }
      const buffer = await this.#options.source.loadPointDataBuffer(copyNode(node), fields, { signal });
      this.#assertCurrent(signal);
      view = await this.#options.preparePointBuffer(buffer, node, context, selection, signal);
      this.#assertCurrent(signal);
      view = validateTilePointView(view, expectedFor(this), selection);
    } else {
      if (!this.#options.decodePointView || !this.#options.preparePointBuffer) {
        throw new CopcAdapterNodeSourceError(
          'PREPARATION_UNAVAILABLE',
          'This source requires explicit public point-view decoding and point-buffer preparation callbacks.',
          node.key,
        );
      }
      const pointView = await this.#options.source.loadPointDataView(copyNode(node), fields, { signal });
      this.#assertCurrent(signal);
      const buffer = await this.#options.decodePointView(pointView, node, selection, signal);
      this.#assertCurrent(signal);
      view = await this.#options.preparePointBuffer(buffer, node, context, selection, signal);
      this.#assertCurrent(signal);
      view = validateTilePointView(view, expectedFor(this), selection);
    }
    if (view.context.nodeKey !== node.key || view.pointCount !== node.pointCount) {
      throw new CopcAdapterNodeSourceError('STALE_SOURCE', 'Prepared point data does not match its requested node key or point count.', node.key);
    }
    return view;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#lifecycleAbort.abort();
    if (this.#options.ownsSource) {
      this.#options.source.cancelPendingPointJobs?.();
      this.#options.source.destroy?.();
    }
  }

  #assertCurrent(signal?: AbortSignal): void {
    if (signal?.aborted) {
      const error = new Error('COPC node read was cancelled.');
      error.name = 'AbortError';
      throw error;
    }
    if (!this.isCurrent()) {
      throw new CopcAdapterNodeSourceError('STALE_SOURCE', 'COPC source was closed or invalidated.');
    }
  }
}

/** Open and own a source through the public CopcBackend.open method. */
export async function openCopcAdapterNodeSource<Input, AdapterOptions>(
  backend: Readonly<{
    open(input: Input, options?: AdapterOptions): Promise<PublicCopcNodeSource>;
  }>,
  input: Input,
  adapterOptions: AdapterOptions | undefined,
  connectorOptions: Omit<CopcAdapterNodeSourceOptions, 'source' | 'ownsSource'>,
): Promise<CopcAdapterNodeSource> {
  const source = await backend.open(input, adapterOptions);
  try {
    return new CopcAdapterNodeSource({ ...connectorOptions, source, ownsSource: true });
  } catch (error) {
    source.cancelPendingPointJobs?.();
    source.destroy?.();
    throw error;
  }
}

function adapterFields(selection: TilePointFieldSelection): ReadonlySet<PublicCopcPointField> {
  const fields = new Set<PublicCopcPointField>(['position']);
  if (selection.attributes?.rgb) fields.add('rgb');
  if (selection.attributes?.intensity) fields.add('intensity');
  if (selection.attributes?.classification) fields.add('classification');
  return fields;
}

function expectedFor(source: CopcAdapterNodeSource): Readonly<{
  sourceIdentity: string;
  transformGeneration: number;
}> {
  return { sourceIdentity: source.sourceIdentity, transformGeneration: source.transformGeneration };
}

function copyPage(page: unknown): TileHierarchyPage {
  if (!isRecord(page)) return page as TileHierarchyPage;
  return Object.freeze({
    key: page.key as string,
    pageOffset: page.pageOffset as number,
    pageLength: page.pageLength as number,
  });
}

function copyNode(node: unknown): PublicCopcNode {
  if (!isRecord(node)) return node as PublicCopcNode;
  const children = node.children;
  return Object.freeze({
    key: node.key,
    level: node.level,
    x: node.x,
    y: node.y,
    z: node.z,
    pointCount: node.pointCount,
    pointDataOffset: node.pointDataOffset,
    pointDataLength: node.pointDataLength,
    ...(children === undefined ? {} : {
      children: Array.isArray(children) ? [...children] : children,
    }),
    ...(node.childrenComplete === undefined ? {} : { childrenComplete: node.childrenComplete }),
  } as PublicCopcNode);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function combineSignals(
  first?: AbortSignal,
  second?: AbortSignal,
): Readonly<{ signal: AbortSignal; dispose: () => void }> {
  const controller = new AbortController();
  const relayFirst = (): void => controller.abort(first?.reason);
  const relaySecond = (): void => controller.abort(second?.reason);
  if (first?.aborted) relayFirst();
  else first?.addEventListener('abort', relayFirst, { once: true });
  if (second?.aborted) relaySecond();
  else second?.addEventListener('abort', relaySecond, { once: true });
  return Object.freeze({
    signal: controller.signal,
    dispose: () => {
      first?.removeEventListener('abort', relayFirst);
      second?.removeEventListener('abort', relaySecond);
    },
  });
}
