- Keep the keyless globe past the boot splash when Esri World Imagery
  metadata hangs: ArcGIS `MapServer/?f=json` construction now times out after
  8 s so the existing OSM fallback can take over, and keyless terrain uses the
  same deadline before falling back to a flat ellipsoid (cursoragent, #2).
