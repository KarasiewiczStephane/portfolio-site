// Build-time reader for the Constellation proofs of concept.
// Everything shown on the showcase pages comes from public/constellation/data,
// the same files the live map reads. Nothing here is typed in by hand except the
// editorial framing (slug, short title, which cell the chart follows and why).
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'public', 'constellation', 'data');

function readJson(poc: string, file: string): any {
    const f = path.join(DATA_DIR, poc, file);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : null;
}

/** Visible copy rules: no em-dashes, no retired offer names. Applied to case texts read from the data files. */
function clean(t: string, kind: 'title' | 'body' = 'body'): string {
    return t
        .replace(/ — ([^—]{1,80}?) — /g, ', $1, ')
        .replace(/ — /g, kind === 'title' ? ': ' : ', ')
        .replace(/—/g, ', ')
        .replace(/\ba Discovery audit\b/g, 'an audit')
        .replace(/\bDiscovery audit\b/g, 'audit');
}
const cleanSources = (xs: { label: string; url: string }[]) => xs.map(x => ({ ...x, label: clean(x.label, 'title') }));
const fr2 = (n: number) => String(n).replace('.', ',');

/** Inputs for the living mark (lib/livingMark.ts): one value per season, real data only. */
export interface Mark {
    values: number[];
    labels: string[];
    cell: number;
    threshold: number;
    title: string;
    titleFr: string;
    caption: string;
    captionFr: string;
}

/** Coral POCs: highest seasonal peak DHW over the reef sectors, per season (as in the brochure). */
export function coralMark(id: string, place: string, cell: number, from?: number, to?: number): Mark {
    const ts = readJson(id, 'district_timeseries.json');
    const thr = readJson(id, 'calibrated_thresholds.json');
    const years = new Map<number, number>();
    for (const d of Object.values<any>(ts.districts)) {
        for (const [y, sea] of Object.entries<any>(d.seasons)) {
            const yr = Number(y);
            years.set(yr, Math.max(years.get(yr) ?? -Infinity, sea.peak_dhw));
        }
    }
    let ys = [...years.keys()].sort((a, b) => a - b);
    if (from !== undefined) ys = ys.filter(y => y >= from);
    if (to !== undefined) ys = ys.filter(y => y <= to);
    ys = ys.slice(-12);
    const threshold = thr.ladder[0].threshold;
    const a = ys[0], b = ys[ys.length - 1];
    return {
        values: ys.map(y => years.get(y)!),
        labels: ys.map(String),
        cell, threshold,
        title: `${place}, peak heat stress per season, ${a} to ${b}`,
        titleFr: `${place}, stress thermique maximal par saison, ${a} à ${b}`,
        caption: `${place}, highest peak DHW of the reef sectors per season, ${a} to ${b}. One cell = ${cell} DHW (°C-weeks); the line is the ${threshold} DHW tier-1 trigger; amber cells reached it. NOAA Coral Reef Watch 5 km, backtest on public data.`,
        captionFr: `${place}, DHW maximal des secteurs du récif par saison, ${a} à ${b}. Une cellule = ${fr2(cell)} DHW (°C-semaines) ; la ligne est le seuil de ${fr2(threshold)} DHW ; les cellules ambre l'ont atteint. NOAA Coral Reef Watch 5 km, backtest sur données publiques.`,
    };
}

function readCsv(poc: string, file: string): Record<string, string>[] {
    const f = path.join(DATA_DIR, poc, file);
    if (!fs.existsSync(f)) return [];
    const [head, ...rows] = fs.readFileSync(f, 'utf-8').trim().split(/\r?\n/);
    const cols = head.split(',');
    return rows.map(r => { const v = r.split(','); return Object.fromEntries(cols.map((c, i) => [c, v[i]])); });
}

export interface Tier { threshold: number; payout: number; label?: string }

export interface Series {
    district: string;
    dates: string[];
    values: number[];
    direction: 'above' | 'below';
    unit: string;
    tiers: Tier[];
    /** Years (or event labels) the chosen cell paid, with the tier reached. */
    paid: { label: string; tier: number; date?: string }[];
    caption: string;
    /** Documented events (years) to mark as ink dots, from the backtest file. */
    events?: string[];
}

