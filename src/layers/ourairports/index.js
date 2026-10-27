import * as Cesium from 'cesium';
import { createSimplePointLayer } from '../simplePoints/createSimplePointLayer.js';
export { createOurAirportsSource } from './source.js';
export * from './records.js';

/** Large / scheduled medium airports from OurAirports. */
export function createOurAirportsLayer(options) {
  return createSimplePointLayer({
    id: 'ourairports',
    name: 'OurAirports',
    icon: '✈',
    source: 'OurAirports',
    updateInterval: 3_600_000,
    markerRadiusM: 8_000,
    colorFor(row) {
      return row.type === 'large_airport'
        ? Cesium.Color.fromCssColorString('#4cc9f0')
        : Cesium.Color.fromCssColorString('#90be6d');
    },
    labelFor: (row) => row.label || row.name,
    priorityFor: (row) => (row.type === 'large_airport' ? 200 : 100),
    ...options,
  });
}
