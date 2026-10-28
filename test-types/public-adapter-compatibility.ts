import type { PreparedPointData } from '@frillab/copc-adapter/cesium';
import type { PreparedPointDataAInput } from '../src/input/tilePointView.js';

type Assert<T extends true> = T;
type PublicAIsCompatible = Assert<PreparedPointData extends PreparedPointDataAInput ? true : false>;

export type PublicAdapterCompatibility = PublicAIsCompatible;
