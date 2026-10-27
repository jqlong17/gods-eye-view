import * as Cesium from 'cesium';
import { createSimplePointLayer } from '../simplePoints/createSimplePointLayer.js';
export { createAviationMetarSource } from './source.js';
export * from './records.js';

export function createAviationMetarLayer(options) {
  return createSimplePointLayer({
    id: 'aviation-metar',
    name: 'Aviation METAR',
    icon: '☁',
    source: 'Aviation Weather Center',
    sourceId: 'aviationweather',
    updateInterval: 300_000,
    markerRadiusM: 8_000,
    colorFor(row) {
      return Cesium.Color.fromCssColorString(row.color || '#4cc9f0');
    },
    labelFor: (row) => row.label || row.name,
    ...options,
  });
}
