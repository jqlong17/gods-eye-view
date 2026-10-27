import { createSimplePointLayer } from '../simplePoints/createSimplePointLayer.js';
export { createAdsbExchangeSource } from './source.js';

/**
 * ADS-B Exchange placeholder layer. Without ADSBX_API_KEY the row shows
 * KEY REQUIRED / UNAVAILABLE (no documented keyless public feed).
 */
export function createAdsbExchangeLayer(options) {
  return createSimplePointLayer({
    id: 'adsb-exchange',
    name: 'ADS-B Exchange',
    icon: '✈',
    source: 'ADS-B Exchange',
    updateInterval: 60_000,
    ...options,
  });
}
