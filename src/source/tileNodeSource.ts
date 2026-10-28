import type { TilePointFieldSelection, TilePointView } from '../input/tilePointView.js';

/** A bounded reference to one lazily loaded hierarchy page. */
export type TileHierarchyPage = Readonly<{
  key: string;
  pageOffset: number;
  pageLength: number;
}>;

/** Source-neutral COPC-style node record used by the fixture and adapter bridge. */
export type TileHierarchyNode = Readonly<{
  key: string;
  level: number;
  x: number;
  y: number;
  z: number;
  pointCount: number;
  pointDataOffset: number;
  pointDataLength: number;
  children?: readonly string[];
  /** Only true proves that all direct children have been discovered. */
  childrenComplete?: boolean;
}>;

export type TileHierarchyPageResult = Readonly<{
  nodes: readonly TileHierarchyNode[];
  pages: readonly TileHierarchyPage[];
}>;

export interface TileNodeSource {
  readonly sourceIdentity: string;
  readonly transformGeneration: number;
  /** False after close, source replacement, or a transform-policy change. */
  isCurrent?(): boolean;
  getRootHierarchyPage(): TileHierarchyPage;
  /** Implementations should honor the signal. Adapter 0.6.0 cannot cancel this call in flight. */
  loadHierarchyPage(page: TileHierarchyPage, signal?: AbortSignal): Promise<TileHierarchyPageResult>;
  loadNode(
    node: TileHierarchyNode,
    selection: TilePointFieldSelection,
    signal?: AbortSignal,
  ): Promise<TilePointView>;
}

export type TileNodeReaderLimits = Readonly<{
  maxHierarchyPages?: number;
  maxHierarchyPageBytes?: number;
  maxTotalHierarchyPageBytes?: number;
  maxHierarchyNodes?: number;
  maxNodesPerPage?: number;
  maxRequestedNodes?: number;
  maxSelectedExtraDimensions?: number;
  maxPointsPerNode?: number;
  maxTotalPoints?: number;
  maxPointDataBytesPerNode?: number;
  maxTotalPointDataBytes?: number;
  maxDecodedBytesPerNode?: number;
  maxTotalDecodedBytes?: number;
  maxConcurrentNodeReads?: number;
}>;

export type TileNodeReadOptions = Readonly<{
  signal?: AbortSignal;
}>;

export type TileNodeReaderErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_HIERARCHY_PAGE'
  | 'INVALID_HIERARCHY_NODE'
  | 'CONFLICTING_NODE'
  | 'NODE_NOT_FOUND'
  | 'INCOMPLETE_HIERARCHY'
  | 'HIERARCHY_LIMIT'
  | 'REQUEST_LIMIT'
  | 'POINT_DATA_LIMIT'
  | 'DECODED_DATA_LIMIT'
  | 'NODE_CONTENT_MISMATCH'
  | 'STALE_SOURCE'
  | 'ABORTED';

export class TileNodeReaderError extends Error {
  readonly code: TileNodeReaderErrorCode;
  readonly pageKey: string | undefined;
  readonly nodeKey: string | undefined;

  constructor(
    code: TileNodeReaderErrorCode,
    message: string,
    details: Readonly<{ pageKey?: string; nodeKey?: string }> = {},
  ) {
    super(message);
    this.name = code === 'ABORTED' ? 'AbortError' : 'TileNodeReaderError';
    this.code = code;
    this.pageKey = details.pageKey;
    this.nodeKey = details.nodeKey;
  }
}
