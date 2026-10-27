import { createAdsbExchangeLayer } from '../../layers/adsbExchange/index.js';
import { overlayHost } from './overlayHost.js';

export function createApplicationAdsbExchange(options) {
  return createAdsbExchangeLayer({ overlayHost, ...options });
}
