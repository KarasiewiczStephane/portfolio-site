/* Constellation dashboard — reads data/catalog.json (written by finalize_poc) and
   renders each POC: a georeferenced hazard_index raster overlay (gridded perils),
   trigger-event points, and a detail panel with the basis-risk / thresholds stages.
   Pure MapLibre GL + fetch; no build step. Served statically (see build.py). */

const DATA = "./data";
const PERIL_COLOR = { drought: "#f0883e", dhw: "#f778ba", mhw: "#a371f7" };

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: [30, 5],
  zoom: 1.6,
  hash: true, // #zoom/lat/lon shareable permalink
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

const rasterLayers = []; // ids, for the opacity slider
const legendEl = document.getElementById("legend");
const legendRamp = document.getElementById("legendRamp");

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

function addRaster(e) {
  const r = e.raster && e.raster.hazard_index;
  if (!r) return null;
  const srcId = `raster-${e.poc_id}`;
  const lyrId = `${srcId}-lyr`;
  map.addSource(srcId, { type: "image", url: `${DATA}/${e.poc_id}/${r.file}`, coordinates: r.bounds });
  map.addLayer({ id: lyrId, type: "raster", source: srcId,
    paint: { "raster-opacity": currentOpacity(), "raster-resampling": "nearest" } }); // crisp grid cells
  rasterLayers.push(lyrId);
  return lyrId;
}

// Only a faint division (admin_1) outline for geographic context. District detail comes
// from the choropleth fill, so the old 0/1/2 toggle was redundant and is gone.
function addAdmin(e) {
  if (!e.admin) return;
  const file = e.admin["1"] || e.admin["0"];
  if (!file) return;
  const srcId = `admin1-${e.poc_id}`;
  const lyrId = `${srcId}-lyr`;
  if (map.getSource(srcId)) return;
  map.addSource(srcId, { type: "geojson", data: `${DATA}/${e.poc_id}/${file}` });
  map.addLayer({ id: lyrId, type: "line", source: srcId,
    paint: { "line-color": "#8b98a8", "line-width": 0.7, "line-opacity": 0.45 } });
}

function currentOpacity() {
  return document.getElementById("opacity").value / 100;
}
document.getElementById("opacity").addEventListener("input", (ev) => {
  document.getElementById("opacityVal").textContent = ev.target.value + "%";
  const o = ev.target.value / 100;
  rasterLayers.forEach((id) => map.getLayer(id) && map.setPaintProperty(id, "raster-opacity", o));
});

function toggleLayers(e, on) {
  [`raster-${e.poc_id}-lyr`, `evt-${e.poc_id}-lyr`].forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  });
}

function showLegend(e) {
  const r = e.raster && e.raster.hazard_index;
  if (!r || !r.classes) { legendEl.classList.add("hidden"); return; }
  legendRamp.innerHTML = r.classes
    .map((c) => `<div class="ramp-row"><span class="sw" style="background:${c.color}"></span>${c.level}</div>`)
    .join("");
  legendEl.classList.remove("hidden");
}

/* ---- per-stage / per-date frame drill-down ------------------------------ */
const FRAME_STAGES = [
  ["intraseason", "Intra-season stress"], ["raw_weather", "Rainfall (raw)"], ["raw_hazard", "NDVI (raw)"],
  ["preprocessed", "NDVI (smoothed)"], ["hazard_index", "Crop-stress (seasonal)"],
];
const _frameCache = {}; // `${poc}/${stage}` -> meta|null

