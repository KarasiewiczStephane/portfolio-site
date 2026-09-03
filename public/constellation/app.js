/* Constellation dashboard — reads data/catalog.json (written by finalize_poc) and renders each
   POC: a georeferenced hazard raster, a per-stage frame scrubber, a district/sector score
   choropleth, a click-a-sector time series, and a backtest / basis-risk panel.
   Pure MapLibre GL + fetch; no build step. Served statically (see build.py).

   Layout (restructured 2026-07-10 per the coral review):
   - sidebar (#controls): layer dropdown + Focus, Sources button, Date/Season scrubber, score toggle, legend
   - detail (#detail): how-it-works, calibrated ladder, Backtest & basis-risk panel, and the pipeline
     flow whose steps double as the clickable map-layer control
   - modal (#modal): case study + sources (opened from the sidebar button) */

const DATA = "./data";
// Fetch the (tiny) metadata JSON fresh each load so a rebuilt POC never shows through stale
// cache. Frame PNGs are loaded by MapLibre image sources and stay cacheable.
const NOSTORE = { cache: "no-store" };
// Per-load cache-buster for raster/frame PNGs (MapLibre image sources bypass the JSON no-store),
// so a rebuilt POC's frames don't show through stale image cache. Constant within a session.
const IMG_V = "?v=" + Date.now();

const BASEMAPS = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};
let _theme = "dark";
const map = new maplibregl.Map({
  container: "map",
  style: BASEMAPS.dark,
  center: [30, 5],
  zoom: 1.6,
  hash: true, // #zoom/lat/lon shareable permalink
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

const rasterLayers = []; // ids, for the opacity slider
const legendEl = document.getElementById("legend");
const legendRamp = document.getElementById("legendRamp");
const legendUnit = document.getElementById("legendUnit");
const _entries = {};       // poc_id -> catalog entry
const _damaging = {};      // poc_id -> [observed bleaching years] (for chart marking)
const _choroWired = new Set();
const _trkWired = new Set();  // pocs whose track click-handlers are bound
const _staWired = new Set();  // pocs whose station click-handlers are bound // pocs whose choropleth click-handlers are bound (survive setStyle)
let _currentPoc = null;    // selected POC, for theme re-init

/* ---- per-peril registry -------------------------------------------------
   ONE place that knows what a peril is called, measured in, and explained by.
   Previously this was a two-way `peril === "dhw" ? coral : crop` conditional
   repeated at seven sites, which meant a THIRD peril did not get "no content" —
   it silently inherited crop's. The NZ wind POC rendered "NDVI + rainfall",
   "observed bleaching years" and "no observed yield-loss series for Bangladesh".
   Wrong content that reads as authoritative is worse than missing content, so
   the lookup falls back to a neutral entry rather than to another peril. */
const PERIL_FALLBACK = {
  color: "#58a6ff",
  unit: "",
  frames: [],
  marksLabel: null,                       // no shaded event bands unless a peril defines them
  spatialUnit: "",
  scoreLabel: "show the aggregated index",
  how: "<b>Hazard → index (the trigger) → payout.</b>",
  flow: null,                             // null = no pipeline diagram rather than a wrong one
  seasonRow: (s, trig) => `payout <b>${Math.round((s.payout_fraction || 0) * 100)}%</b>`,
  chartExplain: null,
  backtestNote: "No observed loss series is wired for this POC yet.",
  // Why the index may not track the loss. Neutral by default: a wrong mechanism caveat reads
  // as authoritative and is worse than none. See severityCaveat use in basisRiskPanel().
  severityCaveat: "The index is a proxy for the loss and the two can diverge.",
};

const CORAL = {
  color: "#f778ba",
  unit: "°C-weeks (DHW)",
  rawUnit: "°C (SST)",
  frames: [["raw_hazard", "Sea-surface temp"], ["hazard_index", "Degree Heating Weeks"]],
  marksLabel: "observed bleaching",
  spatialUnit: "z",
  scoreLabel: "show 1–10 stress score",
  how: `<b>SST → DHW (the trigger) → tiered payout.</b> The trigger variable is Degree Heating Weeks (the
         SST-derived heat dose, NOAA alert-level basis), not raw temperature. Payout tier is set by the DHW
         peak; the reef-resilience coefficient shifts the thresholds.`,
  flow: `<div class="fstep in map" data-stage="raw_hazard">Sea-surface temp (NOAA CoralTemp 5km)</div>
    <div class="farrow">Degree Heating Weeks (rolling 12-week heat stress)</div>
    <div class="fstep map" data-stage="hazard_index">Weekly DHW accumulation</div>
    <div class="farrow">aggregate to reef sectors (≥20% area rule)</div>
    <div class="fstep map" data-role="score">Sector score + time series</div>
    <div class="farrow">calibrated thresholds (resilience-shifted)</div>
    <div class="fstep">Trigger → Payout → backtest</div>`,
  seasonRow: (s) => `peak DHW <b>${s.peak_dhw}</b> → tier ${s.tier}, payout <b>${Math.round(s.payout_fraction * 100)}%</b>`,
  chartExplain: (dts) => `The line is the full-record weekly DHW; where a year's peak crosses the trigger it
       pays that tier. Compare the pink bleaching bands against the crossings to read the basis risk
       (a miss = damage without a payout).`,
  backtestNote: "No observed bleaching series is wired for this POC yet.",
  severityCaveat: "DHW is an imperfect severity proxy for bleaching.",
};

const CROP = {
  color: "#f0883e",
  unit: "z-score",
  frames: [
    ["intraseason", "Intra-season stress"], ["raw_weather", "Rainfall (raw)"], ["raw_hazard", "NDVI (raw)"],
    ["preprocessed", "NDVI (smoothed)"], ["hazard_index", "Crop-stress (seasonal)"],
  ],
  marksLabel: null,
  spatialUnit: "z",
  scoreLabel: "show 1–10 stress score",
  how: `<b>NDVI + rainfall → seasonal crop-stress index (the trigger) → payout.</b> A dry season pushes the
         standardized index below the trigger; how far below sets the payout.`,
  flow: `<div class="frow"><span class="fstep in map" data-stage="raw_hazard">Raw NDVI</span><span class="fstep in map" data-stage="raw_weather">Raw rainfall</span></div>
    <div class="farrow">smooth + standardize (z-score)</div>
    <div class="fstep map" data-stage="preprocessed">NDVI (smoothed)</div>
    <div class="farrow">dekadal cadence</div>
    <div class="frow"><span class="fstep map" data-stage="intraseason">Intra-season stress</span><span class="fstep map" data-stage="hazard_index">Seasonal crop-stress</span></div>
    <div class="farrow">aggregate to districts (≥20% area rule)</div>
    <div class="fstep map" data-role="score">District score + time series</div>
    <div class="farrow">calibrated thresholds</div>
    <div class="fstep">Trigger → Payout</div>`,
  seasonRow: (s, trig) => `index <b>${s.season_index}</b> ≤ ${trig} → payout <b>${Math.round(s.payout_fraction * 100)}%</b>`,
  chartExplain: null,
  backtestNote: "no observed yield-loss series is wired for this POC yet",
  severityCaveat: "A standardized stress index is an imperfect proxy for realised yield loss.",
};

const WIND = {
  color: "#57b9c9",
  unit: "km/h (10 m gust)",
  frames: [],                             // no per-date frames: the index is one peak per cell
  marksLabel: null,                       // no observed NZ cyclone loss series exists
  spatialUnit: "km/h",
  scoreLabel: "show peak gust per hex",
  how: `<b>ERA5 10 m gusts → peak gust per hex cell (the trigger) → tiered payout.</b> The trigger is an
         ABSOLUTE wind speed, not a standardized anomaly. Each cell takes the highest gust it saw during the
         season's cyclone events; the tier it reaches sets the payout. ⚠ Reanalysis: a backtest and pricing
         input, never a live trigger.`,
  flow: `<div class="fstep in map" data-stage="raw_hazard">ERA5 hourly 10 m gust (0.25°, WEkEO)</div>
    <div class="farrow">peak over the analysed cyclone events</div>
    <div class="fstep map" data-stage="hazard_index">Peak gust per cell</div>
    <div class="farrow">aggregate to hex cells clipped to land (≥20% area rule)</div>
    <div class="fstep map" data-role="score">Hex gust + hourly trace</div>
    <div class="farrow">absolute km/h thresholds (TC category scale)</div>
    <div class="fstep">Trigger → Payout</div>`,
  seasonRow: (s) => `peak gust <b>${s.peak_gust}</b> km/h → tier ${s.tier}, payout <b>${Math.round(s.payout_fraction * 100)}%</b>`,
  chartExplain: () => `The line is the hourly gust trace over the analysed event days; where the peak crosses a
       threshold the cell pays that tier. Values are 28 km grid averages, so exposed sites read higher.`,
  backtestNote: "no observed New Zealand cyclone loss series exists, so payout-versus-loss cannot be scored",
  severityCaveat: "A grid-averaged peak gust is an imperfect severity proxy for wind damage.",
};

const FLOOD = {
  color: "#4a7dff",                       // saturated blue: wind's #57b9c9 is a muted cyan and
                                          // the two NZ POCs must not read as the same peril
  unit: "mm (rainfall depth)",
  rawUnit: "mm/h (rain rate)",
  // Four stages, because the whole point is that the pipeline is visible: the storm moving,
  // the trigger quantity building, the location's normal, and the departure from it.
  // Only three stages have frames, and their cadences differ on purpose. Rain rate is
  // half-hourly (144 frames — the storm actually moving). Accumulation and anomaly are DAILY,
  // because the 72 h total has to be sampled the same way as the climatology it is compared
  // against; a half-hourly rolling window finds a higher maximum than one constrained to day
  // boundaries, and mixing the two would inflate every anomaly by a sampling artefact.
  // Climatology is a day-of-year field, not a series over the event, so it has no frames.
  frames: [["raw_hazard", "Rain rate (30 min)"], ["accumulation", "72-hour depth (daily)"],
           ["climatology", "Climatology"], ["anomaly", "Anomaly"]],
  marksLabel: null,                       // no spatial loss series wired yet; see the plan
  spatialUnit: "mm",
  scoreLabel: "show peak 72-hour rainfall per hex",
  how: `<b>IMERG rainfall → rolling accumulation per hex (the trigger) → tiered payout.</b> The trigger is an
         ABSOLUTE rainfall depth over a window, compared against thresholds derived from this location's own
         record. Each hex takes the wettest window it saw; the tier it reaches sets the payout.
         ⚠ Pluvial flood only — rain falling faster than drainage carries it away, not rivers leaving their
         channels. ⚠ IMERG Final lags ~3.5 months; the Early run at ~4 h is the live path, not this.`,
  flow: `<div class="fstep in map" data-stage="raw_hazard">IMERG half-hourly rain rate (0.1°, GES DISC)</div>
    <div class="farrow">rolling accumulation over 6 / 24 / 72 h</div>
    <div class="fstep map" data-stage="accumulation">Rainfall depth per cell</div>
    <div class="farrow">against this location's day-of-year normal</div>
    <div class="frow"><span class="fstep map" data-stage="climatology">Climatology</span><span class="fstep map" data-stage="anomaly">Anomaly</span></div>
    <div class="farrow">aggregate to hex cells clipped to land (≥20% area rule)</div>
    <div class="fstep map" data-role="score">Hex depth + the excess over normal</div>
    <div class="farrow">thresholds from the site's own return periods</div>
    <div class="fstep">Trigger → Payout</div>`,
  seasonRow: (s) => `peak 72 h <b>${s.peak_mm}</b> mm → tier ${s.tier}, payout <b>${Math.round(s.payout_fraction * 100)}%</b>`,
  chartExplain: () => `The line is the 72-hour rainfall total, which is what the trigger reads. The dashed line is
       this location's own normal for each date, from 15 years of record, and the shaded area between them is the
       index. The rise in mid-February is Cyclone Gabrielle, three weeks after the event. Values are ~100 km²
       cell averages, so a rain gauge inside the cell reads roughly twice as much.`,
  // Kept short deliberately: basisRiskPanel already renders the artifact's own `reason`, and
  // an equally detailed note here rendered the same sentence twice in the panel.
  backtestNote: "no per-location loss series is wired for this POC yet",
  severityCaveat: "Rainfall is the cause of pluvial flooding, not the flooding itself. Drainage capacity, antecedent wetness and imperviousness all sit between the two.",
};

const PERILS = { dhw: CORAL, mhw: { ...CORAL, unit: "°C-weeks" }, crop_hybrid: CROP, drought: CROP, cyclone_wind: WIND, pluvial_flood: FLOOD };
const perilOf = (p) => PERILS[p] || PERIL_FALLBACK;

// Short dropdown labels so the selector never overflows the sidebar (full name kept as tooltip).
const SHORT_LABEL = { coral_mayotte: "Mayotte — Coral DHW", coral_reunion: "La Réunion — Coral DHW", crop_bangladesh_full: "Bangladesh — Crop stress-index", wind_nz_2023: "New Zealand — Cyclone wind", flood_auckland_2023: "Auckland — Pluvial flood" };

// Legend as class intervals (the raster classes are evenly-spaced sample points; render the
// bands BETWEEN them, top-down, with the unit): "≥ top", "a – b", …, "< second-lowest".
function rampIntervals(classes, unit) {
  const cs = [...classes].sort((a, b) => a.level - b.level);
  const n = cs.length;
  const rows = [];
  for (let i = n - 1; i >= 0; i--) {
    // Raster class levels are computed sample points, so they arrive as 130.876 rather than
    // 131. Six decimals on a wind legend reads as false precision on a 28 km grid average.
    const r = (v) => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 100) / 100);
    const lbl = i === n - 1 ? `≥ ${r(cs[i].level)}` : i === 0 ? `&lt; ${r(cs[1].level)}` : `${r(cs[i].level)} – ${r(cs[i + 1].level)}`;
    rows.push(`<div class="ramp-row"><span class="sw" style="background:${cs[i].color}"></span>${lbl}</div>`);
  }
  return rows.join("");
}