export interface Poc {
    id: string;
    slug: string;
    title: string;
    short: string;
    place: string;
    peril: string;
    perilLabel: string;
    source: string;
    period: string;
    caseTitle: string;
    summary: string;
    body: string[];
    caveats: string[];
    sources: { label: string; url: string }[];
    metrics: { label: string; value: string; note?: string }[];
    backtest: { status: 'scored' | 'not_scored'; text: string };
    series: Series;
    /** Living mark inputs, where the run has 3 or more comparable seasons on a higher-is-worse index. */
    mark?: Mark;
    /** Why there is no living mark, when there is none. */
    noMark?: string;
    /** The POC uses a rainfall index or CHIRPS: show the CHIRPS v2 to v3 transition note. */
    rainfall?: boolean;
}

const fmtEur = (n: number) =>
    n >= 1e6 ? `EUR ${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2).replace(/\.?0+$/, '')}M` : `EUR ${Math.round(n / 1000)}k`;

function seasonsPaid(seasons: Record<string, any>): { label: string; tier: number }[] {
    return Object.entries(seasons)
        .filter(([, s]) => (s.tier ?? 0) > 0 || (s.payout_fraction ?? 0) > 0)
        .map(([y, s]) => ({ label: y, tier: s.tier ?? 1 }));
}

function coral(id: string, slug: string, place: string, district: string, cell: number): Poc {
    const s = readJson(id, 'summary.json');
    const c = readJson(id, 'case.json');
    const ts = readJson(id, 'district_timeseries.json');
    const thr = readJson(id, 'calibrated_thresholds.json');
    const d = ts.districts[district];
    const p = s.basis_risk.prediction;
    const tiers: Tier[] = thr.ladder.map((t: any) => ({ threshold: t.threshold, payout: t.payout_pct }));
    return {
        id, slug, place,
        title: `${place} coral bleaching trigger`,
        short: place,
        peril: 'dhw',
        perilLabel: 'Marine heatwave · coral bleaching',
        source: 'NOAA Coral Reef Watch, 5 km Degree Heating Weeks',
        period: `${s.analysis_period[0]} to ${s.analysis_period[1]}, weekly`,
        caseTitle: clean(c.title, 'title'),
        summary: clean(c.summary),
        body: (c.body ?? []).map((x: string) => clean(x)),
        caveats: (c.caveats ?? []).map((x: string) => clean(x)),
        sources: cleanSources(c.sources ?? []),
        metrics: [
            { label: 'Hit rate', value: `${Math.round(p.hit_rate * 100)}%`, note: `documented bleaching years caught, ${p.n_years} seasons` },
            { label: 'False positives', value: `${Math.round(p.false_positive_rate * 100)}%`, note: 'paid in years without documented bleaching' },
            { label: 'Sectors triggered', value: String(s.n_sectors_triggered), note: `limit ${fmtEur(s.limit_eur)} per sector` },
            { label: 'Backtest payout', value: fmtEur(s.total_payout_eur), note: 'sum over all seasons and sectors' },
        ],
        backtest: {
            status: 'scored',
            text: `Paid in ${p.years_paid.join(', ')}. Documented bleaching in ${p.years_damaging.join(', ')}. Basis-risk gap ${p.basis_risk_gap}.`,
        },
        mark: coralMark(id, place, cell),
        series: {
            district,
            dates: d.dates,
            values: d.values,
            direction: ts.direction,
            unit: '°C-weeks',
            tiers,
            paid: seasonsPaid(d.seasons),
            events: (p.years_damaging ?? []).map(String),
            caption: `${district}, ${place}. Weekly Degree Heating Weeks, ${ts.span[0]} to ${ts.span[1]}. Ladder ${tiers.map(t => t.threshold).join(' / ')} °C-weeks pays ${tiers.map(t => t.payout + '%').join(' / ')}.`,
        },
    };
}

