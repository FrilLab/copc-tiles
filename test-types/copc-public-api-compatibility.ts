import type { CopcBackend, CopcInputSource, CopcSource } from '@frillab/copc-adapter/cesium';
import {
  openCopcAdapterNodeSource,
  type CopcAdapterNodeSource,
  type CopcAdapterNodeSourceOptions,
  type PublicCopcNodeSource,
} from '../src/adapter/copcAdapterNodeSource.js';

type Assert<T extends true> = T;
type PublicCopcSourceSupportsBridge = Assert<CopcSource extends PublicCopcNodeSource ? true : false>;

export type PublicCopcNodeSourceCompatibility = PublicCopcSourceSupportsBridge;

declare const backend: CopcBackend;
declare const input: CopcInputSource;
declare const options: NonNullable<Parameters<CopcBackend['open']>[1]>;
declare const connectorOptions: Omit<CopcAdapterNodeSourceOptions, 'source' | 'ownsSource'>;
const opened: Promise<CopcAdapterNodeSource> = openCopcAdapterNodeSource(
  backend,
  input,
  options,
  connectorOptions,
);
void opened;
