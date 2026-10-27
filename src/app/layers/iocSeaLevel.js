import { createIocSeaLevelLayer } from '../../layers/iocSeaLevel/index.js';
import { overlayHost } from './overlayHost.js';

export function createApplicationIocSeaLevel(options) {
  return createIocSeaLevelLayer({ overlayHost, ...options });
}
