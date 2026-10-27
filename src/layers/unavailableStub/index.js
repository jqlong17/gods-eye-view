import { msg } from '../../i18n/marker.js';

/**
 * A DATA LAYERS row that stays UNAVAILABLE until an env var is set, or
 * permanently unavailable when a public keyless feed does not exist.
 */
export function createUnavailableStubLayer({
  id,
  name,
  icon = '◦',
  source: sourceLabel,
  sourceId = id,
  envVar = null,
  reason = null,
  source,
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError(`${name || id} requires a snapshot source`);

  let _enabled = false;
  let _keyRequired = false;
  let _lastError = null;
  let _lastUpdate = null;
  let _request = null;

  const missingMessage = () =>
    envVar
      ? msg(`${envVar} is not set`)
      : reason || msg('Feed unavailable');

  return {
    id,
    name,
    icon,
    source: sourceLabel,
    sourceId,
    updateInterval: 600_000,

    init() {
      _enabled = false;
      _keyRequired = false;
      _lastError = null;
      _lastUpdate = null;
    },

    enable() {
      _enabled = true;
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
    },

    async update() {
      if (!_enabled) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const payload = await source.getSnapshot({ signal: request.signal });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        if (payload?.keyRequired === true) {
          _keyRequired = true;
          _lastError = missingMessage();
          return false;
        }
        _keyRequired = false;
        _lastUpdate = Date.now();
        _lastError =
          typeof payload?.emptyMessage === 'string'
            ? payload.emptyMessage
            : reason || msg('No observations');
        return false;
      } catch (error) {
        if (request.signal.aborted || _request !== request) return false;
        _lastError = error?.message || missingMessage();
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy() {
      _request?.abort();
      _request = null;
      _enabled = false;
      _lastError = null;
      _lastUpdate = null;
    },

    getStats() {
      return {
        count: 0,
        lastUpdate: _lastUpdate,
        keyRequired: _keyRequired,
        error: _keyRequired ? missingMessage() : _lastError,
      };
    },
  };
}

/** Snapshot source that always reports a missing key / unavailable feed. */
export function createUnavailableStubSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  statusUrl = null,
  envVar = null,
  permanentReason = null,
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      if (!statusUrl) {
        return {
          keyRequired: Boolean(envVar),
          emptyMessage: permanentReason || null,
        };
      }
      const response = await fetchImpl(statusUrl, {
        signal,
        cache: 'no-store',
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        /* ignore */
      }
      signal?.throwIfAborted();
      if (response.status === 503 && payload?.error === 'no_key')
        return { keyRequired: true };
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
      return {
        rows: Array.isArray(payload?.rows) ? payload.rows : [],
        emptyMessage: payload?.emptyMessage || permanentReason,
      };
    },
  };
}