/* ---- frame stamps ------------------------------------------------------- */
// Frame stamps are "YYYY-MM-DD" for annual/weekly series and "YYYY-MM-DDTHHMM" for
// sub-daily ones (the flood peril animates a storm at 30-minute steps). Date.parse chokes
// on the second form -- no colon -- and returns NaN, which silently broke the "keep the
// same date when switching stage" match rather than erroring.
function stampMs(str) {
  if (!str) return NaN;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})$/.exec(str);
  return Date.parse(m ? `${m[1]}T${m[2]}:${m[3]}:00Z` : str);
}
// Old published artifacts predate the flag entirely, so its absence must read as false.
const isSubDaily = (meta) => !!(meta && meta.sub_daily);

/* ---- geometry helpers --------------------------------------------------- */
function entryCenter(e) {
  if (e.raster && e.raster.hazard_index) {
    const b = e.raster.hazard_index.bbox; // [lonmin,latmin,lonmax,latmax]
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  }
  if (Array.isArray(e.center)) return e.center;
  const g = e.summary_metrics && e.summary_metrics.geometry;
  if (g && g.lon != null) return [g.lon, g.lat];
  return null;
}
function entryBounds(e) {
  const b = e.raster && e.raster.hazard_index && e.raster.hazard_index.bbox;
  if (Array.isArray(b) && b.length === 4) return [[b[0], b[1]], [b[2], b[3]]];
  if (Array.isArray(e.bbox) && e.bbox.length === 4) return [[e.bbox[0], e.bbox[1]], [e.bbox[2], e.bbox[3]]];
  return null;
}
// Frame the POC to its data extent so a small island (Mayotte, ~0.5deg) and a whole country
// (Bangladesh, ~6deg) each fill the view, instead of a one-size zoom that left Mayotte a dot.
function focusEntry(e, c) {
  const b = entryBounds(e);
  if (b) map.fitBounds(b, { padding: 60, maxZoom: 11, duration: 800 });
  else if (c) map.flyTo({ center: c, zoom: 6 });
}

