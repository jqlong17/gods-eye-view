import { createSwpcAuroraLayer } from '../../layers/swpcAurora/index.js';
import { overlayHost } from './overlayHost.js';

export function createApplicationSwpcAurora(options) {
  return createSwpcAuroraLayer({ overlayHost, ...options });
}
