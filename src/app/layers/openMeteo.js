import { createOpenMeteoLayer } from '../../layers/openMeteo/index.js';
import { overlayHost } from './overlayHost.js';

export function createApplicationOpenMeteo(options) {
  return createOpenMeteoLayer({ overlayHost, ...options });
}
