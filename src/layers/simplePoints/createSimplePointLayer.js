import * as Cesium from 'cesium';
import { msg } from '../../i18n/marker.js';

/**
 * A compact Cesium point/ellipse layer for keyless snapshot feeds.
 * Callers supply row→visual mapping; acquisition stays in each source module.
 */
export function createSimplePointLayer({
  id,
  name,
  icon = '•',
  source: sourceLabel,
  sourceId = id,
  updateInterval = 300_000,
  overlaySourceId = id,
  overlayCohortLimit = 48,
  overlayCollisionCapacity = 32,
  markerRadiusM = 8_000,
  requiresKeyId = null,
  colorFor = () => Cesium.Color.fromCssColorString('#4cc9f0'),
  labelFor = (row) => row.label || row.name || row.id,
  priorityFor = () => 0,
  source,
  overlayHost,
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError(`${name || id} requires a snapshot source`);
  if (!overlayHost)
    throw new TypeError(`${name || id} requires an overlay host`);

  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _rows = [];
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _keyRequired = false;
  let _enabled = false;
  let _emptyMessage = null;

  const viewRectangle = () => {
    const rectangle = _viewer?.camera?.computeViewRectangle?.();
    if (!rectangle) return null;
    const toDeg = Cesium.Math.toDegrees;
    return {
      west: toDeg(rectangle.west),
      south: toDeg(rectangle.south),
      east: toDeg(rectangle.east),
      north: toDeg(rectangle.north),
    };
  };

  const layer = {
    id,
    name,
    icon,
    source: sourceLabel,
    sourceId,
    updateInterval,
    ...(requiresKeyId ? { requiresKeyId } : {}),

    init(viewer) {
      if (_viewer) throw new Error(`${name} is already initialized`);
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource(id);
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      _rows = [];
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _keyRequired = false;
      _emptyMessage = null;
      _enabled = false;
      overlayHost.setVisible(overlaySourceId, false);
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost.setVisible(overlaySourceId, true);
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
      overlayHost.clearSource(overlaySourceId);
      overlayHost.setVisible(overlaySourceId, false);
    },

    async update() {
      if (!_enabled || !_dataSource) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const view = viewRectangle();
        // Single-options form matches earthquakes / air-quality / FIRMS sources.
        const payload = await source.getSnapshot({
          view,
          signal: request.signal,
        });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;

        if (payload?.keyRequired === true) {
          _keyRequired = true;
          _rows = [];
          _count = 0;
          _lastError = msg('KEY REQUIRED');
          _emptyMessage = null;
          _dataSource.entities.removeAll();
          overlayHost.clearSource(overlaySourceId);
          return false;
        }

        _keyRequired = false;
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.rows)
            ? payload.rows
            : null;
        if (!rows) throw new Error(msg('Malformed snapshot'));
        _rows = rows;
        _count = rows.length;
        _lastUpdate = Date.now();
        _lastError = null;
        _emptyMessage =
          _count === 0
            ? typeof payload?.emptyMessage === 'string'
              ? payload.emptyMessage
              : msg('No observations in view')
            : null;
        this._render();
        return true;
      } catch (error) {
        if (request.signal.aborted || _request !== request) return false;
        _lastError = error?.message || msg('Feed unavailable');
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    _render() {
      if (!_dataSource) return;
      _dataSource.entities.removeAll();
      const overlayEntries = [];
      for (const row of _rows) {
        if (!Number.isFinite(row.lon) || !Number.isFinite(row.lat)) continue;
        const position = Cesium.Cartesian3.fromDegrees(row.lon, row.lat);
        const color = colorFor(row);
        const radius =
          typeof row.radiusM === 'number' && Number.isFinite(row.radiusM)
            ? row.radiusM
            : markerRadiusM;
        _dataSource.entities.add(
          new Cesium.Entity({
            id: `${id}:${row.id}`,
            position,
            ellipse: {
              semiMajorAxis: radius,
              semiMinorAxis: radius,
              material: new Cesium.ColorMaterialProperty(color.withAlpha(0.35)),
              outline: true,
              outlineColor: color.withAlpha(0.9),
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            properties: { ...row },
          }),
        );
        overlayEntries.push({
          id: String(row.id),
          position,
          variant: 'label',
          title: String(labelFor(row) || row.id),
          accent: color.toCssColorString(),
          priority: priorityFor(row),
          collisionGroup: 'ambient-label',
          paintLane: 'ambient-label',
          interactive: false,
          edgeFade: 'keyhole',
          horizonCull: true,
          terrainOcclusion: false,
          gapPx: 15,
          verticalOnly: true,
          placement: 'above',
        });
      }
      if (_enabled) {
        const capped = overlayEntries
          .slice()
          .sort(
            (a, b) =>
              b.priority - a.priority || String(a.id).localeCompare(String(b.id)),
          )
          .slice(0, overlayCohortLimit);
        overlayHost.setEntries(overlaySourceId, capped, {
          cohortLimit: overlayCohortLimit,
          collisionCapacity: overlayCollisionCapacity,
          moving: false,
        });
      }
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      _enabled = false;
      overlayHost.clearSource(overlaySourceId);
      overlayHost.setVisible(overlaySourceId, false);
      if (_dataSource) {
        viewer?.dataSources?.remove(_dataSource, true);
        _dataSource = null;
      }
      _viewer = null;
      _rows = [];
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _keyRequired = false;
      _emptyMessage = null;
    },

    getStats() {
      return {
        count: _count,
        lastUpdate: _lastUpdate,
        keyRequired: _keyRequired,
        // English data for the panel / HUD; presentation translates.
        error: _keyRequired
          ? msg('KEY REQUIRED')
          : _lastError || _emptyMessage,
      };
    },
  };
  return layer;
}
