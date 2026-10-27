import * as Cesium from 'cesium';
import { createSimplePointLayer } from '../simplePoints/createSimplePointLayer.js';
export { createSwpcAuroraSource } from './source.js';
export * from './records.js';

export function createSwpcAuroraLayer(options) {
  return createSimplePointLayer({
    id: 'swpc-aurora',
    name: 'SWPC aurora',
    icon: '✧',
    source: 'NOAA SWPC',
    sourceId: 'noaa-swpc',
    updateInterval: 600_000,
    markerRadiusM: 18_000,
    colorFor(row) {
      return Cesium.Color.fromCssColorString(row.color || '#90be6d');
    },
    labelFor: (row) => row.label || row.name,
    priorityFor: (row) => Number(row.aurora) || 0,
    ...options,
  });
}
