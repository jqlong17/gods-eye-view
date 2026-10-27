import { createGdacsLayer } from '../../layers/gdacs/index.js';
import { overlayHost } from './overlayHost.js';

export function createApplicationGdacs(options) {
  return createGdacsLayer({ overlayHost, ...options });
}
