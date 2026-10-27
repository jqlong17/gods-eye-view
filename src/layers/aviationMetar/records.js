const msg = (text) => text;

export function normalizeMetarSnapshot(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rows)
      ? payload.rows
      : null;
  if (!list) return null;
  const rows = [];
  for (const item of list) {
    const id = item?.icaoId || item?.icao || item?.id;
    const lat = Number(item?.lat);
    const lon = Number(item?.lon);
    if (
      !id ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      continue;
    const temp = Number(item?.temp);
    const flightCategory =
      typeof item?.fltCat === 'string' ? item.fltCat : null;
    const cover = typeof item?.cover === 'string' ? item.cover : null;
    const labelParts = [String(id)];
    if (Number.isFinite(temp)) labelParts.push(`${Math.round(temp)}°C`);
    if (flightCategory) labelParts.push(flightCategory);
    rows.push({
      id: `metar:${id}`,
      lat,
      lon,
      name: String(id),
      label: labelParts.join(' · '),
      temp: Number.isFinite(temp) ? temp : null,
      flightCategory,
      cover,
      rawOb: typeof item?.rawOb === 'string' ? item.rawOb : null,
      color:
        flightCategory === 'LIFR'
          ? '#c1121f'
          : flightCategory === 'IFR'
            ? '#ff6b35'
            : flightCategory === 'MVFR'
              ? '#ffd43b'
              : '#4cc9f0',
    });
  }
  return rows;
}
