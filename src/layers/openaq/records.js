const msg = (text) => text;

/** Rough US AQI-style bands from a PM2.5 µg/m³ value when OpenAQ sends one. */
export function openaqBandFromPm25(ugm3) {
  const v = Number(ugm3);
  if (!Number.isFinite(v)) return null;
  if (v <= 12) return { id: 'low', label: msg('Good'), color: '#4cc9f0' };
  if (v <= 35.4)
    return { id: 'moderate', label: msg('Moderate'), color: '#ffd43b' };
  if (v <= 55.4)
    return { id: 'high', label: msg('Unhealthy for sensitive'), color: '#ff6b35' };
  return { id: 'very-high', label: msg('Unhealthy'), color: '#c1121f' };
}

function pickLatestPm25(sensors) {
  if (!Array.isArray(sensors)) return null;
  for (const sensor of sensors) {
    const name = String(
      sensor?.parameter?.name || sensor?.parameter?.displayName || '',
    ).toLowerCase();
    if (name !== 'pm25' && name !== 'pm2.5') continue;
    const value = Number(sensor?.latest?.value ?? sensor?.value);
    if (!Number.isFinite(value)) continue;
    return value;
  }
  return null;
}

/**
 * Normalize OpenAQ v3 locations into globe rows.
 * @returns {Array<object>|null}
 */
export function normalizeOpenAqSnapshot(payload) {
  const results = Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.rows)
      ? payload.rows
      : null;
  if (!results) return null;
  const rows = [];
  for (const item of results) {
    const id = item?.id != null ? String(item.id) : null;
    const coords = item?.coordinates || item?.geometry?.coordinates;
    let lat;
    let lon;
    if (Array.isArray(coords) && coords.length >= 2) {
      lon = Number(coords[0]);
      lat = Number(coords[1]);
    } else {
      lat = Number(coords?.latitude ?? item?.lat);
      lon = Number(coords?.longitude ?? item?.lon);
    }
    if (
      !id ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      continue;
    const pm25 = pickLatestPm25(item?.sensors || item?.parameters);
    const band = openaqBandFromPm25(pm25);
    const name =
      typeof item?.name === 'string' && item.name.trim()
        ? item.name.trim()
        : `Station ${id}`;
    rows.push({
      id: `openaq:${id}`,
      lat,
      lon,
      name,
      // i18n-ignore: station name + pollutant code
      label: band ? `${name} · PM2.5 ${Math.round(pm25)}` : name,
      pm25,
      color: band?.color || '#6b7785',
      band: band?.id || null,
      risk: band?.label || msg('No recent PM2.5'),
    });
  }
  return rows;
}
