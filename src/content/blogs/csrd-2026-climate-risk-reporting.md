---
title: "CSRD 2026: 5,000 EU Companies Must Report Climate Risk. Most Don't Have the Data."
description: "The Omnibus I Directive removed 90% of companies from CSRD scope — but the remaining 5,000 face harder climate reporting requirements. Here's what changed and what data infrastructure is needed."
publishedDate: 2026-03-25
author: "Stéphane Karasiewicz"
tags: ["CSRD", "Climate Risk", "ESG", "ERA5-Land", "Data Pipeline"]
featured: true
readingTimeMinutes: 8
---

On March 19, 2026, the European Commission advanced the **Omnibus I simplification package** — a sweeping proposal to reduce the scope of the Corporate Sustainability Reporting Directive (CSRD). The headline: roughly **90% of previously in-scope companies would be exempt**. Markets cheered. Compliance teams exhaled.

But here's what most coverage missed: for the **~5,000 large companies that remain in scope**, the requirements didn't get easier. They got harder. Specifically, **[ESRS E1 (Climate Change)](https://www.efrag.org/en/sustainability-reporting/esrs-workstreams/sector-agnostic-standards-set-1-esrs)** now demands granular, site-level climate risk data that most firms simply don't have.

## What the Omnibus I Proposal Actually Changed

The original CSRD would have required ~50,000 EU companies to report under the European Sustainability Reporting Standards (ESRS). The Omnibus I proposal slashes that number by raising thresholds and exempting most SMEs and mid-caps:

- **Revenue threshold** proposed to rise from EUR 40M to EUR 150M
- **Employee threshold** proposed to rise from 250 to 1,000
- **SMEs** can opt for a simplified voluntary standard
- **Non-EU subsidiaries** are largely exempt if the parent reports

The remaining ~5,000 companies are large enterprises — the ones with the resources to do this properly, and the ones investors and regulators care about most.

## The Data Infrastructure Gap

Here's the problem. ESRS E1 requires companies to report on:

- **Physical climate risks** at the asset/site level (floods, heatwaves, droughts, storms)
- **Transition risks** tied to policy, technology, and market shifts
- **Scope 1, 2, and 3 greenhouse gas emissions** with methodological transparency
- **Climate scenario analysis** aligned with IPCC pathways (1.5C and 2C+)

This isn't a checkbox exercise. It requires actual climate data — historical baselines, forward-looking projections, and site-level granularity. Most companies have none of this infrastructure in place.

![CSRD 2026 Reporting Readiness: percentage of in-scope firms with climate data infrastructure, by sector and country](/screenshots/csrd-2026-climate-risk-reporting-viz.png)

The estimates above — my synthesis based on [EFRAG's 2024 implementation study](https://www.efrag.org/en/news-and-calendar/news/efrag-releases-study-on-early-implementation-of-esrs-insights-from-selected-eu-companies-for-q2), the [EC readiness tracker Q4 2025](https://ec.europa.eu/info/law/better-regulation/), and the [ECB climate stress test 2022](https://www.ecb.europa.eu/press/pr/date/2022/html/ecb.pr220708~2e1eee1a2a.en.html) — paint a clear picture:

- **Agrifood** (15%) and **Textiles** (18%) are almost entirely unprepared
- Even **Energy & Utilities**, the most advanced sector, sits at just 48%
- **Poland & CEE** (18%) and **Italy & Spain** (27%) lag significantly behind France and the Nordics
- Only **France** crosses the 50% threshold — and barely

The dashed line at 50% isn't a regulatory requirement. It's just a reality check: **most in-scope firms don't have the data pipelines to comply**.

## What ESRS E1 Actually Requires (Technically)

Let's get specific about what "climate data infrastructure" means in practice:

### Physical Risk Assessment

For each material site or asset, companies need:

- **Historical climate baselines** (temperature extremes, precipitation anomalies, drought indices) covering at least 30 years
- **Forward-looking projections** under multiple IPCC scenarios (SSP2-4.5, SSP5-8.5)
- **Hazard exposure scores** mapping each site to specific physical risks
- **Financial impact estimates** connecting physical hazards to business disruption, asset impairment, and insurance costs

### The Data Sources That Make This Possible

The good news: the raw climate data is free and publicly available. The bad news: it requires serious engineering to make it usable.

**[ERA5-Land](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land)** (Copernicus/ECMWF) provides:
- Hourly climate reanalysis at ~9km resolution, from 1950 to present
- Temperature, precipitation, soil moisture, snow cover, wind speed, and more
- The gold standard for site-level historical climate baselines

**[CHIRPS](https://www.chc.ucsb.edu/data/chirps)** (Climate Hazards Group) provides:
- Daily precipitation estimates at ~5km resolution, from 1981 to present
- Optimized for drought and flood analysis in tropical/subtropical regions
- Critical for supply chain risk assessment in emerging markets

**[CMIP6](https://pcmdi.llnl.gov/CMIP6/)** (Coupled Model Intercomparison Project) provides:
- Climate model projections under shared socioeconomic pathways (SSPs)
- Required for forward-looking scenario analysis
- Multiple models and ensembles for uncertainty quantification

## Building a Climate Risk Data Pipeline

Turning these raw datasets into ESRS-compliant reporting requires a multi-stage pipeline:

### 1. Ingestion & Storage

ERA5-Land alone is approximately 80TB of NetCDF data (all variables and time steps). You don't download it all — you build an extraction layer that queries the [Copernicus Climate Data Store (CDS) API](https://cds.climate.copernicus.eu/) for specific variables, regions, and time ranges based on your site portfolio.

```python
# Simplified pseudo-code — actual CDS API interface differs
variables = ["2m_temperature", "total_precipitation"]
sites = load_site_coordinates("portfolio.csv")

for site in sites:
    data = cds_api.retrieve(
        dataset="reanalysis-era5-land",
        variables=variables,
        area=site.bounding_box(buffer_km=25),
        date_range="1991/2025",
    )
    store_to_parquet(data, partition_by=["site_id", "year"])
```

### 2. Hazard Computation

Raw climate variables become risk indicators through statistical transformation:

- **Heatwave index**: consecutive days above the site's 95th percentile temperature
- **Drought index** (SPI/SPEI): standardized precipitation anomalies over 3, 6, 12-month windows
- **Flood proxy**: daily precipitation exceeding the 99th percentile baseline
- **Compound events**: simultaneous heat + drought or precipitation + wind extremes

### 3. Scenario Projection

[CMIP6](https://pcmdi.llnl.gov/CMIP6/) model outputs are bias-corrected against ERA5-Land baselines (using quantile mapping or delta methods — methodology choice matters), then projected forward under SSP2-4.5 (moderate) and SSP5-8.5 (high-emission) pathways. This gives you the 2030, 2040, and 2050 risk horizons that ESRS E1 requires.

### 4. Risk Scoring & Reporting

Each site gets a composite risk score aggregating:

- Hazard exposure (physical risk probability)
- Vulnerability (asset type, sector sensitivity)
- Financial materiality (revenue exposure, replacement cost)

The output feeds directly into ESRS E1 disclosure templates with full methodological traceability.

## The Market Opportunity

Here's why this matters beyond compliance. The ~5,000 in-scope companies collectively manage **hundreds of thousands of physical sites** across Europe and their global supply chains. Each site needs climate risk assessment. Most companies will outsource this because:

1. **Climate data engineering is specialized** — it's not a standard BI/analytics capability
2. **The regulatory clock is ticking** — first reports are due for FY2025 (large companies) and FY2026 (the newly scoped cohort)
3. **Investors are watching** — the EU Taxonomy and SFDR create downstream demand for this data from asset managers

Companies that build this infrastructure now gain a durable advantage: the data compounds over time, making each subsequent reporting cycle cheaper and more valuable.

## What I'm Building

I'm developing an open-source climate risk data pipeline that connects ERA5-Land, CHIRPS, and CMIP6 to produce ESRS E1-ready risk assessments. The stack:

- **Data ingestion**: Python + CDS API + async processing
- **Storage**: Parquet on object storage, partitioned by site and time
- **Computation**: Pandas/Polars for hazard indices, xarray for gridded climate data
- **API**: FastAPI serving risk scores per site with full methodology metadata
- **Dashboard**: Interactive risk visualization per site, sector, and scenario

The goal: make CSRD-grade climate risk assessment accessible to any company that needs it, without requiring a team of climate scientists. You can see some of this work in action in my [satellite analysis project](/projects/satellite-analysis).

---

*If you're working on CSRD compliance and need climate data infrastructure, [let's talk](https://calendly.com/skaraz_data/15-minute-meeting). I also write about climate data engineering on [LinkedIn](https://www.linkedin.com/in/st%C3%A9phane-karasiewicz-349330112).*
