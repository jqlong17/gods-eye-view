import {
  createUnavailableStubLayer,
  createUnavailableStubSource,
} from '../unavailableStub/index.js';
import { msg } from '../../i18n/marker.js';

export function createWorldCoverSource(options) {
  return createUnavailableStubSource({
    permanentReason: msg(
      'ESA WorldCover WMS (Terrascope) unreachable from this environment; see DATA_SOURCES.md',
    ),
    ...options,
  });
}

export function createWorldCoverLayer(options) {
  return createUnavailableStubLayer({
    id: 'worldcover',
    name: 'ESA WorldCover',
    icon: '▤',
    source: 'ESA WorldCover',
    sourceId: 'esa-worldcover',
    reason: msg(
      'ESA WorldCover WMS (Terrascope) unreachable; see DATA_SOURCES.md',
    ),
    ...options,
  });
}
