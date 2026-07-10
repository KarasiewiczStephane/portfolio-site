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
const PERIL_COLOR = { drought: "#f0883e", dhw: "#f778ba", mhw: "#a371f7" };

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
const _choroWired = new Set(); // pocs whose choropleth click-handlers are bound (survive setStyle)
let _currentPoc = null;    // selected POC, for theme re-init

const UNIT_BY_PERIL = { dhw: "°C-weeks (DHW)", mhw: "°C-weeks", drought: "z-score" };
// Short dropdown labels so the selector never overflows the sidebar (full name kept as tooltip).
const SHORT_LABEL = { coral_mayotte: "Mayotte — Coral DHW", crop_bangladesh_full: "Bangladesh — Crop stress-index" };

// Legend as class intervals (the raster classes are evenly-spaced sample points; render the
// bands BETWEEN them, top-down, with the unit): "≥ top", "a – b", …, "< second-lowest".
function rampIntervals(classes, unit) {
  const cs = [...classes].sort((a, b) => a.level - b.level);
  const n = cs.length;
  const rows = [];
  for (let i = n - 1; i >= 0; i--) {
    const lbl = i === n - 1 ? `≥ ${cs[i].level}` : i === 0 ? `&lt; ${cs[1].level}` : `${cs[i].level} – ${cs[i + 1].level}`;
    rows.push(`<div class="ramp-row"><span class="sw" style="background:${cs[i].color}"></span>${lbl}</div>`);
  }
  return rows.join("");
}

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
function showLegend(e) {
  const r = e.raster && e.raster.hazard_index;
  if (!r || !r.classes) { legendEl.classList.add("hidden"); return; }
  const u = UNIT_BY_PERIL[e.peril] || "";
  setLegendRamp(rampIntervals(r.classes, u), u);
}

/* ---- per-stage / per-date frames ---------------------------------------- */
const FRAME_STAGES_CROP = [
  ["intraseason", "Intra-season stress"], ["raw_weather", "Rainfall (raw)"], ["raw_hazard", "NDVI (raw)"],
  ["preprocessed", "NDVI (smoothed)"], ["hazard_index", "Crop-stress (seasonal)"],
];
// Coral DHW has only two genuinely distinct pixel views: the raw SST input and the DHW index.
// (The generic "intra-season" stage renders byte-identical to hazard_index for this peril.)
const FRAME_STAGES_CORAL = [
  ["raw_hazard", "Sea-surface temp"],
  ["hazard_index", "Degree Heating Weeks"],
];
const frameStages = (peril) => (peril === "dhw" || peril === "mhw") ? FRAME_STAGES_CORAL : FRAME_STAGES_CROP;
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
    const u = meta.stage === "raw_hazard" && (peril === "dhw" || peril === "mhw") ? "°C (SST)" : (UNIT_BY_PERIL[peril] || "");
    setLegendRamp(rampIntervals(meta.classes, u), u);
  }
}

/* ---- district-score choropleth + click-for-time-series ------------------ */
const _dts = {};
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
function buildChart(d, trigger, direction, markYears) {
  const vals = d.values, n = vals.length;
  if (!n) return "";
  const above = direction === "above";
  const W = 460, H = 220, padL = 34, padR = 14, padT = 14, padB = 26;
  const lo = Math.min(trigger, ...vals) - 0.5, hi = Math.max(0.5, ...vals) + 0.5;
  const X = (i) => padL + ((W - padL - padR) * i) / Math.max(n - 1, 1);
  const Y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const line = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const yT = +Y(trigger).toFixed(1), y0 = +Y(0).toFixed(1);
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
        <text x="${((x0 + x1) / 2).toFixed(1)}" y="${padT + 8}" fill="#f778ba" font-size="8" text-anchor="middle">bleaching ${yr}</text>`;
    });
  }
  let ticks = "", prevKey = null;
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
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="xMidYMid meet">
    ${bands}${ticks}
    <line x1="${padL}" y1="${y0}" x2="${W - padR}" y2="${y0}" stroke="#484f58" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${y0 + 3}" fill="#8b949e" font-size="9" text-anchor="end">0</text>
    <rect x="${padL}" y="${(above ? padT : yT).toFixed(1)}" width="${W - padL - padR}" height="${(above ? yT - padT : H - padB - yT).toFixed(1)}" fill="#f8514914"/>
    <line x1="${padL}" y1="${yT}" x2="${W - padR}" y2="${yT}" stroke="#f85149" stroke-dasharray="4 3"/>
    <text x="${padL - 4}" y="${yT + 3}" fill="#f85149" font-size="9" text-anchor="end">${trigger}</text>
    <text x="${W - padR}" y="${yT - 4}" fill="#f85149" font-size="9" text-anchor="end">trigger (payout starts)</text>
    <polyline points="${line}" fill="none" stroke="#58a6ff" stroke-width="1.3"/>
  </svg>`;
}

