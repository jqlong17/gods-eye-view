import * as Cesium from 'cesium';
import { msg } from '../../i18n/marker.js';
export { createEtopoSource } from './source.js';

/** NOAA ETOPO global hillshade as a single draped imagery rectangle (keyless). */
export function createEtopoLayer({ source } = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('ETOPO requires a snapshot source');

  let _viewer = null;
  let _layer = null;
  let _enabled = false;
  let _request = null;
  let _lastUpdate = null;
  let _lastError = null;
  let _url = null;

  const detach = (viewer = _viewer) => {
    if (_layer && viewer) {
      viewer.imageryLayers.remove(_layer, true);
      _layer = null;
    }
  };

  const attach = (imageUrl) => {
    if (!_viewer) return;
    detach();
    const provider = new Cesium.SingleTileImageryProvider({
      url: imageUrl,
      rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
      tileWidth: 2048,
      tileHeight: 1024,
    });
    _layer = _viewer.imageryLayers.addImageryProvider(provider);
    _layer.alpha = 0.55;
    _url = imageUrl;
  };

  return {
    id: 'etopo-bathymetry',
    name: 'ETOPO hillshade',
    icon: '⛰',
    source: 'NOAA ETOPO',
    sourceId: 'noaa-etopo',
    updateInterval: 3_600_000,

    init(viewer) {
      if (_viewer) throw new Error('ETOPO layer is already initialized');
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
      _url = null;
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
        if (payload.imageUrl !== _url) attach(payload.imageUrl);
        _lastUpdate = Date.now();
        _lastError = null;
        return true;
      } catch (error) {
        if (request.signal.aborted || _request !== request) return false;
        _lastError = error?.message || msg('ETOPO unavailable');
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