async function loadFrames(poc, stage) {
  const key = `${poc}/${stage}`;
  if (key in _frameCache) return _frameCache[key];
  const meta = await fetch(`${DATA}/${poc}/_frames_${stage}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  _frameCache[key] = meta;
  return meta;
}
function showFrame(poc, meta, i) {
  const f = meta.frames[i];
  const url = `${DATA}/${poc}/${f.file}`;
  const srcId = `frame-${poc}`;
  if (map.getSource(srcId)) {
    map.getSource(srcId).updateImage({ url, coordinates: meta.bounds });
  } else {
    map.addSource(srcId, { type: "image", url, coordinates: meta.bounds });
    map.addLayer({ id: `${srcId}-lyr`, type: "raster", source: srcId,
      paint: { "raster-opacity": currentOpacity(), "raster-resampling": "nearest" } });
    rasterLayers.push(`${srcId}-lyr`);
  }
  // The per-stage frame is the pixel view now; hide the static seasonal hazard_index raster
  // so it stops bleeding through and so the selected stage/date is the only thing on the map.
  const staticId = `raster-${poc}-lyr`;
  if (map.getLayer(staticId)) map.setLayoutProperty(staticId, "visibility", "none");
  if (meta.classes) {
    legendRamp.innerHTML = meta.classes
      .map((c) => `<div class="ramp-row"><span class="sw" style="background:${c.color}"></span>${c.level}</div>`).join("");
    legendEl.classList.remove("hidden");
  }
}

/* ---- district-score choropleth + click-for-time-series ------------------ */
const _dts = {}; // poc -> district_timeseries.json
async function loadChoropleth(poc) {
  const key = `choro/${poc}`;
  if (key in _frameCache) return _frameCache[key];
  const meta = await fetch(`${DATA}/${poc}/_choropleth.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (meta && !map.getSource(`choro-${poc}`)) {
    map.addSource(`choro-${poc}`, { type: "geojson", data: `${DATA}/${poc}/choropleth.geojson` });
    // always-on faint district outline + a transparent click target (works whether or not
    // the score fill is shown); the score fill layer is added on top by paintChoropleth
    map.addLayer({ id: `choro-${poc}-line`, type: "line", source: `choro-${poc}`,
      paint: { "line-color": "#8b98a8", "line-width": 0.6, "line-opacity": 0.55 } });
    map.addLayer({ id: `choro-${poc}-hit`, type: "fill", source: `choro-${poc}`,
      paint: { "fill-color": "#000000", "fill-opacity": 0.01 } });
    _dts[poc] = await fetch(`${DATA}/${poc}/district_timeseries.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    map.on("click", `choro-${poc}-hit`, (ev) => openDistrictPopup(poc, ev.features[0].properties.name, ev.lngLat));
    map.on("mouseenter", `choro-${poc}-hit`, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", `choro-${poc}-hit`, () => (map.getCanvas().style.cursor = ""));
  }
  _frameCache[key] = meta;
  return meta;
}

function buildChart(d, trigger) {
  const vals = d.values, n = vals.length;
  if (!n) return "";
  const W = 440, H = 210, padL = 34, padR = 14, padT = 12, padB = 26;
  const lo = Math.min(trigger, ...vals) - 0.5, hi = Math.max(0.5, ...vals) + 0.5;
  const X = (i) => padL + ((W - padL - padR) * i) / Math.max(n - 1, 1);
  const Y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const line = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const yT = +Y(trigger).toFixed(1), y0 = +Y(0).toFixed(1);
  // year gridlines + labels
  let ticks = "";
  d.dates.forEach((dt, i) => {
    if (dt.slice(5) === "01-01") {
      const x = X(i).toFixed(1);
      ticks += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="#30363d" stroke-width="0.5"/>
        <text x="${x}" y="${H - 8}" fill="#8b949e" font-size="10" text-anchor="middle">${dt.slice(0, 4)}</text>`;
    }
  });
  return `<svg width="${W}" height="${H}" class="chart" viewBox="0 0 ${W} ${H}">
    ${ticks}
    <line x1="${padL}" y1="${y0}" x2="${W - padR}" y2="${y0}" stroke="#484f58" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${y0 + 3}" fill="#8b949e" font-size="9" text-anchor="end">0</text>
    <rect x="${padL}" y="${yT}" width="${W - padL - padR}" height="${(H - padB - yT).toFixed(1)}" fill="#f8514918"/>
    <line x1="${padL}" y1="${yT}" x2="${W - padR}" y2="${yT}" stroke="#f85149" stroke-dasharray="4 3"/>
    <text x="${padL - 4}" y="${yT + 3}" fill="#f85149" font-size="9" text-anchor="end">${trigger}</text>
    <text x="${W - padR}" y="${yT - 4}" fill="#f85149" font-size="10" text-anchor="end">trigger (payout starts)</text>
    <polyline points="${line}" fill="none" stroke="#58a6ff" stroke-width="1.6"/>
  </svg>`;
}

