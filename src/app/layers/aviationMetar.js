import { createAviationMetarLayer } from '../../layers/aviationMetar/index.js';
import { overlayHost } from './overlayHost.js';

export function createApplicationAviationMetar(options) {
  return createAviationMetarLayer({ overlayHost, ...options });
}
