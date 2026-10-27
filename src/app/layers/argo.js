import { createArgoLayer } from '../../layers/argo/index.js';
import { overlayHost } from './overlayHost.js';

export function createApplicationArgo(options) {
  return createArgoLayer({ overlayHost, ...options });
}