function openDistrictPopup(poc, name, lngLat) {
  const dts = _dts[poc];
  const d = dts && dts.districts[name];
  if (!d) return;
  const trig = dts.trigger_index;
  const dir = dts.direction || "below";
  const unit = dts.unit_label || "Intra-season crop-stress (z-score, lower = worse)";
  const seasons = d.seasons || {};
  const rows = Object.keys(seasons).sort().map((y) => {
    const s = seasons[y];
    const detail = s.peak_dhw !== undefined
      ? `peak DHW <b>${s.peak_dhw}</b> → tier ${s.tier}, payout <b>${Math.round(s.payout_fraction * 100)}%</b>`
      : `index <b>${s.season_index}</b> ≤ ${trig} → payout <b>${Math.round(s.payout_fraction * 100)}%</b>`;
    return `<div class="srow"><span>${y}</span><span>${detail}</span></div>`;
  }).join("");
  const summary = rows || `<div class="peril">no trigger in the analysis years</div>`;
  const yrs = [...new Set((d.dates || []).map((s) => s.slice(0, 4)))];
  const period = yrs.length <= 1 ? `${yrs[0] || "one"} season, weekly` : `${yrs[0]}–${yrs[yrs.length - 1]}, weekly`;
  const marks = _damaging[poc] || [];
  const chartCap = `<div class="pcap">Line = ${unit}, <b>${period}</b>. Dashed red = trigger; pink bands = observed bleaching years. Every year's peak-vs-trigger is the basis risk.</div>`;
  const explain = dts.payout_formula
    ? `<b>Trigger</b>: ${dts.trigger_label || trig}. <b>Payout</b>: ${dts.payout_formula}. The line is the full-record
       weekly DHW; where a year's peak crosses the trigger it pays that tier. Compare the pink bleaching bands against
       the crossings to read the basis risk (a miss = damage without a payout).`
    : `<b>Trigger</b>: season index ≤ ${trig} z. <b>Payout</b> = clip((${trig} − index) / 1.5, 0, 1).`;
  const html = `<div class="dpopup"><strong>${name}</strong>
    <div class="peril">${unit}</div>
    ${buildChart(d, trig, dir, marks)}
    ${chartCap}
    <details class="pdetails"><summary>Per-year peak &amp; payout (${Object.keys(seasons).length})</summary>
      <div class="pseasons">${summary}</div></details>
    <div class="pexplain">${explain}</div>
  </div>`;
  new maplibregl.Popup({ maxWidth: "500px", closeButton: true }).setLngLat(lngLat).setHTML(html).addTo(map);
}

