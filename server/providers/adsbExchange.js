/**
 * ADS-B Exchange stub proxy.
 *
 * A bare request to adsbexchange.com/api returns `{"NO_AUTH"}`; there is no
 * documented keyless CORS-friendly worldwide snapshot comparable to OpenSky.
 * Until ADSBX_API_KEY is set the route answers 503 {error:'no_key'} so the
 * Data Layers row can show KEY REQUIRED without crashing.
 *
 * When a key is present the proxy still returns an honest empty snapshot
 * rather than guessing at a paid RapidAPI path — wire a real upstream here
 * only after the operator documents which ADSBX product they subscribe to.
 */
export function adsbExchangeProxy() {
  const apiKey = () => String(process.env.ADSBX_API_KEY || '').trim();

  return {
    name: 'adsb-exchange-proxy',
    configureServer(server) {
      server.middlewares.use('/api/adsb-exchange', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('method not allowed');
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        if (!apiKey()) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'no_key' }));
          return;
        }
        res.statusCode = 200;
        res.setHeader('X-Feed-Source', 'ADS-B Exchange');
        res.end(
          JSON.stringify({
            fetchedAt: Date.now(),
            rows: [],
            emptyMessage:
              'ADSBX_API_KEY is set, but no documented public ADS-B Exchange snapshot is wired yet',
          }),
        );
      });
    },
  };
}
