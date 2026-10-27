import * as Cesium from 'cesium';
import { createSimplePointLayer } from '../simplePoints/createSimplePointLayer.js';
export { createOpenAqSource } from './source.js';
export * from './records.js';

/** Global OpenAQ station markers (requires free OPENAQ_API_KEY). */
export function createOpenAqLayer(options) {
  return createSimplePointLayer({
    id: 'openaq',
    name: 'OpenAQ air quality',
    icon: '◍',
    source: 'OpenAQ',
    updateInterval: 600_000,
    markerRadiusM: 7_000,
    // Registration-required: KEY REQUIRED / UNAVAILABLE without OPENAQ_API_KEY.
    // Not listed in POWER UP — env var only (see .env.example / DATA_SOURCES.md).
    colorFor(row) {
      return Cesium.Color.fromCssColorString(row.color || '#6b7785');
    },
    labelFor: (row) => row.label || row.name,
    priorityFor: (row) => (Number.isFinite(row.pm25) ? row.pm25 : 0),
    ...options,
  });
}
