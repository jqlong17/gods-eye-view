const msg = (text) => text;

const ALERT_COLORS = Object.freeze({
  Red: '#c1121f',
  Orange: '#ff6b35',
  Green: '#90be6d',
});

const EVENT_LABELS = Object.freeze({
  EQ: msg('Earthquake'),
  TC: msg('Tropical cyclone'),
  FL: msg('Flood'),
  VO: msg('Volcano'),
  DR: msg('Drought'),
  WF: msg('Wildfire'),
});

/**
 * Normalize a GDACS GeoJSON FeatureCollection into point rows.
 * @returns {Array<object>|null}
 */
export function normalizeGdacsSnapshot(geojson) {
  if (!Array.isArray(geojson?.features) && !Array.isArray(geojson?.rows))
    return null;
  const features = Array.isArray(geojson.features)
    ? geojson.features
    : geojson.rows;
  const rows = [];
  const ids = new Set();
  for (const feature of features) {
    const props = feature?.properties || feature;
    const geometry = feature?.geometry;
    let lon;
    let lat;
    if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
      lon = Number(geometry.coordinates[0]);
      lat = Number(geometry.coordinates[1]);
    } else {
      lon = Number(props?.lon ?? props?.longitude);
      lat = Number(props?.lat ?? props?.latitude);
    }
    const eventtype = String(props?.eventtype || '').toUpperCase();
    const eventid = props?.eventid != null ? String(props.eventid) : null;
    if (
      !eventid ||
      !eventtype ||
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      Math.abs(lon) > 180 ||
      Math.abs(lat) > 90
    )
      continue;
    const id = `gdacs:${eventtype}:${eventid}`;
    if (ids.has(id)) continue;
    ids.add(id);
    const alertlevel = String(props?.alertlevel || 'Orange');
    const name =
      typeof props?.name === 'string' && props.name.trim()
        ? props.name.trim()
        : typeof props?.eventname === 'string' && props.eventname.trim()
          ? props.eventname.trim()
          : `${EVENT_LABELS[eventtype] || eventtype} ${eventid}`;
    const reportUrl =
      typeof props?.url?.report === 'string'
        ? props.url.report
        : typeof props?.reportUrl === 'string'
          ? props.reportUrl
          : null;
    rows.push({
      id,
      lat,
      lon,
      name,
      label: `${alertlevel} · ${name}`,
      eventtype,
      eventid,
      alertlevel,
      color: ALERT_COLORS[alertlevel] || ALERT_COLORS.Orange,
      country: typeof props?.country === 'string' ? props.country : null,
      fromdate: typeof props?.fromdate === 'string' ? props.fromdate : null,
      reportUrl,
      radiusM: alertlevel === 'Red' ? 40_000 : 25_000,
    });
  }
  return rows;
}
