---
title: "Secondary perils are eating reinsurance — and parametric is winning the high-frequency layer."
description: "Insured nat-cat losses have crossed $100B for five straight years. The headline number is one story. The composition shift underneath — secondary perils now driving the volatility — is the more interesting one. Here is what that means for the next reinsurance cycle."
publishedDate: 2026-04-28
author: "Stéphane Karasiewicz"
tags: ["reinsurance", "climate risk", "parametric insurance", "secondary perils", "Swiss Re", "sigma", "cat models", "satellite data", "wildfire", "SCS", "flood"]
featured: false
readingTimeMinutes: 6
---

![Insured nat-cat losses: primary vs secondary perils](/images/blog/secondary-perils-are-eating-reinsurance-and-parametric-is-winning.png)

The Swiss Re sigma franchise has been telling the same story for several years, and the headline keeps overshadowing the part that matters.

Insured natural catastrophe losses have crossed **USD 100 billion for the fifth straight year**. That is the number that gets quoted. The more useful line, buried a few pages in, is the breakdown by peril. Severe convective storms, wildfires, and floods — the so-called secondary perils — now drive most of the year-on-year volatility. Hurricanes and earthquakes still produce the largest single-event losses, but they no longer set the cycle.

This shift has been visible in the data for at least a decade. What is new is that the market is starting to price for it.

## What "secondary" actually means and why it matters

The primary/secondary split is industry shorthand, not a scientific category. Primary perils are the ones cat models were originally built for: tropical cyclones, earthquakes, European windstorms. Secondary perils are everything else that still drives serious loss: severe convective storms (hail, tornadoes, derechos), wildfires, river and pluvial flood, and increasingly drought and heat-related losses.

The key technical difference is not severity. It is **modelability**. Primary perils have decades of well-instrumented loss history, physically motivated models, and stable return-period statistics. Secondary perils have shorter histories, weaker physical models, and return periods that may not be stationary at all under climate change.

For a reinsurer, that translates directly into capital implications:

- **Primary perils** can be priced with relatively well-understood model uncertainty. Capital is allocated against modeled VaR with reasonable confidence in the tail.
- **Secondary perils** carry model uncertainty that is itself uncertain. The 1-in-100 number from a vendor SCS model has a much wider confidence interval than the equivalent hurricane number, and that confidence interval is rarely reflected in the priced rate.

When secondary perils were a small fraction of total losses, this was tolerable. At current volumes — secondary perils contributing **more than half** of insured cat losses in most recent years — it is not.

## Why traditional cat models are not adapting fast enough

Vendor cat models are large, slow-moving products. A meaningful update to a hurricane model is a multi-year process involving model science, validation against historical events, and customer acceptance. That cadence is fine when the underlying physical regime is stable.

It is not fine for SCS, wildfire, or flood, where:

- The training period is short relative to the climate signal.
- The relevant atmospheric drivers (CAPE, vertical wind shear, fuel moisture, antecedent precipitation) are themselves shifting.
- Land-use change (urban expansion into the wildland-urban interface, increased impervious surfaces) compounds the climate signal in ways that historical loss data cannot directly capture.

The result is a structural lag between what the climate is doing and what the priced model thinks it is doing. That lag shows up as systematic underpricing of secondary peril exposure, which shows up as adverse loss experience, which shows up as the headline numbers everyone has been quoting since 2020.

## Why parametric is eating the high-frequency layer

Parametric covers — products that pay out based on a measured trigger rather than an assessed loss — have existed for decades. What changed in the last five years is the cost and granularity of the trigger data.

Three converging trends:

1. **High-resolution observational data is cheap.** ICEYE for SAR-based flood extent. Planet for daily optical. Earth Networks and Vaisala for lightning and SCS. ERA5 and equivalent reanalyses for wind, precipitation, and temperature at 0.25° hourly resolution.
2. **Compute and storage are cheap enough that running real-time trigger evaluation against streaming observation data is operationally trivial.** This was not true a decade ago.
3. **Cedents are willing to accept basis risk in exchange for speed and certainty.** The traditional indemnity claim cycle is slow and expensive. A parametric trigger that pays in days, with a small but bounded basis risk, is increasingly preferred for the high-frequency layer.

The combination is eating the part of the market that traditional cat models served worst: high-frequency, mid-severity secondary peril events where indemnity covers carry high LAE and modeled pricing has wide uncertainty bands. Parametric does not solve the modeling problem. It changes the question from "what will losses be" to "what will the trigger read" — and the trigger is observed, not modeled.

## What this means for the next cycle

The reinsurance pricing cycle has historically been driven by primary peril events: a major hurricane season, an earthquake, a windstorm sequence. Capital floods in or out, prices move, and the cycle resets.

The next cycle is going to look different. Capital allocation against secondary perils is structurally underprovisioned, and the loss experience that will eventually correct it is already showing up in the data. When the correction comes, it will not be triggered by a single named event. It will look more like a slow accumulation of bad SCS and wildfire seasons that finally crosses a board-level pain threshold.

For technical leaders in carriers and reinsurers, the practical implications:

- **Audit your secondary peril exposure with current observational data, not just modeled output.** If you have not cross-referenced your wildfire portfolio against satellite-derived burn scar data, you have an incomplete picture of your exposure history.
- **Treat parametric as a structural shift, not a niche product.** The economics of high-frequency cover are changing in ways that affect your indemnity book whether or not you write parametric directly.
- **Build observational data into your pricing stack.** The competitive edge in secondary peril underwriting over the next cycle will come from sensor data and computation, not from buying a better vendor model.

The next cycle will not be priced by historical loss tables. It will be priced by who has the best sensor data and the discipline to use it.

At Skaraz Data, we build the geospatial and climate data pipelines that connect observational data — satellite, reanalysis, ground sensor — to underwriting and reserving decisions. From SCS hail swath reconstruction to wildfire burn-scar overlays and flood footprint matching, we help insurers and reinsurers build the data foundation that the next cycle will be priced on. If your team is rethinking its secondary peril stack, let's talk.
