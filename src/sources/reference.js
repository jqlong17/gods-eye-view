import { createUsgsEarthquakeSource } from '../layers/earthquakes/source.js';
import { createEcccAirQualitySource } from '../layers/airQuality/source.js';
import { createWfigsPerimeterSource } from '../layers/perimeters/source.js';
import { createBundledCableSource } from '../layers/submarineCables/bundledSource.js';
import { createAdsbGnssSource } from '../layers/gnss/source.js';
import { createOpenMeteoSource } from '../layers/openMeteo/source.js';
import { createOpenAqSource } from '../layers/openaq/source.js';
import { createGdacsSource } from '../layers/gdacs/source.js';
import { createOurAirportsSource } from '../layers/ourairports/source.js';
import { createAdsbExchangeSource } from '../layers/adsbExchange/source.js';
import { createFishingWatchSource } from '../layers/fishingWatch/source.js';
import { createGebcoSource } from '../layers/gebco/source.js';
import { createRainViewerSource } from '../layers/rainviewer/source.js';
import { createEffisSource } from '../layers/effis/source.js';
import { createWorldCoverSource } from '../layers/worldcover/index.js';
import { createAviationMetarSource } from '../layers/aviationMetar/source.js';
import { createArgoSource } from '../layers/argo/source.js';
import { createIocSeaLevelSource } from '../layers/iocSeaLevel/source.js';
import { createSwpcAuroraSource } from '../layers/swpcAurora/source.js';
import { createEmodnetSource } from '../layers/emodnet/source.js';
import { createEtopoSource } from '../layers/etopo/source.js';
import { createGpsjamSource } from '../layers/gpsjam/index.js';

/** Construct the existing reference feeds independently of application setup. */
export function createReferenceSources() {
  return {
    earthquakes: createUsgsEarthquakeSource(),
    'air-quality': createEcccAirQualitySource(),
    'fire-perimeters': createWfigsPerimeterSource(),
    cables: createBundledCableSource(),
    'gnss-integrity': createAdsbGnssSource(),
    'open-meteo': createOpenMeteoSource(),
    openaq: createOpenAqSource(),
    gdacs: createGdacsSource(),
    ourairports: createOurAirportsSource(),
    'adsb-exchange': createAdsbExchangeSource(),
    'fishing-watch': createFishingWatchSource(),
    'gebco-bathymetry': createGebcoSource(),
    rainviewer: createRainViewerSource(),
    effis: createEffisSource(),
    worldcover: createWorldCoverSource(),
    'aviation-metar': createAviationMetarSource(),
    'argo-floats': createArgoSource(),
    'ioc-sea-level': createIocSeaLevelSource(),
    'swpc-aurora': createSwpcAuroraSource(),
    'emodnet-bathymetry': createEmodnetSource(),
    'etopo-bathymetry': createEtopoSource(),
    gpsjam: createGpsjamSource(),
  };
}
