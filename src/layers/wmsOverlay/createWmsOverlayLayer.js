import * as Cesium from 'cesium';
import { msg } from '../../i18n/marker.js';

/**
 * Cesium WMS imagery overlay with a trivial getSnapshot capability probe.
 * Used for keyless bathymetry / land-cover / fire-index layers.
 */
export function createWmsOverlayLayer({
  id,
  name,
  icon = '▣',
  source: sourceLabel,
  sourceId,
  updateInterval = 3_600_000,
  wmsUrl,
  layers,
  parameters = {},
  alpha = 0.7,
  source,
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError(`${name || id} requires a snapshot source`);
  if (!wmsUrl || !layers)
    throw new TypeError(`${name || id} requires a WMS url and layer name`);

  let _viewer = null;
  let _layer = null;
  let _enabled = false;
  let _request = null;
  let _lastUpdate = null;
  let _lastError = null;
  let _ready = false;

  const attach = () => {
    if (!_viewer || _layer) return;
    try {
      const provider = new Cesium.WebMapServiceImageryProvider({
        url: wmsUrl,
        layers,
        parameters: {
          transparent: true,
          format: 'image/png',
          version: '1.3.0',
          ...parameters,
        },
        enablePickFeatures: false,
      });
      _layer = _viewer.imageryLayers.addImageryProvider(provider);
      _layer.alpha = alpha;
      _ready = true;
      _lastError = null;
    } catch (error) {
      _ready = false;
      _lastError = error?.message || msg('WMS unavailable');
    }
  };

  const detach = (viewer = _viewer) => {
    if (_layer && viewer) {
      viewer.imageryLayers.remove(_layer, true);
      _layer = null;
    }
    _ready = false;
  };

  return {
    id,
    name,
    icon,
    source: sourceLabel,
    sourceId: sourceId || id,
    updateInterval,

    init(viewer) {
      if (_viewer) throw new Error(`${name} is already initialized`);
      _viewer = viewer;
      _enabled = false;
      _lastUpdate = null;
      _lastError = null;
      _ready = false;
    },

    enable() {
      _enabled = true;
      attach();
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      detach();
    },

    async update() {
      if (!_enabled) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        await source.getSnapshot({ signal: request.signal });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        if (!_layer) attach();
        _lastUpdate = Date.now();
        _lastError = _ready ? null : msg('WMS unavailable');
        return _ready;
      } catch (error) {
        if (request.signal.aborted || _request !== request) return false;
        _lastError = error?.message || msg('WMS unavailable');
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      _enabled = false;
      detach(viewer);
      _viewer = null;
      _lastUpdate = null;
      _lastError = null;
    },

    getStats() {
      return {
        count: _ready && _enabled ? 1 : 0,
        lastUpdate: _lastUpdate,
        error: _lastError,
      };
    },
  };
}

/** Capability probe used by WMS overlay sources (browser-direct when CORS allows). */
export function createWmsCapabilitySource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  capabilitiesUrl,
  label = 'WMS',
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl(capabilitiesUrl, {
        signal,
        cache: 'force-cache',
      });
      if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
      await response.arrayBuffer();
      return { ready: true, rows: [] };
    },
  };
}
