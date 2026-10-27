import { makeRateLimiter, clientKey } from './common/rate-limit.js';

const IMAGE =
  'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic_hillshade/ImageServer/exportImage' +
  '?bbox=-180,-90,180,90&bboxSR=4326&imageSR=4326&size=2048,1024&format=png32&f=image';

/** ETOPO status: browsers load the NOAA exportImage URL directly (CORS-friendly imagery). */
export function etopoProxy({ now = () => Date.now() } = {}) {
  const allow = makeRateLimiter({ windowMs: 60_000, max: 30, globalMax: 600 });
  return {
    name: 'etopo-proxy',
    configureServer(server) {
      server.middlewares.use('/api/etopo/status', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('method not allowed');
          return;
        }
        if (!allow(clientKey(req))) {
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'rate_limited' }));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Feed-Source', 'NOAA ETOPO');
        res.end(
          JSON.stringify({
            fetchedAt: now(),
            imageUrl: IMAGE,
            note: 'Global hillshade via NOAA ImageServer exportImage (not a mesh).',
          }),
        );
      });
    },
  };
}