function openDistrictPopup(poc, name, lngLat) {
  const dts = _dts[poc];
  const d = dts && dts.districts[name];
  if (!d) return;
  const trig = dts.trigger_index;
  const seasons = d.seasons || {};
  const rows = Object.keys(seasons).sort().map((y) => {
    const s = seasons[y];
    return `<div class="srow"><span>${y} season</span>
      <span>index <b>${s.season_index}</b> ≤ ${trig} → payout <b>${Math.round(s.payout_fraction * 100)}%</b></span></div>`;
  }).join("");
  const summary = rows || `<div class="peril">no trigger in the analysis years</div>`;
  const html = `<div class="dpopup"><strong>${name}</strong>
    <div class="peril">Intra-season crop-stress (z-score, lower = worse)</div>
    ${buildChart(d, trig)}
    <div class="pseasons">${summary}</div>
    <div class="pexplain"><b>Trigger</b>: season index ≤ ${trig} z (≈ a 1-in-6 dry season).
      <b>Payout</b> = clip((${trig} − index) / 1.5, 0, 1) — 0% at the trigger, 100% once the index is
      1.5 z below it. The line is the 10-day stress building toward that seasonal verdict.</div>
  </div>`;
  new maplibregl.Popup({ maxWidth: "480px", closeButton: true }).setLngLat(lngLat).setHTML(html).addTo(map);
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
// One layer at a time: showing the district score hides the pixel raster (and its legend).
// Once frames exist, the frame is the pixel view and the static seasonal raster stays hidden;
// only fall back to toggling the static raster for POCs that have no drill-down frames.
function setPixelVisible(poc, on) {
  const frameId = `frame-${poc}-lyr`, staticId = `raster-${poc}-lyr`;
  if (map.getLayer(frameId)) {
    map.setLayoutProperty(frameId, "visibility", on ? "visible" : "none");
    if (map.getLayer(staticId)) map.setLayoutProperty(staticId, "visibility", "none");
  } else if (map.getLayer(staticId)) {
    map.setLayoutProperty(staticId, "visibility", on ? "visible" : "none");
  }
}

async function openDetail(e) {
  const base = `${DATA}/${e.poc_id}`;
  const [summary, thresh, kase] = await Promise.all([
    fetch(`${base}/summary.json`).then((r) => r.json()).catch(() => ({})),
    fetch(`${base}/calibrated_thresholds.json`).then((r) => r.json()).catch(() => null),
    fetch(`${base}/case.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  let caseHtml = "";
  if (kase) {
    const src = (kase.sources || []).map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`).join(" · ");
    caseHtml = `<div class="section case"><h3>Case study</h3><strong>${kase.title}</strong>
      <p class="peril">${kase.summary}</p>${src ? `<p class="src">${src}</p>` : ""}</div>`;
  }
  let ladderHtml = "";
  const ladder = Array.isArray(thresh) ? thresh : thresh && thresh.ladder;
  if (Array.isArray(ladder)) {
    ladderHtml = `<div class="section"><h3>Calibrated ladder</h3><table class="ladder">
      <tr><th>Tier</th><th>Threshold</th><th>Payout</th></tr>
      ${ladder.map((t) => `<tr><td>${t.tier}</td><td>${t.threshold}</td><td>${t.payout_pct ?? Math.round((t.payout_fraction||0)*100)}%</td></tr>`).join("")}
    </table></div>`;
  }
  document.getElementById("detailBody").innerHTML = `
    <h2>${e.display_name || e.poc_id}</h2>
    <div class="peril">${e.peril} · ${e.schema || "generic"}</div>
    ${caseHtml}
    ${ladderHtml}
    <div class="section" id="drillSec" hidden><h3>Pipeline drill-down</h3>
      <div class="drill"><label>Stage</label><select id="drillStage"></select></div>
      <div class="drill"><label>Date</label><select id="drillDate"></select>
        <span id="drillLabel" class="peril"></span></div>
      <p class="peril tip">Tip: turn on the district score, then click a district for its stress time series.</p></div>
    <div class="section" id="scoreSec" hidden><h3>District stress score (1-10)</h3>
      <label class="toggle"><input id="scoreOn" type="checkbox" /> show on map · <span id="scoreYear" class="peril"></span></label>
      <p class="peril" id="scoreHow"></p></div>
    <div class="section"><h3>Pipeline</h3>${PIPELINE_FLOW}</div>`;
  document.getElementById("detail").classList.remove("hidden");
  showLegend(e);
  wireControls(e);
}

// Human-readable pipeline flow (replaces the raw artifact-name dump).
const PIPELINE_FLOW = `<div class="flow">
  <div class="frow"><span class="fstep in">Raw NDVI</span><span class="fstep in">Raw rainfall</span></div>
  <div class="farrow">smooth + standardize (z-score)</div>
  <div class="frow"><span class="fstep">Intra-season stress (dekadal)</span><span class="fstep">Seasonal crop-stress</span></div>
  <div class="farrow">aggregate to districts (≥20% area rule)</div>
  <div class="fstep">District score + time series</div>
  <div class="farrow">calibrated thresholds</div>
  <div class="fstep">Trigger → Payout</div>
</div>`;

// One controller: the drill-down date drives BOTH the frame overlay and the district-score
// year (they can never disagree), and the score toggle swaps between the pixel frame and the
// district choropleth so only one colour scheme is ever on the map.
async function wireControls(e) {
  const avail = [];
  for (const [stage, label] of FRAME_STAGES) {
    const meta = await loadFrames(e.poc_id, stage);
    if (meta && meta.frames.length) avail.push([stage, label, meta]);
  }
  const choroMeta = await loadChoropleth(e.poc_id);

  const stageSel = document.getElementById("drillStage");
  const dateSel = document.getElementById("drillDate");
  const dLabel = document.getElementById("drillLabel");
  const scoreOn = document.getElementById("scoreOn");
  const yearLabel = document.getElementById("scoreYear");

  const activeYear = () => {
    if (avail.length) return avail[+stageSel.value][2].frames[+dateSel.value || 0].date.slice(0, 4);
    return choroMeta ? String(choroMeta.years[choroMeta.years.length - 1]) : "";
  };
  const repaintScore = () => {
    if (!choroMeta) return;
    const yr = activeYear();
    yearLabel.textContent = choroMeta.years.includes(+yr) ? `${yr} season` : `${yr} (no score)`;
    paintChoropleth(e.poc_id, choroMeta, yr, scoreOn.checked);
    setPixelVisible(e.poc_id, !scoreOn.checked);   // exclusivity: score on -> hide pixel frame
    if (scoreOn.checked) {                          // one legend: reflect the score layer
      legendRamp.innerHTML = choroMeta.ramp
        .map((r) => `<div class="ramp-row"><span class="sw" style="background:${r.color}"></span>${r.score}</div>`).join("");
      legendEl.classList.remove("hidden");
    }
  };
  const showActiveFrame = () => {
    if (avail.length && !scoreOn.checked) {
      const [, , meta] = avail[+stageSel.value];
      showFrame(e.poc_id, meta, +dateSel.value || 0);
    }
  };

  if (avail.length) {
    document.getElementById("drillSec").hidden = false;
    stageSel.innerHTML = avail.map(([s, l], i) => `<option value="${i}">${l}</option>`).join("");
    const populateDates = () => {
      const [, , meta] = avail[+stageSel.value];
      dateSel.innerHTML = meta.frames.map((f, i) => `<option value="${i}">${f.date}</option>`).join("");
      dLabel.textContent = `${meta.frames.length} dates`;
    };
    const onDrill = () => { showActiveFrame(); repaintScore(); };
    stageSel.onchange = () => { populateDates(); dateSel.value = "0"; onDrill(); };
    dateSel.onchange = onDrill;
    populateDates();
    onDrill();
  }

  if (choroMeta) {
    document.getElementById("scoreSec").hidden = false;
    document.getElementById("scoreHow").textContent = choroMeta.scale.how_it_works;
    scoreOn.onchange = () => { repaintScore(); showActiveFrame(); };
    repaintScore();
  }
}
document.getElementById("closeDetail").addEventListener("click", () =>
  document.getElementById("detail").classList.add("hidden"));

let _populated = false;
async function populate() {
  if (_populated) return;
  _populated = true;
  let catalog;
  try {
    catalog = await fetch(`${DATA}/catalog.json`).then((r) => r.json());
  } catch (err) {
    document.getElementById("layerList").innerHTML = `<p style="color:#f85149">catalog.json not found — run <code>python dashboard/build.py</code></p>`;
    return;
  }
  const list = document.getElementById("layerList");
  catalog.forEach((e) => {
    addRaster(e);
    addAdmin(e);
    const c = entryCenter(e);
    if (c) {
      const marker = new maplibregl.Marker({ color: PERIL_COLOR[e.peril] || "#58a6ff" }).setLngLat(c).addTo(map);
      marker.getElement().style.cursor = "pointer";
      marker.getElement().addEventListener("click", () => { map.flyTo({ center: c, zoom: Math.max(map.getZoom(), 5) }); openDetail(e); });
    }
    const row = document.createElement("div");
    row.className = "layer-row";
    row.innerHTML = `<span class="dot" style="background:${PERIL_COLOR[e.peril] || "#58a6ff"}"></span>
      <span>${e.display_name || e.poc_id}</span>
      <input type="checkbox" checked title="toggle" />
      <button type="button">Focus</button>`;
    row.querySelector("input").addEventListener("change", (ev) => toggleLayers(e, ev.target.checked));
    row.querySelector("button").addEventListener("click", () => { if (c) map.flyTo({ center: c, zoom: 6 }); openDetail(e); });
    list.appendChild(row);
  });
}

// Gate on style.load (fires on style parse — reliable even when the tab is
// render-throttled), with a fallback if the style is already parsed.
map.on("style.load", populate);
map.on("load", populate);
if (map.isStyleLoaded()) populate();