function wind(): Poc {
    const id = 'wind_nz_2023';
    const s = readJson(id, 'summary.json');
    const c = readJson(id, 'case.json');
    const ts = readJson(id, 'district_timeseries.json');
    const thr = readJson(id, 'calibrated_thresholds.json');
    const br = readJson(id, 'basis_risk.json');
    const hex = 'hex_017_018'; // the cell with the season's highest gust, tier 2
    const d = ts.districts[hex];
    const tiers: Tier[] = thr.ladder.map((t: any) => ({ threshold: t.threshold, payout: t.payout_pct }));
    return {
        id, slug: 'new-zealand-cyclone-wind', place: 'New Zealand',
        title: 'New Zealand cyclone wind trigger',
        short: 'NZ cyclone wind',
        peril: 'cyclone_wind',
        perilLabel: 'Tropical cyclone · wind',
        source: 'ERA5 reanalysis, 10 m wind gust',
        period: '2023 season (Hale, Gabrielle), hourly',
        caseTitle: clean(c.title, 'title'), summary: clean(c.summary), body: (c.body ?? []).map((x: string) => clean(x)), caveats: (c.caveats ?? []).map((x: string) => clean(x)), sources: cleanSources(c.sources ?? []),
        metrics: [
            { label: 'Cells triggered', value: `${s.n_hexes_triggered} / ${s.n_hexes}`, note: `${s.hex_cell_km} km hexagons over land` },
            { label: 'Season payout', value: fmtEur(s.total_payout_eur), note: `limit ${fmtEur(s.limit_eur)} per cell` },
            { label: 'Share of exposure paid', value: `${s.season_loss_cost_pct}%`, note: 'one season, not a premium' },
            { label: 'Model to station gap', value: `${br.hazard.mean_gap_kmh} km/h`, note: `mean over ${br.hazard.n_stations} stations, max ${br.hazard.max_gap_kmh}` },
        ],
        backtest: { status: 'not_scored', text: 'Not scored against losses: no per-cell New Zealand cyclone loss series exists, and none was invented.' },
        noMark: 'No living mark for this run: it covers one season (two storm windows), and the mark needs at least three comparable seasons.',
        series: {
            district: hex,
            dates: d.dates, values: d.values, direction: 'above', unit: 'km/h',
            tiers,
            paid: seasonsPaid(d.seasons),
            caption: `Cell ${hex}, the highest gust of the season (${Math.max(...d.values).toFixed(1)} km/h). Hourly ERA5 gust during the analysed events. Ladder 110 / 125 km/h pays 40 / 100%.`,
        },
    };
}

function flood(): Poc {
    const id = 'flood_auckland_2023';
    const s = readJson(id, 'summary.json');
    const c = readJson(id, 'case.json');
    const ts = readJson(id, 'district_timeseries.json');
    const hex = 'hex_015_010'; // full payout, ladder consistent with its own series
    const d = ts.districts[hex];
    // Ladder payouts as recorded in payouts.csv (tier 1/2/3 -> 20/50/100%).
    const pays = [20, 50, 100];
    const tiers: Tier[] = d.thresholds.map((t: number, i: number) => ({ threshold: t, payout: pays[i], label: `1-in-${s.return_years[i]}` }));
    // Thresholds are in anomaly units: 72 h rain minus the cell's own normal.
    const anomaly = d.values.map((v: number, i: number) => Math.round((v - d.normal[i]) * 10) / 10);
    // Living mark: this cell's yearly peak of the same anomaly index, 2012 to 2022 from the
    // backtest file, then the January 2023 event from the run itself.
    const yearly = readCsv(id, 'backtest_years.csv')
        .filter(r => r.polygon === hex)
        .map(r => ({ y: Number(r.year), v: Number(r.peak) }))
        .sort((a, b) => a.y - b.y)
        .slice(-11);
    const ev = d.seasons['2023'];
    const markYears = [...yearly, { y: 2023, v: ev.peak_mm }];
    const t1 = d.thresholds[0];
    const fmt1 = (n: number) => n.toFixed(1);
    const floodMark: Mark = {
        values: markYears.map(p => Math.round(p.v * 10) / 10),
        labels: markYears.map(p => String(p.y)),
        cell: 25, threshold: t1,
        title: `Auckland cell ${hex}, yearly peak rainfall above normal, ${markYears[0].y} to 2023`,
        titleFr: `Auckland, cellule ${hex}, pic annuel de pluie au-dessus de la normale, ${markYears[0].y} à 2023`,
        caption: `Auckland, cell ${hex}: highest 72-hour IMERG rainfall above the cell's own normal per year, ${markYears[0].y} to ${markYears[markYears.length - 2].y} (backtest years) and the January 2023 event. One cell = 25 mm; the line is the cell's 1-in-10 tier at ${fmt1(t1)} mm; amber cells reached it. Backtest on public data.`,
        captionFr: `Auckland, cellule ${hex} : pluie IMERG maximale sur 72 h au-dessus de la normale de la cellule, par an, ${markYears[0].y} à ${markYears[markYears.length - 2].y} (années de backtest) puis l'événement de janvier 2023. Une cellule = 25 mm ; la ligne est le palier 1 sur 10 ans, à ${fmt1(t1).replace('.', ',')} mm ; les cellules ambre l'ont atteint. Backtest sur données publiques.`,
    };
    return {
        id, slug: 'auckland-pluvial-flood', place: 'Auckland',
        title: 'Auckland pluvial flood trigger',
        short: 'Auckland flood',
        peril: 'pluvial_flood',
        perilLabel: 'Extreme rainfall · pluvial flood',
        source: 'NASA IMERG satellite rainfall',
        period: `Event of 26 to 28 Jan 2023, normals from ${s.climatology_period[0]} to ${s.climatology_period[1]}`,
        caseTitle: clean(c.title, 'title'), summary: clean(c.summary), body: (c.body ?? []).map((x: string) => clean(x)), caveats: (c.caveats ?? []).map((x: string) => clean(x)), sources: cleanSources(c.sources ?? []),
        metrics: [
            { label: 'Cells triggered', value: `${s.n_hexes_triggered} / ${s.n_hexes}`, note: `${s.hex_cell_km} km hexagons` },
            { label: 'Event payout', value: fmtEur(s.total_payout_eur), note: `limit ${fmtEur(s.limit_eur)} per cell` },
            { label: 'Share of exposure paid', value: `${s.season_loss_cost_pct}%`, note: 'one event, not a rate on line' },
            { label: 'Trigger window', value: `${s.trigger_window_hours} h`, note: 'rain above the cell’s own normal' },
        ],
        backtest: { status: 'not_scored', text: 'Not scored per location: insured losses are published for the event as a whole, and no per-location loss series is wired. Nothing was estimated in its place.' },
        mark: floodMark,
        rainfall: true,
        series: {
            district: hex,
            dates: d.dates, values: anomaly, direction: 'above', unit: 'mm above normal',
            tiers,
            paid: [{ label: 'Jan 2023 event', tier: d.tier }],
            caption: `Cell ${hex}, one of the cells paying in full. 72-hour IMERG rainfall above this cell’s own normal, January 2023, against its 1-in-10 / 25 / 50 ladder (paying 20 / 50 / 100%).`,
        },
    };
}

