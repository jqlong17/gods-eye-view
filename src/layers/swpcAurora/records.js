/** Downsample OVATION aurora grid cells above a probability threshold. */
export function normalizeAuroraSnapshot(payload, { threshold = 20, stride = 4 } = {}) {
  const coords = payload?.coordinates;
  if (!Array.isArray(coords)) return null;
  const rows = [];
  for (let i = 0; i < coords.length; i += Math.max(1, stride)) {
    const cell = coords[i];
    if (!Array.isArray(cell) || cell.length < 3) continue;
    const lon = Number(cell[0]);
    const lat = Number(cell[1]);
    const aurora = Number(cell[2]);
    if (
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(aurora) ||
      aurora < threshold ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      continue;
    rows.push({
      id: `aurora:${lat},${lon}`,
      lat,
      lon,
      name: `Aurora ${Math.round(aurora)}%`,
      label: `${Math.round(aurora)}%`,
      aurora,
      color:
        aurora >= 60 ? '#c1121f' : aurora >= 40 ? '#ff6b35' : '#90be6d',
      radiusM: 18_000,
    });
  }
  return rows;
}
