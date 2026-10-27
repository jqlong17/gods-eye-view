import {
  createUnavailableStubLayer,
  createUnavailableStubSource,
} from '../unavailableStub/index.js';
import { msg } from '../../i18n/marker.js';

export function createGpsjamSource(options) {
  return createUnavailableStubSource({
    permanentReason: msg(
      'GPSJAM has no documented keyless public JSON/tile API; GNSS Integrity already uses adsb.lol',
    ),
    ...options,
  });
}

export function createGpsjamLayer(options) {
  return createUnavailableStubLayer({
    id: 'gpsjam',
    name: 'GPSJAM',
    icon: '⌖',
    source: 'GPSJAM',
    sourceId: 'gpsjam',
    reason: msg(
      'No documented keyless GPSJAM feed; use GNSS Integrity (adsb.lol)',
    ),
    ...options,
  });
}