function crop(): Poc {
    const id = 'crop_bangladesh_full';
    const s = readJson(id, 'summary.json');
    const c = readJson(id, 'case.json');
    const ts = readJson(id, 'district_timeseries.json');
    const district = 'Netrakona'; // largest payout of the run
    const d = ts.districts[district];
    return {
        id, slug: 'bangladesh-crop-drought', place: 'Bangladesh',
        title: 'Bangladesh rainfed rice drought trigger',
        short: 'Bangladesh crop',
        peril: 'crop_hybrid',
        perilLabel: 'Agricultural drought · rainfed rice',
        source: 'CHIRPS rainfall and MODIS NDVI, blended 50 / 50',
        period: '2019 to 2021, ten-day steps',
        caseTitle: clean(c.title, 'title'), summary: clean(c.summary), body: (c.body ?? []).map((x: string) => clean(x)), caveats: (c.caveats ?? []).map((x: string) => clean(x)), sources: cleanSources(c.sources ?? []),
        metrics: [
            { label: 'Districts', value: String(Object.keys(ts.districts).length), note: 'admin level 2, nationwide' },
            { label: 'Trigger events', value: String(s.n_events), note: 'district seasons below the trigger' },
            { label: 'Expected payout', value: `${(s.expected_payout_fraction * 100).toFixed(1)}%`, note: 'of limit, per triggered event' },
            { label: 'Trigger', value: '−1.0 z', note: 'blended index, Aug to Oct' },
        ],
        backtest: { status: 'not_scored', text: 'Not scored against yields: no observed yield-loss series is available, so payout against loss is reported as not applicable.' },
        noMark: 'No living mark for this run: the index pays below its trigger, and the mark is drawn for indices where higher means worse.',
        rainfall: true,
        series: {
            district,
            dates: d.dates, values: d.values, direction: 'below', unit: 'z',
            tiers: [{ threshold: ts.trigger_index, payout: 0, label: 'trigger' }],
            paid: seasonsPaid(d.seasons),
            caption: `${district} district, the largest payout of the run (2021). Ten-day blended rain and vegetation index. Pays when the season falls below −1.0.`,
        },
    };
}

let cache: Poc[] | null = null;
export function getPocs(): Poc[] {
    if (!cache) {
        cache = [
            coral('coral_reunion', 'la-reunion-coral-bleaching', 'La Réunion', 'Saint-Leu', 2.5),
            coral('coral_mayotte', 'mayotte-coral-bleaching', 'Mayotte', 'Eastern barrier', 1.5),
            flood(),
            wind(),
            crop(),
        ];
    }
    return cache;
}

export function getPoc(slug: string): Poc | undefined {
    return getPocs().find(p => p.slug === slug);
}