/* ---- static rasters + opacity ------------------------------------------- */
function addRaster(e) {
  const r = e.raster && e.raster.hazard_index;
  if (!r) return null;
  const srcId = `raster-${e.poc_id}`, lyrId = `${srcId}-lyr`;
  map.addSource(srcId, { type: "image", url: `${DATA}/${e.poc_id}/${r.file}${IMG_V}`, coordinates: r.bounds });
  map.addLayer({ id: lyrId, type: "raster", source: srcId,
    paint: { "raster-opacity": currentOpacity(), "raster-resampling": "nearest" } });
  rasterLayers.push(lyrId);
  return lyrId;
}
function addAdmin(e) {
  if (!e.admin) return;
  const file = e.admin["1"] || e.admin["0"];
  if (!file) return;
  const srcId = `admin1-${e.poc_id}`, lyrId = `${srcId}-lyr`;
  if (map.getSource(srcId)) return;
  map.addSource(srcId, { type: "geojson", data: `${DATA}/${e.poc_id}/${file}` });
  map.addLayer({ id: lyrId, type: "line", source: srcId,
    paint: { "line-color": "#8b98a8", "line-width": 0.7, "line-opacity": 0.45 } });
}
function currentOpacity() { return document.getElementById("opacity").value / 100; }
document.getElementById("opacity").addEventListener("input", (ev) => {
  document.getElementById("opacityVal").textContent = ev.target.value + "%";
  const o = ev.target.value / 100;
  rasterLayers.forEach((id) => map.getLayer(id) && map.setPaintProperty(id, "raster-opacity", o));
});

function setLegendRamp(rows, unitText) {
  legendRamp.innerHTML = rows;
  legendUnit.textContent = unitText ? `· ${unitText}` : "";
  legendEl.classList.remove("hidden");
}
function showLegend(e, frameMeta) {
  // A POC may have no STATIC raster at all -- flood renders only frame stages -- in which
  // case the legend has to come from whichever frame stage is showing. Reading only
  // `hazard_index` left the flood legend blank, which reads as a missing feature.
  const classes = (frameMeta && frameMeta.classes)
    || (e.raster && e.raster.hazard_index && e.raster.hazard_index.classes);
  if (!classes) { legendEl.classList.add("hidden"); return; }
  const P = perilOf(e.peril);
  // The raw stage is a RATE where the others are a depth; labelling both "mm" would be wrong.
  const u = (frameMeta && frameMeta.stage === "raw_hazard" && P.rawUnit) ? P.rawUnit : P.unit;
  setLegendRamp(rampIntervals(classes, u), u);
}

/* ---- per-stage / per-date frames ---------------------------------------- */
const _frameCache = {};

async function loadFrames(poc, stage) {
  const key = `${poc}/${stage}`;
  if (key in _frameCache) return _frameCache[key];
  const meta = await fetch(`${DATA}/${poc}/_frames_${stage}.json`, NOSTORE).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  _frameCache[key] = meta;
  return meta;
}
function showFrame(poc, meta, i, peril) {
  const f = meta.frames[i];
  const srcId = `frame-${poc}`;
  const url = `${DATA}/${poc}/${f.file}${IMG_V}`;
  if (map.getSource(srcId)) {
    map.getSource(srcId).updateImage({ url, coordinates: meta.bounds });
  } else {
    map.addSource(srcId, { type: "image", url, coordinates: meta.bounds });
    map.addLayer({ id: `${srcId}-lyr`, type: "raster", source: srcId,
      paint: { "raster-opacity": currentOpacity(), "raster-resampling": "nearest" } });
    rasterLayers.push(`${srcId}-lyr`);
  }
  const staticId = `raster-${poc}-lyr`;
  if (map.getLayer(staticId)) map.setLayoutProperty(staticId, "visibility", "none");
  if (meta.classes) {
    const P = perilOf(peril);
    const u = (meta.stage === "raw_hazard" && P.rawUnit) ? P.rawUnit : P.unit;
    setLegendRamp(rampIntervals(meta.classes, u), u);
  }
}

