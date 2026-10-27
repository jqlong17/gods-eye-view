import { createWmsCapabilitySource } from '../wmsOverlay/createWmsOverlayLayer.js';

export function createEffisSource(options = {}) {
  return createWmsCapabilitySource({
    capabilitiesUrl:
      'https://maps.effis.emergency.copernicus.eu/effis?service=WMS&request=GetCapabilities',
    label: 'EFFIS', // i18n-ignore: product name
    ...options,
  });
}
