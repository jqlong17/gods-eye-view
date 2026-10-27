/**
 * Normalize OurAirports airport rows (already filtered upstream).
 * @returns {Array<object>|null}
 */
export function normalizeOurAirportsSnapshot(payload) {
  const list = Array.isArray(payload?.rows)
    ? payload.rows
    : Array.isArray(payload)
      ? payload
      : null;
  if (!list) return null;
  const rows = [];
  for (const item of list) {
    const id = item?.id != null ? String(item.id) : null;
    const lat = Number(item?.lat ?? item?.latitude_deg);
    const lon = Number(item?.lon ?? item?.longitude_deg);
    const name =
      typeof item?.name === 'string' && item.name.trim()
        ? item.name.trim()
        : null;
    if (
      !id ||
      !name ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      continue;
    const iata =
      typeof item?.iata === 'string' && item.iata.trim()
        ? item.iata.trim().toUpperCase()
        : typeof item?.iata_code === 'string' && item.iata_code.trim()
          ? item.iata_code.trim().toUpperCase()
          : null;
    const icao =
      typeof item?.icao === 'string' && item.icao.trim()
        ? item.icao.trim().toUpperCase()
        : typeof item?.icao_code === 'string' && item.icao_code.trim()
          ? item.icao_code.trim().toUpperCase()
          : null;
    const type = typeof item?.type === 'string' ? item.type : null;
    rows.push({
      id: `airport:${id}`,
      lat,
      lon,
      name,
      iata,
      icao,
      type,
      label: iata ? `${iata} · ${name}` : name,
      radiusM: type === 'large_airport' ? 10_000 : 6_000,
    });
  }
  return rows;
}

/** Parse OurAirports CSV text into the filtered airport subset we ship. */
export function parseOurAirportsCsv(text) {
  if (typeof text !== 'string' || !text.includes('\n')) return null;
  const lines = text.split(/\r?\n/);
  const header = lines[0];
  if (!header) return null;
  const cols = splitCsvLine(header);
  const index = Object.fromEntries(cols.map((name, i) => [name, i]));
  const required = [
    'id',
    'type',
    'name',
    'latitude_deg',
    'longitude_deg',
    'scheduled_service',
    'iata_code',
    'icao_code',
  ];
  if (required.some((name) => index[name] == null)) return null;
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = splitCsvLine(line);
    const type = cells[index.type] || '';
    const scheduled = cells[index.scheduled_service] || '';
    if (
      type !== 'large_airport' &&
      !(type === 'medium_airport' && scheduled === 'yes')
    )
      continue;
    const lat = Number(cells[index.latitude_deg]);
    const lon = Number(cells[index.longitude_deg]);
    const id = cells[index.id];
    const name = cells[index.name];
    if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon))
      continue;
    rows.push({
      id,
      type,
      name,
      lat,
      lon,
      iata: cells[index.iata_code] || null,
      icao: cells[index.icao_code] || null,
    });
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
