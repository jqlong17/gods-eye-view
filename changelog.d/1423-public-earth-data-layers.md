- Add keyless public DATA LAYERS (Open-Meteo, GDACS, OurAirports, GEBCO,
  RainViewer, EFFIS, Aviation METAR, Argo, IOC sea level, SWPC aurora,
  EMODnet, ETOPO) with live upstream checks via `npm run test:live-layers`.
- Keep registration-required feeds (OpenAQ, ADS-B Exchange, Global Fishing
  Watch) and unreachable WorldCover / GPSJAM as UNAVAILABLE stubs without
  POWER UP registration nudges.
- Add a Filter by source control on the DATA LAYERS panel.
