import * as Cesium from 'cesium';
import { createSimplePointLayer } from '../simplePoints/createSimplePointLayer.js';
export { createIocSeaLevelSource } from './source.js';
export * from './records.js';

export function createIocSeaLevelLayer(options) {
  return createSimplePointLayer({
    id: 'ioc-sea-level',
    name: 'IOC sea level',
    icon: '🌊',
    source: 'IOC Sea Level',
    sourceId: 'ioc',
    updateInterval: 600_000,
    markerRadiusM: 7_000,
    colorFor: () => Cesium.Color.fromCssColorString('#219ebc'),
    labelFor: (row) => row.label || row.name,
    ...options,
  });
}
