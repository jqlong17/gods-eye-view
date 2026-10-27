export function normalizeArgoSnapshot(payload) {
  const tableRows = payload?.table?.rows;
  const list = Array.isArray(tableRows)
    ? tableRows
    : Array.isArray(payload?.rows)
      ? payload.rows
      : null;
  if (!list) return null;
  const rows = [];
  const seen = new Set();
  for (const item of list) {
    let id, lat, lon, time;
    if (Array.isArray(item)) {
      [id, lat, lon, time] = item;
    } else {
      id = item?.platform_number || item?.id;
      lat = item?.latitude ?? item?.lat;
      lon = item?.longitude ?? item?.lon;
      time = item?.time;
    }
    id = id != null ? String(id) : null;
    lat = Number(lat);
    lon = Number(lon);
    if (
      !id ||
      seen.has(id) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      continue;
    seen.add(id);
    rows.push({
      id: `argo:${id}`,
      lat,
      lon,
      name: id,
      label: `Argo ${id}`, // i18n-ignore: product name + float id
      time: typeof time === 'string' ? time : null,
      color: '#023e8a',
    });
  }
  return rows;
}