function paintChoropleth(poc, meta, year, on) {
  const lyrId = `choro-${poc}-lyr`;
  if (!on) { if (map.getLayer(lyrId)) map.setLayoutProperty(lyrId, "visibility", "none"); return; }
  const prop = `score_${year}`;
  const stops = meta.ramp.flatMap((r) => [r.score, r.color]);
  const fill = ["interpolate", ["linear"], ["coalesce", ["get", prop], 0], 0, "#30363d", ...stops];
  if (map.getLayer(lyrId)) {
    map.setPaintProperty(lyrId, "fill-color", fill);
    map.setLayoutProperty(lyrId, "visibility", "visible");
  } else {
    map.addLayer({ id: lyrId, type: "fill", source: `choro-${poc}`,
      paint: { "fill-color": fill, "fill-opacity": 0.75, "fill-outline-color": "#0d1117" } });
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
  else sBtn.classList.add("hidden");

  const isCoral = e.peril === "dhw" || e.peril === "mhw";
  const howHtml = `<div class="section"><h3>How it works</h3><p class="how">${
    isCoral
      ? `<b>SST → DHW (the trigger) → tiered payout.</b> The trigger variable is Degree Heating Weeks (the
         SST-derived heat dose, NOAA alert-level basis), not raw temperature. Payout tier is set by the DHW
         peak; the reef-resilience coefficient shifts the thresholds.`
      : `<b>NDVI + rainfall → seasonal crop-stress index (the trigger) → payout.</b> A dry season pushes the
         standardized index below the trigger; how far below sets the payout.`
  }</p></div>`;

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
    <div class="section"><h3>Pipeline</h3>${pipelineFlow(e.peril)}</div>`;
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
      <p class="fine">Spatial basis risk = within-district heterogeneity of the index (mean std ${sp.mean_spatial_std != null ? sp.mean_spatial_std.toFixed(2) : "—"}, max ${sp.max_spatial_std != null ? sp.max_spatial_std.toFixed(2) : "—"} z).</p>
      <p class="fine"><b>Predictive backtest N/A</b> — no observed yield-loss series is wired for Bangladesh yet${pred.reason ? ` (${pred.reason})` : ""}. Provide a per-district-season observed series and the hit-rate / false-positive / outcome grid switches on.</p>
    </div>`;
  }
  const br = pred;
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
    grid += `<div class="yr ${cls}" title="${y}: ${p ? "paid" : "no payout"}, ${dg ? "bleaching observed" : "no event"}">${String(y).slice(2)}</div>`;
  }
  const pct = (x) => (x == null ? "—" : x <= 1 ? x.toFixed(2) : x.toFixed(2));
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
    <p class="fine">Caught every documented bleaching year (hit rate ${pct(br.hit_rate)}); one dry-fire; the
      basis gap (${pct(br.basis_risk_gap)}) is the payout-vs-severity mismatch an audit shrinks.</p>
    <p class="fine caveat">Caveat: metrics rest on 3 events / 16 yrs — perfect separation is achievable but overfits.
      DHW is an imperfect severity proxy (2016 = worst bleaching yet moderate DHW → underpays). Treat as
      directional, not calibrated.</p>
    ${lossCostHtml}</div>`;
}

// Pipeline flow doubles as the map-layer control: steps tagged `.map` with a data-stage
// (or data-role="score") are clickable and drive the map. Non-layer steps stay static.
function pipelineFlow(peril) {
  if (peril === "dhw" || peril === "mhw") return `<p class="flowtip">Click a step to show it on the map.</p><div class="flow">
    <div class="fstep in map" data-stage="raw_hazard">Sea-surface temp (NOAA CoralTemp 5km)</div>
    <div class="farrow">Degree Heating Weeks (rolling 12-week heat stress)</div>
    <div class="fstep map" data-stage="hazard_index">Weekly DHW accumulation</div>
    <div class="farrow">aggregate to reef sectors (≥20% area rule)</div>
    <div class="fstep map" data-role="score">Sector score + time series</div>
    <div class="farrow">calibrated thresholds (resilience-shifted)</div>
    <div class="fstep">Trigger → Payout → backtest</div>
  </div>`;
  return `<p class="flowtip">Click a step to show it on the map.</p><div class="flow">
    <div class="frow"><span class="fstep in map" data-stage="raw_hazard">Raw NDVI</span><span class="fstep in map" data-stage="raw_weather">Raw rainfall</span></div>
    <div class="farrow">smooth + standardize (z-score)</div>
    <div class="fstep map" data-stage="preprocessed">NDVI (smoothed)</div>
    <div class="farrow">dekadal cadence</div>
    <div class="frow"><span class="fstep map" data-stage="intraseason">Intra-season stress</span><span class="fstep map" data-stage="hazard_index">Seasonal crop-stress</span></div>
    <div class="farrow">aggregate to districts (≥20% area rule)</div>
    <div class="fstep map" data-role="score">District score + time series</div>
    <div class="farrow">calibrated thresholds</div>
    <div class="fstep">Trigger → Payout</div>
  </div>`;
}

/* ---- sources modal ------------------------------------------------------ */
function openSourcesModal(e, kase) {
  const src = (kase.sources || []).map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`).join(" · ");
  document.getElementById("modalBody").innerHTML = `
    <h3>${kase.title || e.display_name}</h3>
    <p class="msum">${kase.summary || ""}</p>
    ${src ? `<p class="msrc"><b>Sources</b><br>${src}</p>` : ""}`;
  document.getElementById("modal").classList.remove("hidden");
}
document.getElementById("modalClose").addEventListener("click", () => document.getElementById("modal").classList.add("hidden"));
document.getElementById("modal").addEventListener("click", (ev) => {
  if (ev.target.id === "modal") document.getElementById("modal").classList.add("hidden");
});

