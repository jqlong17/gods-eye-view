import * as Cesium from 'cesium';
import { createSimplePointLayer } from '../simplePoints/createSimplePointLayer.js';
export { createFishingWatchSource } from './source.js';

/** Global Fishing Watch — UNAVAILABLE until GFW_API_TOKEN is set. */
export function createFishingWatchLayer(options) {
  return createSimplePointLayer({
    id: 'fishing-watch',
    name: 'Global Fishing Watch',
    icon: '⚓',
    source: 'Global Fishing Watch',
    updateInterval: 600_000,
    markerRadiusM: 9_000,
    colorFor: () => Cesium.Color.fromCssColorString('#219ebc'),
    ...options,
  });
}
