import type {
  CopcHierarchyBounds,
  CopcHierarchyNode,
  CopcMetadata,
  CopcNodeSource,
  CopcPointFieldSelection,
  CopcPreparedNodeData,
  CoordinateTransformPlan,
} from '@frillab/copc-adapter/core';
import type { TilePointFieldSelection, PreparedPointDataAInput } from '../src/input/tilePointView.js';
import type { TileNodeSource } from '../src/source/tileNodeSource.js';
import type { CopcCoreNodeSource, CopcCoreNodeSourceOptions } from '../src/adapter/copcCoreAdapter.js';

type Assert<T extends true> = T;
type CorePreparedDataIsACompatible = Assert<CopcPreparedNodeData['pointData'] extends PreparedPointDataAInput ? true : false>;
type CoreNodeAcceptsPublicHierarchyNode = Assert<Parameters<CopcNodeSource['loadPreparedNodeData']>[0] extends CopcHierarchyNode ? true : false>;
type CoreSelectionAcceptsTileFields = Assert<ReturnType<typeof toCoreFields> extends CopcPointFieldSelection ? true : false>;
type CoreConnectorImplementsTileSource = Assert<CopcCoreNodeSource extends TileNodeSource ? true : false>;
type CoreMetadataContractIsPublic = Assert<ReturnType<CopcNodeSource['getMetadata']> extends CopcMetadata ? true : false>;
type CoreBoundsContractIsSourceSpace = Assert<ReturnType<CopcNodeSource['getNodeCellBounds']> extends CopcHierarchyBounds ? true : false>;
type CoreTransformPlanIsPublic = Assert<CopcNodeSource['transformPlan'] extends CoordinateTransformPlan ? true : false>;

function toCoreFields(_selection: TilePointFieldSelection): ReadonlySet<'position' | 'rgb' | 'intensity' | 'classification'> {
  return new Set(['position']);
}

declare const source: CopcNodeSource;
declare const sourceOptions: CopcCoreNodeSourceOptions;
const sourceMethod: CopcNodeSource['loadPreparedNodeData'] = source.loadPreparedNodeData.bind(source);
const connectorOptions: CopcCoreNodeSourceOptions = { source, sourceIdentity: 'opaque-source' };
declare const connector: CopcCoreNodeSource;
const connectorSource: TileNodeSource = connector;
void [sourceMethod, connectorOptions, sourceOptions, connectorSource];

export type CopcCoreApiCompatibility =
  | CorePreparedDataIsACompatible
  | CoreNodeAcceptsPublicHierarchyNode
  | CoreSelectionAcceptsTileFields
  | CoreConnectorImplementsTileSource
  | CoreMetadataContractIsPublic
  | CoreBoundsContractIsSourceSpace
  | CoreTransformPlanIsPublic;
