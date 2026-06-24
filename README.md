# skarazdata.com — Astro site

Live at [skarazdata.com](https://skarazdata.com). Climate Pipeline Partner funnel
for Skaraz Data (Stéphane Karasiewicz · Senior Data Engineer for Parametric Insurance).

## Stack

- **Framework:** Astro 5 (static site generation)
- **Hosting:** GitHub Pages, custom domain via `CNAME`
- **CI:** `.github/workflows/deploy.yml`
- **Styling:** plain CSS in `src/styles/global.css` — no Tailwind, no MDX, no UI framework
- **SEO:** sitemap, robots.txt, canonical URLs, JSON-LD (Person + ProfessionalService + FAQPage + BlogPosting)

## Live pages

| Page | Route |
|---|---|
| Homepage — Climate Pipeline Partner | `/` |
| About | `/about` |
| Public CV (page + PDF download) | `/cv` |
| Case study — Raincoat | `/projects/case-study-raincoat` |
| Reality Check (lead magnet, page + PDF) | `/resources/reality-check` |
| Blog | `/blog` |

## Develop

```bash
npm install
npm run dev          # localhost:4321
npm run build        # dist/
npm run cv:pdf       # regenerate the CV PDF via Playwright
npm run reality:pdf  # regenerate the Reality Check PDF via Playwright
```

## Source of truth for copy

The canonical positioning + page copy lives in
`Freelance/crm/context/positioning/`
(`about.md`, `case-study-raincoat.md`, `reality-check.md`).
Edit there, then port to the Astro pages.

## History

The pre-refonte README and the May 2026 refonte working docs are archived under
`Freelance/archive/refonte-2026-05/`.
