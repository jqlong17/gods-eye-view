import { createOurAirportsLayer } from '../../layers/ourairports/index.js';
import { overlayHost } from './overlayHost.js';

export function createApplicationOurAirports(options) {
  return createOurAirportsLayer({ overlayHost, ...options });
}
