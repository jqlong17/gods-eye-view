import { createWmsCapabilitySource } from '../wmsOverlay/createWmsOverlayLayer.js';

export function createGebcoSource(options = {}) {
  return createWmsCapabilitySource({
    capabilitiesUrl:
      'https://wms.gebco.net/mapserv?service=WMS&request=GetCapabilities',
    label: 'GEBCO', // i18n-ignore: product name
    ...options,
  });
}
