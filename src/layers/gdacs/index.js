import * as Cesium from 'cesium';
import { createSimplePointLayer } from '../simplePoints/createSimplePointLayer.js';
export { createGdacsSource } from './source.js';
export * from './records.js';

/** Active GDACS disaster alerts as point markers. */
export function createGdacsLayer(options) {
  return createSimplePointLayer({
    id: 'gdacs',
    name: 'GDACS disasters',
    icon: '⚠',
    source: 'GDACS',
    updateInterval: 300_000,
    markerRadiusM: 25_000,
    colorFor(row) {
      return Cesium.Color.fromCssColorString(row.color || '#ff6b35');
    },
    labelFor: (row) => row.label || row.name,
    priorityFor(row) {
      return row.alertlevel === 'Red' ? 300 : row.alertlevel === 'Orange' ? 200 : 100;
    },
    ...options,
  });
}
