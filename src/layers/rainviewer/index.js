import * as Cesium from 'cesium';
import { msg } from '../../i18n/marker.js';
export { createRainViewerSource } from './source.js';

/** Global radar reflectivity tiles from RainViewer (keyless). */
export function createRainViewerLayer({ source } = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('RainViewer requires a snapshot source');

  let _viewer = null;
  let _layer = null;
  let _enabled = false;
  let _request = null;
  let _lastUpdate = null;
  let _lastError = null;
  let _framePath = null;

  const detach = (viewer = _viewer) => {
    if (_layer && viewer) {
      viewer.imageryLayers.remove(_layer, true);
      _layer = null;
    }
  };

  const attach = (host, path) => {
    if (!_viewer) return;
    detach();
    const url = `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`;
    const provider = new Cesium.UrlTemplateImageryProvider({
      url,
      maximumLevel: 7,
    });
    _layer = _viewer.imageryLayers.addImageryProvider(provider);
    _layer.alpha = 0.65;
    _framePath = path;
  };

  return {
    id: 'rainviewer',
    name: 'RainViewer radar',
    icon: '☔',
    source: 'RainViewer',
    sourceId: 'rainviewer',
    updateInterval: 300_000,

    init(viewer) {
      if (_viewer) throw new Error('RainViewer layer is already initialized');
      _viewer = viewer;
    },
    enable() {
      _enabled = true;
    },
    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      detach();
      _framePath = null;
    },
    async update() {
      if (!_enabled || !_viewer) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const payload = await source.getSnapshot({ signal: request.signal });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        if (payload.path !== _framePath) attach(payload.host, payload.path);
        _lastUpdate = Date.now();
        _lastError = null;
        return true;
      } catch (error) {
        if (request.signal.aborted || _request !== request) return false;
        _lastError = error?.message || msg('RainViewer unavailable');
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },
    destroy(viewer = _viewer) {
      this.disable();
      _viewer = null;
      _lastUpdate = null;
      _lastError = null;
    },
    getStats() {
      return {
        count: _layer && _enabled ? 1 : 0,
        lastUpdate: _lastUpdate,
        error: _lastError,
      };
    },
  };
}
