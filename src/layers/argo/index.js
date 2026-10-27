import * as Cesium from 'cesium';
import { createSimplePointLayer } from '../simplePoints/createSimplePointLayer.js';
export { createArgoSource } from './source.js';
export * from './records.js';

export function createArgoLayer(options) {
  return createSimplePointLayer({
    id: 'argo-floats',
    name: 'Argo floats',
    icon: '◎',
    source: 'Argo / Ifremer ERDDAP',
    sourceId: 'argo',
    updateInterval: 600_000,
    markerRadiusM: 10_000,
    colorFor: () => Cesium.Color.fromCssColorString('#023e8a'),
    labelFor: (row) => row.label || row.name,
    ...options,
  });
}
