import * as Cesium from 'cesium';
import { createSimplePointLayer } from '../simplePoints/createSimplePointLayer.js';
export { createOpenMeteoSource } from './source.js';
export * from './records.js';

/** Temperature-tinted sample markers for the current view. */
export function createOpenMeteoLayer(options) {
  return createSimplePointLayer({
    id: 'open-meteo',
    name: 'Open-Meteo weather',
    icon: '◎',
    source: 'Open-Meteo',
    updateInterval: 300_000,
    markerRadiusM: 12_000,
    colorFor(row) {
      const t = Number(row.temperatureC);
      if (!Number.isFinite(t))
        return Cesium.Color.fromCssColorString('#8ecae6');
      if (t <= 0) return Cesium.Color.fromCssColorString('#4cc9f0');
      if (t <= 15) return Cesium.Color.fromCssColorString('#90be6d');
      if (t <= 28) return Cesium.Color.fromCssColorString('#f9c74f');
      return Cesium.Color.fromCssColorString('#f94144');
    },
    labelFor: (row) => row.label,
    priorityFor: (row) =>
      Number.isFinite(row.temperatureC) ? Math.abs(row.temperatureC) : 0,
    ...options,
  });
}