/* ---- district-score choropleth + click-for-time-series ------------------ */
const _dts = {};
/* ---- storm tracks (context, not hazard) --------------------------------- */
// Drawn because a heatmap with no visible cause is unreadable: a reader sees colour over
// the North Island and has to take the storm on trust. These do NOT drive the index -- the
// hazard is the reanalysis gust field. A POC without tracks.geojson simply has no layer.
async function loadTracks(poc) {
  const key = `tracks/${poc}`;
  if (key in _frameCache) return _frameCache[key];
  const gj = await fetch(`${DATA}/${poc}/tracks.geojson`, NOSTORE).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (gj && gj.features.length && !map.getSource(`trk-${poc}`)) {
    map.addSource(`trk-${poc}`, { type: "geojson", data: gj });
    // A casing under the line so the track stays legible over both the hot and cold ends
    // of the gust ramp; dashed, because it is context rather than a measured surface.
    map.addLayer({ id: `trk-${poc}-case`, type: "line", source: `trk-${poc}`,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#0d1117", "line-width": 5, "line-opacity": 0.55 } });
    map.addLayer({ id: `trk-${poc}-lyr`, type: "line", source: `trk-${poc}`,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [2, 1.4], "line-opacity": 0.9 } });
    map.addLayer({ id: `trk-${poc}-lbl`, type: "symbol", source: `trk-${poc}`,
      layout: { "symbol-placement": "line-center", "text-field": ["get", "name"],
                "text-size": 11, "text-letter-spacing": 0.06, "text-offset": [0, -1.1] },
      paint: { "text-color": "#ffffff", "text-halo-color": "#0d1117", "text-halo-width": 1.6 } });

    if (!_trkWired.has(poc)) {
      map.on("click", `trk-${poc}-lyr`, (ev) => {
        const p = ev.features[0].properties;
        // `intensity_reported` arrives as a string through MapLibre's property encoding.
        const reported = p.intensity_reported === true || p.intensity_reported === "true";
        new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
          .setLngLat(ev.lngLat)
          .setHTML(`<div class="dpopup"><strong>Cyclone ${p.name}</strong>
            <div class="peril">${p.start} → ${p.end} · ${p.n_points} track points</div>
            <div class="pexplain">Closest approach to the coast <b>${p.closest_land_km} km</b>.
            ${reported
              ? `Peak 10-minute wind on track <b>${p.peak_wind_kmh} km/h</b>.`
              : `<b>No agency published an intensity for this storm inside the box.</b> The
                 track carries positions only, which is exactly why the payout index is a
                 reanalysis gust field rather than a parametric windfield fitted to the track.`}
            </div></div>`)
          .addTo(map);
      });
      map.on("mouseenter", `trk-${poc}-lyr`, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", `trk-${poc}-lyr`, () => (map.getCanvas().style.cursor = ""));
      _trkWired.add(poc);
    }
  }
  _frameCache[key] = gj;
  return gj;
}

/* ---- station checks (the honesty layer) --------------------------------- */
// The only place the map says "here is where the model was checked against an instrument".
// ⚠ The difference is a model-to-station GAP, never an "ERA5 bias": ERA5 fg10 is a model
// gust over the model's own roughness, a METAR gust is a measured 3-second peak over that
// aerodrome's actual exposure, so the number conflates the two ([[D184]]).
async function loadStations(poc) {
  const key = `sta/${poc}`;
  if (key in _frameCache) return _frameCache[key];
  const gj = await fetch(`${DATA}/${poc}/stations.geojson`, NOSTORE).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (gj && gj.features.length && !map.getSource(`sta-${poc}`)) {
    map.addSource(`sta-${poc}`, { type: "geojson", data: gj });
    map.addLayer({ id: `sta-${poc}-lyr`, type: "circle", source: `sta-${poc}`,
      paint: { "circle-radius": 6, "circle-color": "#ffffff", "circle-stroke-color": "#0d1117",
               "circle-stroke-width": 2, "circle-opacity": 0.95 } });
    map.addLayer({ id: `sta-${poc}-lbl`, type: "symbol", source: `sta-${poc}`,
      layout: { "text-field": ["get", "code"], "text-size": 10, "text-offset": [0, 1.3],
                "text-letter-spacing": 0.08 },
      paint: { "text-color": "#ffffff", "text-halo-color": "#0d1117", "text-halo-width": 1.6 } });

    if (!_staWired.has(poc)) {
      map.on("click", `sta-${poc}-lyr`, (ev) => {
        const p = ev.features[0].properties;
        const has = p.measured_kmh_lower !== undefined && p.measured_kmh_lower !== null;
        const band = has && p.measured_kmh_upper > p.measured_kmh_lower
          ? `${p.measured_kmh_lower}–${p.measured_kmh_upper}` : `${p.measured_kmh_lower}`;
        new maplibregl.Popup({ closeButton: true, maxWidth: "320px" })
          .setLngLat(ev.lngLat)
          .setHTML(`<div class="dpopup"><strong>${p.name} (${p.code})</strong>
            <div class="peril">measured aerodrome gust vs modelled cell</div>
            ${has ? `<div class="pseasons">
                <div class="srow"><span>Measured</span><span><b>${band}</b> km/h</span></div>
                <div class="srow"><span>ERA5 cell</span><span><b>${p.modelled_kmh}</b> km/h</span></div>
                <div class="srow"><span>Gap</span><span><b>${p.model_to_station_gap_kmh > 0 ? "+" : ""}${p.model_to_station_gap_kmh}</b> km/h</span></div>
              </div>
              <div class="pexplain">This is a model-to-station <b>gap</b>, not an ERA5 bias: it
              conflates model error with exposure difference. Aerodromes are sited flat and
              sheltered, so the measured value is a <b>floor</b> on the regional peak — Auckland
              read 88.9 km/h during Gabrielle while exposed capes read 150–159.
              ${p.n_censored} of ${p.n_obs} observations reported no gust, which under the
              10 kt rule bounds rather than removes them.</div>`
            : `<div class="pexplain">No archived observations for this station in the analysed window.</div>`}
          </div>`)
          .addTo(map);
      });
      map.on("mouseenter", `sta-${poc}-lyr`, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", `sta-${poc}-lyr`, () => (map.getCanvas().style.cursor = ""));
      _staWired.add(poc);
    }
  }
  _frameCache[key] = gj;
  return gj;
}

async function loadChoropleth(poc) {
  const key = `choro/${poc}`;
  if (key in _frameCache) return _frameCache[key];
  const meta = await fetch(`${DATA}/${poc}/_choropleth.json`, NOSTORE).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (meta && !map.getSource(`choro-${poc}`)) {
    map.addSource(`choro-${poc}`, { type: "geojson", data: `${DATA}/${poc}/choropleth.geojson` });
    map.addLayer({ id: `choro-${poc}-line`, type: "line", source: `choro-${poc}`,
      paint: { "line-color": "#8b98a8", "line-width": 0.6, "line-opacity": 0.55 } });
    map.addLayer({ id: `choro-${poc}-hit`, type: "fill", source: `choro-${poc}`,
      paint: { "fill-color": "#000000", "fill-opacity": 0.01 } });
    if (!_dts[poc]) _dts[poc] = await fetch(`${DATA}/${poc}/district_timeseries.json`, NOSTORE).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    // bind click/hover once — map-level listeners survive setStyle (theme swap re-adds the layer)
    if (!_choroWired.has(poc)) {
      map.on("click", `choro-${poc}-hit`, (ev) => openDistrictPopup(poc, ev.features[0].properties.name, ev.lngLat));
      map.on("mouseenter", `choro-${poc}-hit`, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", `choro-${poc}-hit`, () => (map.getCanvas().style.cursor = ""));
      _choroWired.add(poc);
    }
  }
  _frameCache[key] = meta;
  return meta;
}

// Time-series chart. Single-season series get month ticks; a multi-year series gets year ticks
// plus shaded bands on `markYears` (observed bleaching years) so trigger-crossings visibly line
// up with real events — that overlay IS the basis-risk story.
function buildChart(d, trigger, direction, markYears, markLabel) {
  const vals = d.values, n = vals.length;
  if (!n) return "";
  const above = direction === "above";
  const W = 460, H = 220, padL = 34, padR = 14, padT = 14, padB = 26;
  // A peril may ship its own climatology band (flood does): the location's normal for these
  // dates, from its own record. It is the panel that makes an anomaly index legible -- a
  // quiet normal year, and the event far outside it -- so the scale must include it.
  const band = Array.isArray(d.normal) && d.normal.length === n ? d.normal : null;
  const bandSd = band && Array.isArray(d.normal_sd) && d.normal_sd.length === n ? d.normal_sd : null;
  const bandHi = band ? band.map((m, i) => m + (bandSd ? bandSd[i] : 0)) : [];
  const lo = Math.min(trigger, ...vals) - 0.5;
  const hi = Math.max(0.5, ...vals, ...bandHi) + 0.5;
  const X = (i) => padL + ((W - padL - padR) * i) / Math.max(n - 1, 1);
  const Y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const yT = +Y(trigger).toFixed(1), y0 = +Y(0).toFixed(1);
  // mean+sd across the top, mean back along the bottom: one closed path, so it reads as a
  // band rather than two unrelated lines.
  // The EXCESS: the area between the series and its normal, which IS the index. Shading it
  // is the difference between a chart that shows a number and one that shows the subtraction.
  const excessPath = band
    ? "M" + vals.map((v, i) => `${X(i).toFixed(1)},${Y(Math.max(v, band[i])).toFixed(1)}`).join("L")
      + "L" + band.map((m, i) => `${X(n - 1 - i).toFixed(1)},${Y(band[n - 1 - i]).toFixed(1)}`).join("L") + "Z"
    : null;
  const bandPath = band
    ? "M" + band.map((m, i) => `${X(i).toFixed(1)},${Y(m + (bandSd ? bandSd[i] : 0)).toFixed(1)}`).join("L")
      + "L" + band.map((m, i) => `${X(n - 1 - i).toFixed(1)},${Y(band[n - 1 - i]).toFixed(1)}`).join("L") + "Z"
    : null;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const years = [...new Set(d.dates.map((s) => s.slice(0, 4)))];
  const singleSeason = years.length <= 1;

  // observed-bleaching bands (multi-year only)
  let bands = "";
  if (!singleSeason && Array.isArray(markYears)) {
    markYears.forEach((yr) => {
      const idx = d.dates.map((s, i) => (s.slice(0, 4) === String(yr) ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) return;
      const x0 = X(idx[0]), x1 = X(idx[idx.length - 1]);
      bands += `<rect x="${x0.toFixed(1)}" y="${padT}" width="${Math.max(x1 - x0, 2).toFixed(1)}" height="${H - padT - padB}" fill="#f7787022"/>
        <text x="${((x0 + x1) / 2).toFixed(1)}" y="${padT + 8}" fill="#f778ba" font-size="8" text-anchor="middle">${markLabel || "event"} ${yr}</text>`;
    });
  }
  // Split the series at real gaps in observation. The x-axis is INDEX-based, so a POC that
  // analyses two five-day cyclone windows a month apart was drawing them as one continuous
  // line across a month nobody measured — and the only x label was a lone "Feb" sitting on
  // the join. Segment it, and say what each segment is.
  const ts = d.dates.map((x) => Date.parse(x));
  const deltas = [];
  for (let i = 1; i < ts.length; i++) deltas.push(ts[i] - ts[i - 1]);
  const nz = deltas.filter((x) => x > 0).sort((a, b) => a - b);
  const med = nz.length ? nz[Math.floor(nz.length / 2)] : 0;
  const segs = [];
  let cur = [0];
  for (let i = 1; i < n; i++) {
    if (med && ts[i] - ts[i - 1] > med * 4) { segs.push(cur); cur = [i]; } else cur.push(i);
  }
  segs.push(cur);

  const fmt = (iso) => `${+iso.slice(8, 10)} ${MON[+iso.slice(5, 7) - 1]}`;
  const span = (a, b) => (fmt(a) === fmt(b) ? fmt(a) : `${fmt(a)} – ${fmt(b)}`);
  let ticks = "";
  if (segs.length > 1) {
    // Shade the void between windows so the break is visible, and date-label each window.
    segs.forEach((seg, k) => {
      const x0 = X(seg[0]), x1 = X(seg[seg.length - 1]);
      const a = d.dates[seg[0]], b = d.dates[seg[seg.length - 1]];
      const lbl = span(a, b);
      ticks += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${H - 8}" fill="#8b949e" font-size="9" text-anchor="middle">${lbl}</text>`;
      if (k) {
        const gx = ((X(segs[k - 1][segs[k - 1].length - 1]) + x0) / 2).toFixed(1);
        ticks += `<line x1="${gx}" y1="${padT}" x2="${gx}" y2="${H - padB}" stroke="#8b949e" stroke-width="0.6" stroke-dasharray="2 3"/>
          <text x="${gx}" y="${padT + 8}" fill="#8b949e" font-size="7.5" text-anchor="middle">not observed</text>`;
      }
    });
  } else {
    let prevKey = null;
    d.dates.forEach((dt, i) => {
      const key = singleSeason ? dt.slice(5, 7) : dt.slice(0, 4);
      if (key === prevKey) return;
      prevKey = key;
      if (i === 0) return;
      const x = X(i).toFixed(1);
      const lbl = singleSeason ? MON[(+key || 1) - 1] : key;
      ticks += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="#30363d" stroke-width="0.5"/>
        <text x="${x}" y="${H - 8}" fill="#8b949e" font-size="9" text-anchor="middle">${lbl}</text>`;
    });
  }
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="xMidYMid meet">
    ${bands}${ticks}
    ${excessPath ? `<path d="${excessPath}" fill="#4a7dff33"/>` : ""}
    ${bandPath ? `<path d="${bandPath}" fill="#8b949e33"/>
    <polyline points="${band.map((m, i) => `${X(i).toFixed(1)},${Y(m).toFixed(1)}`).join(" ")}" fill="none" stroke="#8b949e" stroke-width="1" stroke-dasharray="3 2"/>
    <text x="${W - padR}" y="${(Y(band[n - 1]) - 4).toFixed(1)}" fill="#8b949e" font-size="8.5" text-anchor="end">normal for these dates</text>` : ""}
    <line x1="${padL}" y1="${y0}" x2="${W - padR}" y2="${y0}" stroke="#484f58" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${y0 + 3}" fill="#8b949e" font-size="9" text-anchor="end">0</text>
    <rect x="${padL}" y="${(above ? padT : yT).toFixed(1)}" width="${W - padL - padR}" height="${(above ? yT - padT : H - padB - yT).toFixed(1)}" fill="#f8514914"/>
    <line x1="${padL}" y1="${yT}" x2="${W - padR}" y2="${yT}" stroke="#f85149" stroke-dasharray="4 3"/>
    <text x="${padL - 4}" y="${yT + 3}" fill="#f85149" font-size="9" text-anchor="end">${trigger}</text>
    <text x="${W - padR}" y="${yT - 4}" fill="#f85149" font-size="9" text-anchor="end">trigger (payout starts)</text>
    ${segs.map((seg) => `<polyline points="${seg.map((i) => `${X(i).toFixed(1)},${Y(vals[i]).toFixed(1)}`).join(" ")}" fill="none" stroke="#58a6ff" stroke-width="1.3"/>`).join("")}
  </svg>`;
}

function openDistrictPopup(poc, name, lngLat) {
  const dts = _dts[poc];
  const d = dts && dts.districts[name];
  if (!d) return;
  // Flood thresholds are PER CELL, so the trigger line is the district's own, not a global
  // one. `trigger_abs` is that threshold expressed in the units the chart plots (depth), the
  // conversion having been done where the normal is known rather than guessed at here.
  const trig = d.trigger_abs != null ? d.trigger_abs : dts.trigger_index;
  const dir = dts.direction || "below";
  const P = perilOf((_entries[poc] || {}).peril);
  const unit = dts.unit_label || P.unit || "index";
  const seasons = d.seasons || {};
  const rows = Object.keys(seasons).sort().map((y) => {
    const s = seasons[y];
    return `<div class="srow"><span>${y}</span><span>${P.seasonRow(s, trig)}</span></div>`;
  }).join("");
  const summary = rows || `<div class="peril">no trigger in the analysis years</div>`;
  const yrs = [...new Set((d.dates || []).map((s) => s.slice(0, 4)))];
  const dates = d.dates || [];
  // Inferred from the stamps themselves, not from how MANY there are. The old heuristic
  // read the count -- ">400 weekly, >200 hourly, else weekly" -- and so labelled the flood
  // POC's three daily points "weekly". A caption that describes the data wrongly is worse
  // than none, and the spacing is right there to be measured.
  const cadence = (() => {
    const t = dates.map((x) => Date.parse(x)).filter(Number.isFinite);
    const gaps = [];
    for (let i = 1; i < t.length; i++) if (t[i] > t[i - 1]) gaps.push(t[i] - t[i - 1]);
    if (!gaps.length) return "single value";
    gaps.sort((a, b) => a - b);
    const min = gaps[Math.floor(gaps.length / 2)] / 60000;
    return min <= 45 ? "half-hourly" : min <= 90 ? "hourly" : min <= 36 * 60 ? "daily"
         : min <= 10 * 24 * 60 ? "weekly" : "monthly";
  })();
  const period = yrs.length <= 1 ? `${yrs[0] || "one"} season, ${cadence}` : `${yrs[0]}–${yrs[yrs.length - 1]}, ${cadence}`;
  const marks = _damaging[poc] || [];
  // Band legend only where the peril HAS observed events to shade. Wind has none, and
  // "pink bands = observed bleaching years" on a New Zealand map is another peril's caption.
  const bandNote = (P.marksLabel && marks.length) ? ` Pink bands = ${P.marksLabel} years.` : "";
  const chartCap = `<div class="pcap">Line = ${unit}, <b>${period}</b>. Dashed red = trigger.${bandNote} Every year's peak-vs-trigger is the basis risk.</div>`;
  const explain = dts.payout_formula
    ? `<b>Trigger</b>: ${dts.trigger_label || trig}. <b>Payout</b>: ${dts.payout_formula}.` +
      (P.chartExplain ? ` ${P.chartExplain(dts)}` : "")
    : `<b>Trigger</b>: season index ≤ ${trig} z. <b>Payout</b> = clip((${trig} − index) / 1.5, 0, 1).`;
  // Caveats the pipeline attached to the artifact travel to the panel rather than being
  // re-typed here, so they cannot drift from what the run actually produced.
  const caveat = dts.source_caveat ? `<div class="pcap">${dts.source_caveat}</div>` : "";
  const html = `<div class="dpopup"><strong>${name}</strong>
    <div class="peril">${unit}</div>
    ${buildChart(d, trig, dir, marks, P.marksLabel)}
    ${chartCap}
    <details class="pdetails"><summary>Per-year peak &amp; payout (${Object.keys(seasons).length})</summary>
      <div class="pseasons">${summary}</div></details>
    <div class="pexplain">${explain}</div>
    ${caveat}
  </div>`;
  new maplibregl.Popup({ maxWidth: "500px", closeButton: true }).setLngLat(lngLat).setHTML(html).addTo(map);
}

function paintChoropleth(poc, meta, year, on) {
  const lyrId = `choro-${poc}-lyr`;
  if (!on) { if (map.getLayer(lyrId)) map.setLayoutProperty(lyrId, "visibility", "none"); return; }
  // `score_property` is declared in every _choropleth.json and was being ignored while this
  // hardcoded `score_${year}`. Coral and crop happen to match that pattern; wind paints raw
  // km/h (`gust_{year}`), so the hardcoded name resolved to undefined and every hex fell
  // through to the null colour. Honour the declared field.
  const prop = (meta.score_property || "score_{year}").replace("{year}", year);
  // Ramp stops key on `score` for the 1-10 perils and on `threshold` for perils whose index
  // is an absolute physical quantity. A gust in km/h must NOT be squashed into a 1-10 score
  // just to fit the older shape — the number on the legend is the number on the map.
  // Stops must be STRICTLY ASCENDING. The old form prepended its own `0, "#30363d"`
  // no-data anchor, which collided with wind's first ramp stop (threshold 0, "below
  // Cat 1") and made the whole expression invalid — MapLibre then painted nothing, so
  // every hex sat dark while the legend looked perfect. Coral and crop start at score 1
  // and never hit it.
  const stops = [];
  let last = -Infinity;
  for (const [v, c] of meta.ramp.map((r) => [r.score ?? r.threshold, r.color]).sort((a, b) => a[0] - b[0])) {
    if (v > last) { stops.push(v, c); last = v; }
  }
  // `case`/`has` rather than a coalesce-to-zero, so a polygon with NO value is distinct
  // from one whose value genuinely is zero.
  const fill = ["case", ["has", prop],
    ["interpolate", ["linear"], ["to-number", ["get", prop]], ...stops], "#30363d"];
  if (map.getLayer(lyrId)) {
    map.setPaintProperty(lyrId, "fill-color", fill);
    map.setLayoutProperty(lyrId, "visibility", "visible");
  } else {
    map.addLayer({ id: lyrId, type: "fill", source: `choro-${poc}`,
      paint: { "fill-color": fill, "fill-opacity": 0.75, "fill-outline-color": "#0d1117" } });
  }
}
// Every POC's raster and frame layers persist on the map once loaded, and setPixelVisible
// only ever touched the ACTIVE one — so a previously-viewed POC kept painting underneath.
// Invisible until two POCs overlapped geographically: the flood and cyclone POCs cover the
// same New Zealand box, and the wind gust raster showed through the flood hexes as a tan
// wash. Coral and crop never revealed it because they are oceans apart.
function hideOtherPocLayers(activePoc) {
  const style = map.getStyle();
  if (!style || !style.layers) return;
  for (const l of style.layers) {
    // raster-<poc>-lyr, frame-<poc>-lyr, choro-<poc>-lyr|-line|-hit, trk-<poc>-*, sta-<poc>-*
    const m = /^(?:raster|frame|choro|trk|sta)-(.+?)-(?:lyr|line|hit|case|lbl)$/.exec(l.id);
    if (m && m[1] !== activePoc && map.getLayer(l.id)) {
      map.setLayoutProperty(l.id, "visibility", "none");
    }
  }
}
function setPixelVisible(poc, on) {
  const frameId = `frame-${poc}-lyr`, staticId = `raster-${poc}-lyr`;
  if (map.getLayer(frameId)) {
    map.setLayoutProperty(frameId, "visibility", on ? "visible" : "none");
    if (map.getLayer(staticId)) map.setLayoutProperty(staticId, "visibility", "none");
  } else if (map.getLayer(staticId)) {
    map.setLayoutProperty(staticId, "visibility", on ? "visible" : "none");
  }
}

/* ---- detail panel: how-it-works, ladder, basis-risk, pipeline ----------- */
async function openDetail(e) {
  const base = `${DATA}/${e.poc_id}`;
  const [summary, thresh, kase] = await Promise.all([
    fetch(`${base}/summary.json`, NOSTORE).then((r) => r.json()).catch(() => ({})),
    fetch(`${base}/calibrated_thresholds.json`, NOSTORE).then((r) => r.json()).catch(() => null),
    fetch(`${base}/case.json`, NOSTORE).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  // wire the sidebar Sources button -> modal
  const sBtn = document.getElementById("sourcesBtn");
  if (kase) { sBtn.classList.remove("hidden"); sBtn.onclick = () => openSourcesModal(e, kase); }
  // Cleared, not just hidden: the handler closed over the PREVIOUS POC's case study, so on a
  // POC without one the button opened another peril's claims under this peril's name.
  else { sBtn.classList.add("hidden"); sBtn.onclick = null; }

  const howHtml = `<div class="section"><h3>How it works</h3><p class="how">${perilOf(e.peril).how}</p></div>`;

  const ladder = Array.isArray(thresh) ? thresh : thresh && thresh.ladder;
  const ladderHtml = Array.isArray(ladder) ? `<div class="section"><h3>Calibrated ladder</h3><table class="ladder">
      <tr><th>Tier</th><th>Threshold</th><th>Payout</th></tr>
      ${ladder.map((t) => `<tr><td>${t.tier}</td><td>${t.threshold}</td><td>${t.payout_pct ?? Math.round((t.payout_fraction || 0) * 100)}%</td></tr>`).join("")}
    </table>
    <p class="fine">Modeled payouts on an illustrative €${(summary.limit_eur || 0).toLocaleString()} limit — not a premium.</p></div>` : "";

  document.getElementById("detailBody").innerHTML = `
    <h2>${e.display_name || e.poc_id}</h2>
    <div class="peril">${e.peril} · ${e.schema || "generic"}</div>
    ${howHtml}
    ${ladderHtml}
    ${basisRiskPanel(e.poc_id, summary)}
    ${pipelineFlow(e.peril) ? `<div class="section"><h3>Pipeline</h3>${pipelineFlow(e.peril)}</div>` : ""}`;
  document.getElementById("detail").classList.remove("hidden");
  showLegend(e);
  wireControls(e);
}

// Backtest & basis-risk panel — the differentiated deliverable. Built from summary.json's
// basis_risk block (no extra fetch); the 16-year outcome grid is classified from
// years_paid vs years_damaging over the analysis span.
function basisRiskPanel(poc, summary) {
  const bx = summary.basis_risk;
  if (!bx) return "";
  const pred = bx.prediction || {};
  const PB = perilOf((_entries[poc] || {}).peril);
  // Crop / spatial-only: no observed yield-loss series, so no predictive backtest. Show the
  // real spatial basis risk + payout stats and say the hit-rate backtest is pending real data.
  if (!Array.isArray(pred.years_paid)) {
    const sp = bx.spatial || {};
    const tiles = [];
    if (sp.mean_spatial_std != null) tiles.push(`<div class="tile gap"><div class="v">${sp.mean_spatial_std.toFixed(2)}</div><div class="k">spatial basis</div></div>`);
    if (summary.expected_payout_fraction != null) tiles.push(`<div class="tile good"><div class="v">${Math.round(summary.expected_payout_fraction * 100)}%</div><div class="k">exp. payout</div></div>`);
    const nev = summary.n_events != null ? summary.n_events : summary.n_polygons_triggered;
    if (nev != null) tiles.push(`<div class="tile warn"><div class="v">${nev}</div><div class="k">trigger events</div></div>`);
    if (!tiles.length) return "";
    return `<div class="section"><h3>Basis risk</h3>
      <div class="tiles">${tiles.join("")}</div>
      <p class="fine">Spatial basis risk = within-polygon heterogeneity of the index (mean std ${sp.mean_spatial_std != null ? sp.mean_spatial_std.toFixed(2) : "—"}, max ${sp.max_spatial_std != null ? sp.max_spatial_std.toFixed(2) : "—"} ${PB.spatialUnit}).</p>
      <p class="fine"><b>Predictive backtest N/A</b> — ${PB.backtestNote}${pred.reason ? ` (${pred.reason})` : ""}. Provide an observed loss series and the hit-rate / false-positive / outcome grid switches on.</p>
    </div>`;
  }
  const br = pred;
  const ev = PB.marksLabel || "event";
  const paid = new Set(br.years_paid || []);
  const dmg = new Set(br.years_damaging || []);
  _damaging[poc] = [...dmg];                       // used to shade the chart bands
  const [y0, y1] = summary.analysis_period || [Math.min(...paid, ...dmg), Math.max(...paid, ...dmg)];

  // loss-cost = mean island-level annual payout fraction over the span (pure-premium rate)
  let lossCostHtml = "";
  const d = _dts[poc];
  if (d && summary.limit_eur) {
    let sum = 0, cnt = 0;
    for (let y = y0; y <= y1; y++) {
      let best = 0;
      for (const name in d.districts) {
        const s = (d.districts[name].seasons || {})[String(y)];
        if (s && s.payout_fraction > best) best = s.payout_fraction;
      }
      sum += best; cnt++;
    }
    if (cnt) {
      const rate = (sum / cnt) * 100;
      lossCostHtml = `<p class="fine">Technical loss-cost ≈ <b>${rate.toFixed(1)}%</b> of limit / yr
        (mean modeled annual payout ÷ limit) — a pure loss-cost, not a quoted premium.</p>`;
    }
  }

  let grid = "";
  for (let y = y0; y <= y1; y++) {
    const p = paid.has(y), dg = dmg.has(y);
    const cls = p && dg ? "tp" : p && !dg ? "fp" : !p && dg ? "miss" : "tn";
    grid += `<div class="yr ${cls}" title="${y}: ${p ? "paid" : "no payout"}, ${dg ? ev + " observed" : "no event"}">${String(y).slice(2)}</div>`;
  }
  const pct = (x) => (x == null ? "—" : x <= 1 ? x.toFixed(2) : x.toFixed(2));

  // Narrative is DERIVED, never hardcoded. It used to be written for Mayotte (3 events, one
  // dry-fire) and rendered verbatim under La Réunion's tiles, where the truth is 2 events and
  // six dry-fires — i.e. the prose contradicted the false-pos tile directly above it. On a
  // dashboard whose whole pitch is data integrity, that is the one bug you cannot ship.
  const nEvents = dmg.size;
  const nDry = [...paid].filter((y) => !dmg.has(y)).length;
  const nMiss = [...dmg].filter((y) => !paid.has(y)).length;
  const nYears = br.n_years != null ? br.n_years : y1 - y0 + 1;
  const plural = (n, one, many) => (n === 1 ? `one ${one}` : `${n} ${many}`);

  const caught = nEvents === 0
    ? `No documented ${ev} years in the record — nothing to score`
    : nMiss === 0
    ? `Caught every documented ${ev} year (hit rate ${pct(br.hit_rate)})`
    : `Caught ${nEvents - nMiss} of ${nEvents} documented ${ev} ${nEvents - nMiss === 1 ? "year" : "years"} (hit rate ${pct(br.hit_rate)}), ${plural(nMiss, "miss", "misses")}`;
  const dryPhrase = nDry === 0 ? "no dry-fires" : plural(nDry, "dry-fire", "dry-fires");

  return `<div class="section"><h3>Backtest &amp; basis risk · ${y0}–${y1}</h3>
    <div class="tiles">
      <div class="tile good"><div class="v">${pct(br.hit_rate)}</div><div class="k">hit rate</div></div>
      <div class="tile warn"><div class="v">${pct(br.false_positive_rate)}</div><div class="k">false pos</div></div>
      <div class="tile gap"><div class="v">${pct(br.basis_risk_gap)}</div><div class="k">basis gap</div></div>
    </div>
    <div class="grid16">${grid}</div>
    <div class="gridkey">
      <span><i class="tp"></i>caught</span><span><i class="fp"></i>dry-fire</span>
      <span><i class="miss"></i>miss</span><span><i class="tn"></i>quiet</span>
    </div>
    <p class="fine">${caught}; ${dryPhrase}; the basis gap (${pct(br.basis_risk_gap)}) is the
      payout-vs-severity mismatch an audit shrinks.</p>
    <p class="fine caveat">Caveat: metrics rest on ${plural(nEvents, "event", "events")} over ${nYears} yrs,
      too few to calibrate on. ${PB.severityCaveat} Treat as directional,
      not calibrated.</p>
    ${lossCostHtml}</div>`;
}

// Pipeline flow doubles as the map-layer control: steps tagged `.map` with a data-stage
// (or data-role="score") are clickable and drive the map. Non-layer steps stay static.
function pipelineFlow(peril) {
  const f = perilOf(peril).flow;
  if (!f) return "";                       // no diagram beats another peril's diagram
  return `<p class="flowtip">Click a step to show it on the map.</p><div class="flow">${f}</div>`;
}

/* ---- sources modal ------------------------------------------------------ */
function openSourcesModal(e, kase) {
  const src = (kase.sources || []).map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`).join(" · ");
  // `body` and `caveats` are optional: POCs that only carry a summary render exactly as
  // before, and the ones with more to say get it rather than having it silently dropped.
  const body = // Coerced: a `body` written as one string rather than an array of paragraphs threw here,
  // and because the throw happened mid-render the modal kept the PREVIOUS POC's content --
  // so the flood POC presented the cyclone wind case study under its own name. A claims panel
  // must fail visibly, never by showing someone else's claims.
  (Array.isArray(kase.body) ? kase.body : String(kase.body || "").split(/\n{2,}/).filter(Boolean)).map((t) => `<p class="mbody">${t}</p>`).join("");
  const cav = (kase.caveats || []).length
    ? `<div class="mcav"><b>What this is not</b><ul>${kase.caveats.map((c) => `<li>${c}</li>`).join("")}</ul></div>`
    : "";
  document.getElementById("modalBody").innerHTML = `
    <h3>${kase.title || e.display_name}</h3>
    <p class="msum">${kase.summary || ""}</p>
    ${body}${cav}
    ${src ? `<p class="msrc"><b>Sources</b><br>${src}</p>` : ""}`;
  document.getElementById("modal").classList.remove("hidden");
}
document.getElementById("modalClose").addEventListener("click", () => document.getElementById("modal").classList.add("hidden"));
document.getElementById("modal").addEventListener("click", (ev) => {
  if (ev.target.id === "modal") document.getElementById("modal").classList.add("hidden");
});

/* ---- controls: stage buttons (bottom-left), date/season + score (sidebar) */
let _wireGen = 0;                     // bumped per POC switch; stale runs bail out

async function wireControls(e) {
  const poc = e.poc_id;
  const gen = ++_wireGen;

  // Reset SYNCHRONOUSLY, before the first await. wireControls is fire-and-forget, so two
  // quick POC switches interleave: the old POC's call resolves last and re-shows its own
  // controls over the new map. That is how the NZ wind view ended up with coral's
  // "208 frames · 2010-2024" scrubber above a km/h legend. Hide first, show only what the
  // new POC actually has.
  document.getElementById("scrubSec").classList.add("hidden");
  document.getElementById("scoreSec").classList.add("hidden");
  document.getElementById("scrubHint").textContent = "";
  document.getElementById("dateSelect").innerHTML = "";

  const avail = {}; // stage -> meta (only stages with frames on disk)
  for (const [stage] of perilOf(e.peril).frames) {
    const meta = await loadFrames(poc, stage);
    if (gen !== _wireGen) return;                 // superseded mid-flight
    if (meta && meta.frames.length) avail[stage] = meta;
  }
  const choroMeta = await loadChoropleth(poc);
  if (gen !== _wireGen) return;
  await loadTracks(poc);
  if (gen !== _wireGen) return;
  await loadStations(poc);
  if (gen !== _wireGen) return;

  const dateSel = document.getElementById("dateSelect");
  const seasonBtn = document.getElementById("seasonBtn");
  const scoreOn = document.getElementById("scoreOn");
  const scoreYear = document.getElementById("scoreYear");
  const scrubHint = document.getElementById("scrubHint");
  const scrubSec = document.getElementById("scrubSec");
  const scoreSec = document.getElementById("scoreSec");
  const steps = [...document.querySelectorAll("#detailBody .fstep.map")];
  hideOtherPocLayers(poc);   // a previously-viewed POC must not paint under this one
  const scoreLabel = document.getElementById("scoreLabel");
  // "show 1-10 stress score" is a crop/coral phrase. Wind's cells carry km/h, not a score.
  if (scoreLabel) scoreLabel.textContent = perilOf(e.peril).scoreLabel || "show the aggregated index";

  let activeStage = avail["hazard_index"] ? "hazard_index" : Object.keys(avail)[0] || null;
  const activeMeta = () => (activeStage ? avail[activeStage] : null);
  const activeYear = () => {
    const m = activeMeta();
    if (m) return m.frames[+dateSel.value || 0].date.slice(0, 4);
    return choroMeta ? String(choroMeta.years[choroMeta.years.length - 1]) : "";
  };
  const markSteps = () => steps.forEach((s) => s.classList.toggle("active",
    scoreOn.checked ? s.dataset.role === "score" : s.dataset.stage === activeStage));
  const repaintScore = () => {
    if (!choroMeta) return;
    const yr = activeYear();
    scoreYear.textContent = choroMeta.years.includes(+yr) ? `${yr} season` : `${yr} (no score)`;
    paintChoropleth(poc, choroMeta, yr, scoreOn.checked);
    setPixelVisible(poc, !scoreOn.checked);
    if (scoreOn.checked) {
      setLegendRamp(choroMeta.ramp.map((r) => `<div class="ramp-row"><span class="sw" style="background:${r.color}"></span>${r.label ?? r.score}${r.threshold ? ` <span class="rlvl">≥ ${r.threshold}</span>` : ""}</div>`).join(""),
        (choroMeta.scale && choroMeta.scale.unit) || "1–10 score");
    } else {
      showLegend(e, activeMeta());   // score off -> the ACTIVE STAGE's ramp, not the last shown
    }
    markSteps();
  };
  const showActiveFrame = () => { if (activeMeta() && !scoreOn.checked) showFrame(poc, activeMeta(), +dateSel.value || 0, e.peril); };
  const onScrub = () => { showActiveFrame(); repaintScore(); };

  function populateDates() {
    const m = activeMeta();
    if (!m) { scrubSec.classList.add("hidden"); return; }
    // `label` is the renderer's display string, already shifted to local time where the
    // peril asked for it. Falling back to `date` keeps every pre-existing artifact working.
    dateSel.innerHTML = m.frames.map((f, i) => `<option value="${i}">${f.label || f.date}</option>`).join("");
    if (isSubDaily(m)) {
      // "48 frames · 2023" is true and useless for a storm that lasts a day. Show the span
      // being animated, and say the labels are local so nobody reads them as UTC.
      const first = m.frames[0], last = m.frames[m.frames.length - 1];
      const tz = m.tz_hours ? " NZDT" : " UTC";
      scrubHint.textContent = `${m.frames.length} frames · ${first.label || first.date} → ${last.label || last.date}${tz}`;
    } else {
      const ys = [...new Set(m.frames.map((f) => f.date.slice(0, 4)))];
      scrubHint.textContent = `${m.frames.length} frames · ${ys.length === 1 ? ys[0] : ys[0] + "–" + ys[ys.length - 1]}`;
    }
    scrubSec.classList.remove("hidden");
  }

  // the pipeline steps are the map-layer control
  steps.forEach((s) => {
    const stage = s.dataset.stage, role = s.dataset.role;
    if (stage && !avail[stage]) { s.classList.add("disabled"); return; }
    s.addEventListener("click", () => {
      if (role === "score") { if (choroMeta) { scoreOn.checked = true; onScrub(); } return; }
      // keep the same DATE when switching stage so you can compare datasets at one date.
      // Stages resample on different 7-day anchors, so match the NEAREST date, not exact.
      const cur = activeMeta() ? activeMeta().frames[+dateSel.value || 0].date : null;
      activeStage = stage; scoreOn.checked = false;
      populateDates();
      let idx = 0;
      if (cur) {
        const ct = stampMs(cur); let best = Infinity;
        avail[stage].frames.forEach((f, i) => { const d = Math.abs(stampMs(f.date) - ct); if (d < best) { best = d; idx = i; } });
      }
      dateSel.value = String(idx);
      onScrub();
    });
  });

  // Cleared unconditionally. These are assigned per POC, and when a POC has NO frames --
  // wind's index is one peak per cell, not an animation -- the old assignments survived and
  // still closed over the PREVIOUS POC's `poc` and `avail`, so a stray change event could
  // repaint a frame belonging to a map nobody was looking at.
  dateSel.onchange = null;
  seasonBtn.onclick = null;
  scoreOn.onchange = null;
  if (Object.keys(avail).length) {
    populateDates();
    dateSel.onchange = onScrub;
    // "Peak" jumps to the highest-index week among the shown frames (from the sector series)
    seasonBtn.onclick = () => {
      const m = activeMeta(); if (!m) return;
      const fdates = new Set(m.frames.map((f) => f.date));
      const d = _dts[poc]; let peakDate = null, peak = -Infinity;
      if (d) for (const name in d.districts) {
        const dd = d.districts[name];
        dd.values.forEach((v, i) => { if (fdates.has(dd.dates[i]) && v > peak) { peak = v; peakDate = dd.dates[i]; } });
      }
      const fi = peakDate ? m.frames.findIndex((f) => f.date === peakDate) : -1;
      dateSel.value = String(fi >= 0 ? fi : Math.floor(m.frames.length / 2));
      scoreOn.checked = false; onScrub();
    };
  } else scrubSec.classList.add("hidden");

  if (choroMeta) { scoreSec.classList.remove("hidden"); scoreOn.onchange = () => { repaintScore(); showActiveFrame(); }; }
  else scoreSec.classList.add("hidden");

  onScrub();
}

document.getElementById("closeDetail").addEventListener("click", () =>
  document.getElementById("detail").classList.add("hidden"));

/* ---- layer selection (dropdown + markers + Focus) ----------------------- */
function selectLayer(pocId, refocus = true) {
  const e = _entries[pocId];
  if (!e) return;
  _currentPoc = pocId;
  document.getElementById("layerSelect").value = pocId;
  if (refocus) focusEntry(e, entryCenter(e));
  openDetail(e);
}

// Dark/light toggle: swap the CSS theme + basemap. Markers persist across setStyle; rasters,
// frames and the choropleth are style layers, so re-add them once the new style loads (camera
// is preserved). Frame/choro click-handlers are guarded (_choroWired) against double-binding.
function toggleTheme() {
  _theme = _theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", _theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = _theme === "light" ? "☾ Dark" : "☀ Light";
  const cur = _currentPoc;
  rasterLayers.length = 0;
  // keep _choroWired: map-level layer click handlers survive setStyle, so re-binding would double them
  for (const k in _frameCache) delete _frameCache[k];  // force frame/choro sources to re-add
  map.setStyle(BASEMAPS[_theme]);
  // setStyle doesn't reliably re-fire "style.load", and re-adding on an intermediate "styledata"
  // gets wiped by the final style. "idle" fires once the new style is fully loaded AND rendered.
  map.once("idle", () => {
    Object.values(_entries).forEach((e) => { addRaster(e); addAdmin(e); });
    if (cur) selectLayer(cur, false); // re-open detail + re-add layers, keep camera
  });
}
document.getElementById("themeToggle").addEventListener("click", toggleTheme);

let _populated = false;
async function populate() {
  if (_populated) return;
  _populated = true;
  let catalog;
  try {
    catalog = await fetch(`${DATA}/catalog.json`, NOSTORE).then((r) => r.json());
  } catch (err) {
    document.getElementById("controls").insertAdjacentHTML("beforeend",
      `<p style="color:#f85149">catalog.json not found — run <code>python dashboard/build.py</code></p>`);
    return;
  }
  const sel = document.getElementById("layerSelect");
  catalog.forEach((e) => {
    _entries[e.poc_id] = e;
    addRaster(e);
    addAdmin(e);
    const c = entryCenter(e);
    if (c) {
      const marker = new maplibregl.Marker({ color: perilOf(e.peril).color }).setLngLat(c).addTo(map);
      marker.getElement().style.cursor = "pointer";
      marker.getElement().addEventListener("click", () => selectLayer(e.poc_id));
    }
    sel.insertAdjacentHTML("beforeend", `<option value="${e.poc_id}" title="${e.display_name || e.poc_id}">${SHORT_LABEL[e.poc_id] || e.display_name || e.poc_id}</option>`);
  });
  sel.onchange = () => selectLayer(sel.value);
  document.getElementById("focusBtn").onclick = () => { const e = _entries[sel.value]; if (e) focusEntry(e, entryCenter(e)); };
  // open the first POC by default so the dashboard is never blank
  if (catalog.length) selectLayer(catalog[0].poc_id);
}

map.on("style.load", populate);
map.on("load", populate);
if (map.isStyleLoaded()) populate();