/* ---- controls: stage buttons (bottom-left), date/season + score (sidebar) */
async function wireControls(e) {
  const poc = e.poc_id;
  const avail = {}; // stage -> meta (only stages with frames on disk)
  for (const [stage] of frameStages(e.peril)) {
    const meta = await loadFrames(poc, stage);
    if (meta && meta.frames.length) avail[stage] = meta;
  }
  const choroMeta = await loadChoropleth(poc);

  const dateSel = document.getElementById("dateSelect");
  const seasonBtn = document.getElementById("seasonBtn");
  const scoreOn = document.getElementById("scoreOn");
  const scoreYear = document.getElementById("scoreYear");
  const scrubHint = document.getElementById("scrubHint");
  const scrubSec = document.getElementById("scrubSec");
  const scoreSec = document.getElementById("scoreSec");
  const steps = [...document.querySelectorAll("#detailBody .fstep.map")];

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
      setLegendRamp(choroMeta.ramp.map((r) => `<div class="ramp-row"><span class="sw" style="background:${r.color}"></span>${r.score}</div>`).join(""),
        (choroMeta.scale && choroMeta.scale.unit) || "1–10 score");
    }
    markSteps();
  };
  const showActiveFrame = () => { if (activeMeta() && !scoreOn.checked) showFrame(poc, activeMeta(), +dateSel.value || 0, e.peril); };
  const onScrub = () => { showActiveFrame(); repaintScore(); };

  function populateDates() {
    const m = activeMeta();
    if (!m) { scrubSec.classList.add("hidden"); return; }
    dateSel.innerHTML = m.frames.map((f, i) => `<option value="${i}">${f.date}</option>`).join("");
    const ys = [...new Set(m.frames.map((f) => f.date.slice(0, 4)))];
    scrubHint.textContent = `${m.frames.length} frames · ${ys.length === 1 ? ys[0] : ys[0] + "–" + ys[ys.length - 1]}`;
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
        const ct = Date.parse(cur); let best = Infinity;
        avail[stage].frames.forEach((f, i) => { const d = Math.abs(Date.parse(f.date) - ct); if (d < best) { best = d; idx = i; } });
      }
      dateSel.value = String(idx);
      onScrub();
    });
  });

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
      const marker = new maplibregl.Marker({ color: PERIL_COLOR[e.peril] || "#58a6ff" }).setLngLat(c).addTo(map);
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
