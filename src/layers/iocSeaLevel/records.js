export function normalizeIocSnapshot(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rows)
      ? payload.rows
      : null;
  if (!list) return null;
  const rows = [];
  const seen = new Set();
  for (const item of list) {
    const code = item?.Code || item?.code || item?.id;
    const lat = Number(item?.Lat ?? item?.lat);
    const lon = Number(item?.Lon ?? item?.lon);
    if (
      !code ||
      seen.has(code) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      continue;
    seen.add(code);
    const name =
      typeof item?.Location === 'string' && item.Location.trim()
        ? item.Location.trim()
        : String(code);
    const value = Number(item?.lastvalue);
    const country =
      typeof item?.countryname === 'string' ? item.countryname : null;
    rows.push({
      id: `ioc:${code}`,
      lat,
      lon,
      name,
      label: Number.isFinite(value)
        ? `${name} · ${value.toFixed(2)} m`
        : name,
      value: Number.isFinite(value) ? value : null,
      country,
      color: '#219ebc',
    });
  }
  return rows;
}
