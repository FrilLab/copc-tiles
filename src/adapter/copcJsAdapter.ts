import type {
  CopcMetadata,
  CopcPointBuffer,
} from '@frillab/copc-adapter/cesium';
import {
  createTilePointViewFromA,
  type PreparedPointDataAInput,
} from '../input/tilePointView.js';
import {
  CopcAdapterNodeSource,
  CopcAdapterNodeSourceError,
  type CopcAdapterNodeSourceOptions,
  type PublicCopcNodeSource,
} from './copcAdapterNodeSource.js';

export type CopcJsAdapterNodeSourceOptions = Readonly<
  Omit<CopcAdapterNodeSourceOptions, 'preparePointBuffer'>
>;

/**
 * Connect the public COPC Adapter JS backend to Tiles while keeping its
 * runtime dependency out of the source-neutral engine import graph. Adapter
 * 0.6.0's CopcSource exposes a fused prepared method only optionally, so this
 * factory uses the public point-buffer and preparation exports as fallback.
 */
export async function createCopcJsAdapterNodeSource(
  options: CopcJsAdapterNodeSourceOptions,
): Promise<CopcAdapterNodeSource> {
  if (options.source.loadPreparedPointData) {
    return new CopcAdapterNodeSource(options);
  }
  if (typeof options.source.getMetadata !== 'function') {
    throw new CopcAdapterNodeSourceError(
      'PREPARATION_UNAVAILABLE',
      'The public CopcSource does not expose getMetadata() for CRS preparation.',
    );
  }
  const metadata = options.source.getMetadata() as CopcMetadata;
  const { transformPointBufferToPreparedPointData } = await import('@frillab/copc-adapter/cesium');
  return new CopcAdapterNodeSource({
    ...options,
    preparePointBuffer: (buffer, _node, context, selection) => {
      const prepared = transformPointBufferToPreparedPointData(
        metadata,
        buffer as CopcPointBuffer,
        context.heightOffsetMeters,
      );
      return createTilePointViewFromA(
        prepared as unknown as PreparedPointDataAInput,
        context,
        {
          sourceIdentity: context.sourceIdentity,
          transformGeneration: context.transformGeneration,
        },
        selection,
      );
    },
  });
}
