import { createOpenAqLayer } from '../../layers/openaq/index.js';
import { overlayHost } from './overlayHost.js';

export function createApplicationOpenAq(options) {
  return createOpenAqLayer({ overlayHost, ...options });
}
