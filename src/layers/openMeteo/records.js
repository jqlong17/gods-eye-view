const msg = (text) => text;

/** WMO weather interpretation codes used by Open-Meteo → short labels. */
export function openMeteoWeatherLabel(code) {
  const n = Number(code);
  if (!Number.isFinite(n)) return msg('Weather');
  if (n === 0) return msg('Clear');
  if (n <= 3) return msg('Cloudy');
  if (n <= 48) return msg('Fog');
  if (n <= 57) return msg('Drizzle');
  if (n <= 67) return msg('Rain');
  if (n <= 77) return msg('Snow');
  if (n <= 82) return msg('Showers');
  if (n <= 86) return msg('Snow showers');
  if (n <= 99) return msg('Thunderstorm');
  return msg('Weather');
}

function asPoint(entry, fallback) {
  const current = entry?.current;
  const lat = Number(entry?.latitude ?? fallback?.lat);
  const lon = Number(entry?.longitude ?? fallback?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const temperatureC = Number(current?.temperature_2m);
  const weatherCode = Number(current?.weather_code);
  const windKmh = Number(current?.wind_speed_10m);
  const windDir = Number(current?.wind_direction_10m);
  const id = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  const label = Number.isFinite(temperatureC)
    ? `${Math.round(temperatureC)}° · ${openMeteoWeatherLabel(weatherCode)}`
    : openMeteoWeatherLabel(weatherCode);
  return {
    id,
    lat,
    lon,
    label,
    temperatureC: Number.isFinite(temperatureC) ? temperatureC : null,
    weatherCode: Number.isFinite(weatherCode) ? weatherCode : null,
    windKmh: Number.isFinite(windKmh) ? windKmh : null,
    windDir: Number.isFinite(windDir) ? windDir : null,
    observedAt:
      typeof current?.time === 'string' ? `${current.time}Z` : null,
  };
}

/**
 * Normalize an Open-Meteo forecast payload (single object or array) into rows.
 * @returns {Array<object>|null}
 */
export function normalizeOpenMeteoSnapshot(payload, points = []) {
  const entries = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? [payload]
      : null;
  if (!entries) return null;
  const rows = [];
  for (let i = 0; i < entries.length; i++) {
    const row = asPoint(entries[i], points[i]);
    if (!row) return null;
    rows.push(row);
  }
  return rows;
}
