import { createFishingWatchLayer } from '../../layers/fishingWatch/index.js';
import { overlayHost } from './overlayHost.js';

export function createApplicationFishingWatch(options) {
  return createFishingWatchLayer({ overlayHost, ...options });
}
