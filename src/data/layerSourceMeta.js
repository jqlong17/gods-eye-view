import { msg } from '../i18n/marker.js';

/**
 * Stable data-source ids for DATA LAYERS filtering.
 * `sourceLabel` is English presentation text (translated at the panel).
 */
export const LAYER_SOURCE_META = Object.freeze({
  flights: Object.freeze({
    sourceId: 'opensky',
    sourceLabel: msg('OpenSky / adsb.lol'),
  }),
  military: Object.freeze({
    sourceId: 'adsb-lol',
    sourceLabel: msg('adsb.lol'),
  }),
  'local-adsb': Object.freeze({
    sourceId: 'local-adsb',
    sourceLabel: msg('Local ADS-B'),
  }),
  'ais-live-vessels': Object.freeze({
    sourceId: 'aisstream',
    sourceLabel: msg('AISStream'),
  }),
  traffic: Object.freeze({
    sourceId: 'tomtom-osm',
    sourceLabel: msg('TomTom / OSM'),
  }),
  transit: Object.freeze({
    sourceId: 'transit',
    sourceLabel: msg('Transit agencies'),
  }),
  bikeshare: Object.freeze({
    sourceId: 'gbfs',
    sourceLabel: msg('GBFS'),
  }),
  cctv: Object.freeze({ sourceId: 'cctv', sourceLabel: msg('CCTV packs') }),
  'recent-imagery': Object.freeze({
    sourceId: 'nasa-gibs',
    sourceLabel: msg('NASA GIBS'),
  }),
  'street-level': Object.freeze({
    sourceId: 'street-level',
    sourceLabel: msg('Street Level'),
  }),
  'alpr-cameras': Object.freeze({
    sourceId: 'osm',
    sourceLabel: msg('OpenStreetMap'),
  }),
  'military-installations': Object.freeze({
    sourceId: 'osm',
    sourceLabel: msg('OpenStreetMap'),
  }),
  'local-datacenters': Object.freeze({
    sourceId: 'bundled',
    sourceLabel: msg('Bundled'),
  }),
  'local-dams': Object.freeze({
    sourceId: 'bundled',
    sourceLabel: msg('Bundled'),
  }),
  'telegeography-submarine-cables': Object.freeze({
    sourceId: 'telegeography',
    sourceLabel: msg('TeleGeography'),
  }),
  earthquakes: Object.freeze({
    sourceId: 'usgs',
    sourceLabel: msg('USGS'),
  }),
  'local-firms': Object.freeze({
    sourceId: 'nasa-firms',
    sourceLabel: msg('NASA FIRMS'),
  }),
  'fire-perimeters': Object.freeze({
    sourceId: 'nifc',
    sourceLabel: msg('NIFC WFIGS'),
  }),
  'gnss-integrity': Object.freeze({
    sourceId: 'adsb-lol',
    sourceLabel: msg('adsb.lol'),
  }),
  's2-ghostmaps': Object.freeze({
    sourceId: 's2-ghostmaps',
    sourceLabel: msg('S2 Underground'),
  }),
  satellites: Object.freeze({
    sourceId: 'celestrak',
    sourceLabel: msg('CelesTrak'),
  }),
  'rocket-launches': Object.freeze({
    sourceId: 'launch-library',
    sourceLabel: msg('Launch Library 2'),
  }),
  'military-awareness': Object.freeze({
    sourceId: 'derived',
    sourceLabel: msg('Derived'),
  }),
  wind: Object.freeze({
    sourceId: 'noaa-ecmwf',
    sourceLabel: msg('NOAA / ECMWF'),
  }),
  'weather-radar': Object.freeze({
    sourceId: 'noaa-nowcoast',
    sourceLabel: msg('NOAA nowCOAST'),
  }),
  'weather-satellite': Object.freeze({
    sourceId: 'noaa-nowcoast',
    sourceLabel: msg('NOAA nowCOAST'),
  }),
  'weather-lightning': Object.freeze({
    sourceId: 'noaa-nowcoast',
    sourceLabel: msg('NOAA nowCOAST'),
  }),
  'weather-cyclones': Object.freeze({
    sourceId: 'noaa-nhc',
    sourceLabel: msg('NOAA NHC / CPHC'),
  }),
  'air-quality': Object.freeze({
    sourceId: 'eccc',
    sourceLabel: msg('ECCC'),
  }),
  directions: Object.freeze({
    sourceId: 'osrm',
    sourceLabel: msg('OSRM / FOSSGIS'),
  }),
  radio: Object.freeze({
    sourceId: 'radio-browser',
    sourceLabel: msg('Radio Browser'),
  }),
  'open-meteo': Object.freeze({
    sourceId: 'open-meteo',
    sourceLabel: msg('Open-Meteo'),
  }),
  openaq: Object.freeze({
    sourceId: 'openaq',
    sourceLabel: msg('OpenAQ'),
  }),
  gdacs: Object.freeze({ sourceId: 'gdacs', sourceLabel: msg('GDACS') }),
  ourairports: Object.freeze({
    sourceId: 'ourairports',
    sourceLabel: msg('OurAirports'),
  }),
  'adsb-exchange': Object.freeze({
    sourceId: 'adsb-exchange',
    sourceLabel: msg('ADS-B Exchange'),
  }),
  'fishing-watch': Object.freeze({
    sourceId: 'gfw',
    sourceLabel: msg('Global Fishing Watch'),
  }),
  'gebco-bathymetry': Object.freeze({
    sourceId: 'gebco',
    sourceLabel: msg('GEBCO'),
  }),
  rainviewer: Object.freeze({
    sourceId: 'rainviewer',
    sourceLabel: msg('RainViewer'),
  }),
  effis: Object.freeze({ sourceId: 'effis', sourceLabel: msg('EFFIS') }),
  worldcover: Object.freeze({
    sourceId: 'esa-worldcover',
    sourceLabel: msg('ESA WorldCover'),
  }),
  'aviation-metar': Object.freeze({
    sourceId: 'aviationweather',
    sourceLabel: msg('Aviation Weather Center'),
  }),
  'argo-floats': Object.freeze({
    sourceId: 'argo',
    sourceLabel: msg('Argo'),
  }),
  'ioc-sea-level': Object.freeze({
    sourceId: 'ioc',
    sourceLabel: msg('IOC Sea Level'),
  }),
  'swpc-aurora': Object.freeze({
    sourceId: 'noaa-swpc',
    sourceLabel: msg('NOAA SWPC'),
  }),
  'emodnet-bathymetry': Object.freeze({
    sourceId: 'emodnet',
    sourceLabel: msg('EMODnet'),
  }),
  'etopo-bathymetry': Object.freeze({
    sourceId: 'noaa-etopo',
    sourceLabel: msg('NOAA ETOPO'),
  }),
  gpsjam: Object.freeze({
    sourceId: 'gpsjam',
    sourceLabel: msg('GPSJAM'),
  }),
});

/** Resolve source metadata for a layer id, falling back to its declared source. */
export function layerSourceMeta(layer) {
  const id = layer?.id;
  const known = id && Object.hasOwn(LAYER_SOURCE_META, id)
    ? LAYER_SOURCE_META[id]
    : null;
  const sourceId =
    layer?.sourceId || known?.sourceId || (id ? String(id) : 'unknown');
  const sourceLabel =
    layer?.sourceLabel ||
    known?.sourceLabel ||
    layer?.source ||
    sourceId;
  return { sourceId, sourceLabel };
}
