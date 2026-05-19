# REFACTOR_PLAN.md — Refonte skarazdata.com en funnel Climate Pipeline Partner

> Document de sortie de la Session 1 (Audit interne + plan).
> Référence : `skaraz-site-audit.md`, `skaraz-offre-complete.md`, `skaraz-linkedin-profil.md`.
> Auteur : Claude Code · Date : 2026-05-18.
> ⚠️ Aucun fichier du repo n'a été modifié par cette session, hors la création du présent fichier.

---

## 0 — TL;DR

- Stack confirmée : **Astro 5.18 statique**, sitemap, **pas de Tailwind**, pas de MDX, pas de framework UI, CSS dans `src/styles/global.css`. Déploiement GitHub Actions → GitHub Pages, domaine custom `skarazdata.com` via CNAME.
- 1 seul layout (`BaseLayout.astro`) qui gère meta, OG, Twitter, JSON-LD et fonts Google.
- 4 composants (`Nav`, `Footer`, `ProjectCard`, `CategoryFilter`). Le **logo SVG base64 est dupliqué 3 fois** (Nav, Footer, index) → opportunité de factorisation.
- 6 pages routes : `/` (483 lignes), `/projects` + `/projects/[slug]` + `/projects/case-study-raincoat`, `/blog` + `/blog/[slug]`.
- 30 entries dans `src/content/projects/` (majoritairement hors positionnement). 8 entries dans `src/content/blogs/` (déjà majoritairement alignés climat/parametric/insurance).
- L'OG image cible existe déjà : `skaraz-og-image.png` à la racine (35 KB, à déplacer dans `public/og-image.png` en Session 8).
- 9 sessions cible, mais reséquencées en **3 phases** : Phase 1 (sessions 2+8) livre 70 % du ROI dès la première semaine.

---

## 1 — Arborescence actuelle (3 niveaux)

```
portfolio-site/
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Pages CI
├── README.md
├── astro.config.mjs                  # Astro static + sitemap
├── package.json                      # astro 5.18, @astrojs/sitemap 3.7.1
├── tsconfig.json                     # extends astro/tsconfigs/strict
├── public/
│   ├── CNAME                         # skarazdata.com
│   ├── cv-stephane-karasiewicz.pdf
│   ├── googleb31e1ca9408c8e6d.html   # Search Console verification
│   ├── ifremer-logo.png
│   ├── openclassrooms-logo.png
│   ├── portrait.jpg                  # 519 KB — utilisé comme OG image par défaut
│   ├── raincoat-logo.png
│   ├── robots.txt
│   ├── images/blog/                  # assets blog
│   ├── logos/                        # vide
│   └── screenshots/                  # 67 PNG des 30 projets
├── src/
│   ├── components/
│   │   ├── CategoryFilter.astro
│   │   ├── Footer.astro              # logo SVG inline base64 (dup #1)
│   │   ├── Nav.astro                 # logo SVG inline base64 (dup #2)
│   │   └── ProjectCard.astro
│   ├── content/
│   │   ├── config.ts                 # collections projects + blogs
│   │   ├── blogs/                    # 8 articles MD
│   │   └── projects/                 # 30 projects MD
│   ├── layouts/
│   │   └── BaseLayout.astro          # seul layout, gère meta + JSON-LD
│   ├── pages/
│   │   ├── index.astro               # 483 lignes, logo SVG inline (dup #3)
│   │   ├── blog/
│   │   │   ├── [...slug].astro       # 806 lignes (template article + styles)
│   │   │   └── index.astro
│   │   └── projects/
│   │       ├── [...slug].astro       # template projet dynamique
│   │       ├── case-study-raincoat.astro
│   │       └── index.astro
│   └── styles/
│       └── global.css                # CSS global (variables, layout, sections)
├── skaraz-linkedin-profil.md         # référence
├── skaraz-offre-complete.md          # référence
├── skaraz-og-image.png               # 35 KB, prête à intégrer (Session 8)
└── skaraz-site-audit.md              # référence
```

---

## 2 — Inventaire des fichiers existants

### 2.1 — Layout

| Fichier | Rôle | Notes |
|---|---|---|
| `src/layouts/BaseLayout.astro` | Layout unique : meta, OG, Twitter, JSON-LD optionnel, schema article meta, fonts Google (DM Serif Display + Outfit), skip-link, IntersectionObserver `.reveal` | Default `ogImage = portrait.jpg` à changer Session 8. Pas de prop `noindex` — à ajouter Session 7. |

### 2.2 — Composants (4)

| Composant | Rôle | À garder / refondre |
|---|---|---|
| `Nav.astro` | Barre supérieure : logo SVG, liens (Services / Experience / Projects / Blog / Research / Book a Call) | **À refondre Session 2** : 6 entrées → 3-4. |
| `Footer.astro` | Logo + 5 liens (GitHub / LinkedIn / ResearchGate / Email / Calendly) + mention auto-entrepreneur | **À enrichir Session 9** : SIRET, TVA, lien `/legal`, alignement Outreau. |
| `ProjectCard.astro` | Card projet basée sur CollectionEntry | À garder (peu utilisée après refonte, mais réutilisable pour `/research` ou autre). |
| `CategoryFilter.astro` | Filtre client-side pour `/projects` | À garder mais sera peu visible après Session 7 (liste cachée). |

### 2.3 — Pages (6 routes statiques + 2 templates dynamiques)

| Page | H1 actuel | Sections principales | Action cible |
|---|---|---|---|
| `/` (`src/pages/index.astro`) | *Turning Environmental Data into Business Decisions* | Hero · Trust bar · Services (6 cards) · Tech Stack (19) · Experience (9 entrées) · Portfolio (6 cards) · Featured CS banner · Publications (10) · Testimonials (3) · Process (4 étapes) · CTA | **Refonte profonde Session 2** : 7 sections orientées vente. |
| `/projects` (`src/pages/projects/index.astro`) | *30 Data Science Projects* | View toggle + filtres catégorie + grid | **Session 7** : cacher du menu, garder accessible ou rediriger vers homepage. |
| `/projects/[slug]` | Titre projet | Header + tech badges + screenshots + content MD | **Session 7** : `noindex` ciblé pour les slugs hors positionnement. |
| `/projects/case-study-raincoat` | *Climate Risk Data Infrastructure at Raincoat LLC* | Client · Challenge · What I Built · Impact · How We Worked · Tech Stack · CTA | **Session 4** : refondre vers narratif Climate Pipeline Partner (anonymiser dans le contenu, garder branding Raincoat dans la trust bar et le témoignage). Décider URL : conserver ou créer `/case-study` + redirect. |
| `/blog` (`src/pages/blog/index.astro`) | *Blog* | Liste articles triée par date | **Session 6** : design léger + sous-titre éditorial Climate Pipeline. |
| `/blog/[slug]` | Titre article | Header + meta + content MD + JSON-LD BlogPosting | À garder (très bon état). Lecture du fichier confirme la structure. |

### 2.4 — Content collections

- **`projects`** : 30 entries, schema avec catégories enum `'ML' | 'Computer Vision' | 'NLP' | 'Data Engineering' | 'MLOps' | 'LLM/AI'` (pas de catégorie "Climate" — à noter).
  - **Featured slugs** (homepage actuelle) : `satellite-analysis`, `demand-forecast`, `bi-dashboard`, `fraud-detection-system`, `iot-anomaly-detection`, `etl-orchestration`.
  - **Slugs à garder indexés** : `satellite-analysis`, `etl-orchestration`, `streaming-pipeline`, `case-study-raincoat` (alignés Climate Pipeline).
  - **Slugs à `noindex`** : les 27 autres (fraud, IoT, BI dashboard, demand forecast, credit risk, retail, churn, contract, RAG, sentiment, etc.) — détaillé Session 7.
- **`blogs`** : 8 articles, **déjà majoritairement alignés** Climate Pipeline (CSRD, ERA5, IFRS S2, parametric, satellite flood, secondary perils, Sentinel-1c, climate risk dashboards). Peu de travail éditorial à faire.

### 2.5 — Assets

| Asset | Usage | Notes |
|---|---|---|
| `public/portrait.jpg` (519 KB) | Hero + default OG image | À optimiser (> 200 KB cible) Session 8. |
| `public/cv-stephane-karasiewicz.pdf` | CTA download CV | À garder, à mettre à jour côté CV. |
| `public/ifremer-logo.png`, `public/raincoat-logo.png` | Trust bar + timeline + témoignages | À garder. |
| `public/openclassrooms-logo.png` | Timeline OpenClassrooms | À garder ou à supprimer si OpenClassrooms disparaît du career path Session 3. |
| `skaraz-og-image.png` (35 KB, racine) | OG image cible 1200×630 | **À déplacer dans `public/og-image.png` Session 8.** |
| `public/screenshots/*.png` (67 fichiers) | Pages projets | Conserver ; ne pas supprimer même si projets désindexés (les pages restent accessibles pour SEO long-tail si on choisit cette option). |
| `public/logos/` | Vide | Inutile, peut être supprimé. |

### 2.6 — Configurations

- **`astro.config.mjs`** : `output: static`, `site: https://skarazdata.com`, intégration `@astrojs/sitemap` (changefreq weekly, priority 0.7). **Pas d'option `filter`** sur le sitemap → tous les pages sont publiés, y compris les `noindex`. À ajouter Session 7.
- **`tsconfig.json`** : extends strict d'Astro.
- **`deploy.yml`** : workflow GitHub Pages, déclenchement sur push `main`. Node 20, `npm ci` + `npm run build`. Standard, à conserver.
- **`robots.txt`** : 74 octets, à vérifier en Session 8.
- **Pas de Tailwind**, pas de MDX, **pas de framework UI** : toute la refonte sera en CSS pure dans `src/styles/global.css` (ou splits par feuille de style locale).

### 2.7 — Anomalies et opportunités détectées (non listées dans l'audit initial)

1. **Logo SVG base64 dupliqué 3 fois** (Nav, Footer, index) — créer `src/components/Logo.astro` pour DRY.
2. **`BaseLayout` n'a pas de prop `noindex`** → bloquant pour la Session 7.
3. **`astro.config.mjs` n'a pas de `filter` sur le sitemap** → idem.
4. **JSON-LD homepage** contient encore `addressLocality: "Boulogne-sur-Mer"` et l'ancien pitch ("ESG reporting", "environmental decision-making") → à réécrire Session 2.
5. **Localisation incohérente** dans le code : Boulogne-sur-Mer (homepage CTA + JSON-LD) vs Outreau (audit + offre). L'offre complète tranche Outreau → à aligner partout.
6. **Schéma `projects` enum catégories** : pas de catégorie "Climate" / "Geospatial" / "Insurance" — pas bloquant si on cache la liste, mais à noter si on garde une page Selected Work plus tard.
7. **Calendly link unique** (`/15-minute-meeting`) pour tous les CTA — l'offre prévoit 2 niveaux (gratuit 15 min vs Discovery payée). À créer un second slot Calendly distinct ou un message qui qualifie (hors scope refonte, action côté Stéphane).
8. **`public/portrait.jpg` à 519 KB** sert aussi de fallback OG image → un poids OG > 300 KB peut être tronqué par certains scrapers. À optimiser ou remplacer.
9. **`articleMeta` typé sur `tags: string[]`** dans `BaseLayout` (utilisé par `/blog/[slug]`) → ok, à laisser tel quel.
10. **Pas de favicon explicite** dans `<head>` du `BaseLayout` — à vérifier Session 8.
11. **Pas de page 404 personnalisée** (`src/pages/404.astro`) — opportunité Session 9 pour un fallback brandé.
12. **Reality Check PDF n'existe pas encore** → Session 5 dépend de la production de ce livrable côté Stéphane.

---

## 3 — Plan détaillé Sessions 2 → 9

### Phases recommandées

| Phase | Sessions | Objectif | Livrable |
|---|---|---|---|
| **Phase 1 — MVP déployable** | 2 + 8 | 70 % du ROI : homepage neuve + OG image + meta | Site cohérent avec LinkedIn dès J+7 |
| **Phase 2 — Cohérence funnel** | 3 + 4 + 7 | About + Case Study + nettoyage projets | Site funnel complet, sans dilution |
| **Phase 3 — Finitions** | 5 + 6 + 9 | Resources + Research/Blog + Legal | Site final, hub lead magnet activé |

---

### 📍 Session 2 — Homepage refondue (Phase 1, priorité 🔴)

**Complexité : 🔴 Forte** — la pièce maîtresse, 7 sections, ~400 lignes à réécrire + JSON-LD + Nav à simplifier.

**Fichiers touchés :**
- `src/pages/index.astro` (refonte complète)
- `src/components/Nav.astro` (simplification 6 → 4 entrées)
- `src/layouts/BaseLayout.astro` (mise à jour `description` par défaut)
- Création composants : `Logo.astro`, `OfferTier.astro`, `Testimonial.astro`, `TrustLogos.astro`

**Composants à créer (Session 2) :**

| Nom | Rôle | Props |
|---|---|---|
| `Logo.astro` | Wrap le SVG base64 (DRY sur 3 duplications) | `size?: 'sm' \| 'md' \| 'lg'`, `class?: string` |
| `OfferTier.astro` | Card d'un palier de l'offre | `title`, `price`, `duration`, `deliverable`, `cta`, `href`, `featured?: boolean` |
| `Testimonial.astro` | Card témoignage | `quote`, `name`, `role`, `logoSrc`, `logoAlt`, `featured?: boolean` |
| `TrustLogos.astro` | Bandeau logos IFREMER + Raincoat + stats | (props internes) |

**Structure cible (rappel audit) :**
1. **Hero** — H1 *"From climate data to production pipelines — in 8 weeks, not 9 months."* + sous-titre + badge crédibilité + 2 CTAs (LinkedIn DM "reality" + Calendly Discovery).
2. **Le problème** — *"You've shipped one peril. The next three are 9 months out."*
3. **La solution** — *"I close that gap."* + 3 colonnes (Climate Science / DevOps / Scientific dialogue).
4. **L'offre** — 3 cards `OfferTier` (Discovery / Partner / Retainer).
5. **Garantie** — Code Quality Guarantee.
6. **Témoignages** — 3 `Testimonial` (Jan Paral en 1er, Kelig Mahé, Carolin Neven).
7. **CTA final** — DM LinkedIn "reality" + Calendly Discovery.

**Sections supprimées de la homepage** (déplacées ailleurs ou retirées) :
- Trust bar inline → version condensée dans hero ou section dédiée
- Services 6 cards → remplacée par 3 OfferTier
- Tech Stack 19 outils → `/about` (Session 3) ou supprimée
- Career Path 9 entrées → `/about` condensé 3 entrées
- Portfolio 6 cards → `/case-study` (Session 4)
- Publications 10 cards → `/research` (Session 6)
- Process 4 étapes → simplifié dans hero ou supprimé

**Nav cible Session 2** (4 entrées + CTA) :
```
About · Case Study · Blog · Resources [+ Book a Call]
```
(Resources sera placeholder Session 2, créée en Session 5.)

**JSON-LD à réécrire :**
- Mise à jour `Person.jobTitle` → *"Climate Pipeline Partner · Senior Data Engineer for Parametric Insurance"*.
- Mise à jour `ProfessionalService.description` → pitch officiel.
- Mise à jour `addressLocality` → **Outreau** (pas Boulogne-sur-Mer).
- FAQPage : 3 Q/R reformulées autour des paliers Discovery / Partner / Retainer + Code Quality Guarantee.

**Validation Session 2 :**
- [ ] `npm run build` passe sans warning.
- [ ] `npm run dev` : H1 lisible above the fold, CTAs cliquables.
- [ ] Test mobile (responsive) : 7 sections lisibles.
- [ ] Témoignage Jan Paral en 1er.
- [ ] Tous les anciens liens internes (Services anchor, Experience anchor, Research anchor) supprimés du Nav.

---

### 📍 Session 3 — Page `/about` (Phase 2, priorité 🔴)

**Complexité : 🟠 Moyenne** — page from scratch, structure connue.

**Fichiers touchés :**
- Création `src/pages/about.astro`
- Réutilise composants Session 2 (`Logo`, `TrustLogos`)
- Mise à jour `Nav.astro` (lien About déjà présent)

**Structure cible :**
1. **Hook personnel** — *"Why I do this work."*
2. **Le trio rare** — 3 colonnes développées (Climate Science 15+ yrs / DevOps 2 yrs Raincoat / PhD + publications + CRAN).
3. **Career path condensé** (3 entrées) :
   - 2023 → Present : Skaraz Data + Raincoat
   - 2017 → 2022 : IFREMER (résumé)
   - 2014 → 2017 : PhD Marine Ecology
4. **Tech stack focused** (optionnel, en aparté) — 6-8 outils max : Python, xarray, GDAL, Airflow, Docker, satellite/reanalysis datasets, R/CRAN.
5. **Localisation + langues** — Outreau, France · Remote worldwide · 🇫🇷🇬🇧 native.
6. **CTA léger** — *"Want to talk?"* → LinkedIn DM + Calendly.

**Composants nouveaux Session 3 :**
- `CareerEntry.astro` — entrée condensée du career path (date, role, company, 2-3 highlights).

---

### 📍 Session 4 — Page `/case-study` Raincoat (Phase 2, priorité 🔴)

**Complexité : 🟢 Faible** — refonte d'existant.

**Question à trancher** :
- **Option A (recommandée)** : conserver URL `/projects/case-study-raincoat` + créer alias `/case-study` qui redirige (ou copie).
- **Option B** : déplacer vers `/case-study` propre et ajouter une redirection 301 statique (Astro `output: static` ne supporte pas les redirects serveur natifs — il faut un `<meta http-equiv="refresh">` sur l'ancienne URL, ou laisser les deux).

**Fichiers touchés :**
- Refonte `src/pages/projects/case-study-raincoat.astro`
- (Option B) Création `src/pages/case-study.astro` ou `src/pages/case-study/index.astro` + page redirect sur l'ancienne URL.

**Structure cible :**
- Header (titre + sous-titre méthode-first, pas "case study").
- Context client (anonymisé : "a US-based parametric insurtech, Seed-stage").
- Challenge (3 blocs comme aujourd'hui mais reformulés).
- Method (ce que j'ai fait : ingestion, modularité, dev/ops).
- Outcomes (impact chiffré : 10+ pays, 4 périls, 90 % data prep reduction).
- Datasets & Tech Stack.
- Témoignage Jan Paral en pied.
- CTA Discovery payante.

**Note d'anonymisation** : le branding Raincoat peut rester visible (logo trust bar + témoignage Jan Paral nominatif). C'est le **récit du cas** qui doit être méthodologique, pas le client.

---

### 📍 Session 5 — Page `/resources` + lead magnet (Phase 3, priorité 🟠)

**Complexité : 🟢 Faible** — page simple, sans complexité dynamique.

**Dépendance externe : Reality Check PDF doit être produit côté Stéphane.**

**Fichiers touchés :**
- Création `src/pages/resources/index.astro` (ou `src/pages/resources.astro`).
- Création `public/resources/climate-pipeline-reality-check.pdf` (à déposer une fois produit).
- Mise à jour `Nav.astro` (lien Resources).

**Structure cible :**
1. Intro courte — *"Practical tools for parametric insurance data teams."*
2. Card #1 : **The Climate Pipeline Reality Check (PDF)**
   - Titre + 1 paragraphe pitch + bouton "Download" direct + bouton "Get it via LinkedIn DM" (message pré-rempli "reality").
3. Placeholders pour futurs lead magnets (commentés en attendant).
4. CTA → Discovery call.

**Décision à confirmer** : pas de form email sur le site → téléchargement direct + DM LinkedIn pour les leads qualifiés. (Cohérent avec stratégie DM-first du document offre.)

---

### 📍 Session 6 — Page `/research` + `/blog` (Phase 3, priorité 🟢)

**Complexité : 🟠 Moyenne** — 2 pages, dont une nouvelle.

**Fichiers touchés :**
- Création `src/pages/research/index.astro` (ou `.astro` direct).
- Mise à jour `src/pages/blog/index.astro` (sous-titre éditorial, design léger).
- Mise à jour `Nav.astro` (Research dans le menu secondaire ou footer).

**Structure `/research` :**
1. CRAN Packages (BDAlgo, subniche) — cards avec stats download/citations.
2. Publications peer-reviewed (5 papers) — cards DOI.
3. Datasets SEANOE (2).
4. Co-author publications (3).
5. CTA léger.

**Structure `/blog` :**
- Garder layout existant (liste tri par date).
- Ajouter sous-titre éditorial : *"Industrial climate data, parametric insurance, and the pipelines underneath."*
- Filtre tags optionnel (climate-risk, parametric, satellite-data, csrd, ifrs).

**Composants Session 6 :**
- `PublicationCard.astro` — factoriser depuis homepage actuelle.

---

### 📍 Session 7 — Nettoyage `/projects` (Phase 2, priorité 🟠)

**Complexité : 🟠 Moyenne** — besoin de mécanisme `noindex` + filter sitemap.

**Décisions à prendre AVANT de coder :**

**Décision 7.A — Liste publique `/projects`** :
- (a) Cacher entièrement la page (retirer du menu + redirect vers homepage).
- (b) Garder la page mais ne lister que les projets Climate Pipeline (4-5 entrées).
- (c) Garder telle quelle mais retirer du menu (accessible URL directe).

**Recommandation : (b)** — garde la valeur SEO long-tail des projets pertinents, sans diluer.

**Décision 7.B — Slugs à garder vs à `noindex`** :

| Action | Slugs |
|---|---|
| **Garder visible + indexé** | `satellite-analysis`, `etl-orchestration`, `streaming-pipeline`, `case-study-raincoat` |
| **`noindex` mais accessible URL** | les 26 autres (fraud, IoT, BI dashboard, demand forecast, credit risk, retail, churn, contract, RAG, sentiment, customer-360, defect, distributed-training, document-oc, face-attendance, iac, medical-image, ml-cicd, ml-deployment, ml-monitoring, multilingual, predictive-maintenance, prompt-eval, recommendation, text-classification, code-documentation, data-lake-architecture) |

**Implémentation technique :**

1. Étendre `BaseLayout.astro` :
   ```ts
   interface Props {
     ...
     noindex?: boolean;
   }
   // ...
   <head>
     {noindex && <meta name="robots" content="noindex,follow">}
   </head>
   ```

2. Étendre schema `projects` dans `src/content/config.ts` :
   ```ts
   noindex: z.boolean().default(false),
   ```

3. Mettre à jour les 26 fichiers MD frontmatter (`noindex: true`).

4. Lire `project.data.noindex` dans `src/pages/projects/[...slug].astro` et le passer au `BaseLayout`.

5. Configurer `@astrojs/sitemap` :
   ```js
   sitemap({
     filter: (page) => !/* logique d'exclusion */,
   })
   ```

**Fichiers touchés :**
- `src/content/config.ts` (schema + 1 ligne)
- `src/layouts/BaseLayout.astro` (prop noindex)
- `src/pages/projects/[...slug].astro` (propagation)
- `src/pages/projects/index.astro` (filter list)
- `src/components/Nav.astro` (retirer Projects si choix (a) ou (c))
- `astro.config.mjs` (filter sitemap)
- 26 fichiers `src/content/projects/*.md` (frontmatter noindex)

---

### 📍 Session 8 — Meta-tags + OG image + SEO global (Phase 1, priorité 🔴)

**Complexité : 🟢 Faible** — mise à jour BaseLayout + asset.

**Tâches :**
1. Déplacer `/skaraz-og-image.png` → `/public/og-image.png`.
2. Mettre à jour `BaseLayout.astro` :
   - `ogImage` default → `https://skarazdata.com/og-image.png`.
   - `description` default → aligné Climate Pipeline.
3. Auditer titres / descriptions par page :
   - `/` — *"Skaraz Data — Climate Pipeline Partner for parametric insurance"* (déjà OK).
   - `/about` — à créer Session 3.
   - `/case-study` — *"Climate pipelines across 10+ countries — a case study"*.
   - `/blog` — déjà OK, alignement éditorial confirmé.
   - `/research` — *"Publications, CRAN packages, datasets — Stéphane Karasiewicz"*.
   - `/resources` — *"Free tools for parametric insurance data teams"*.
4. Optimiser `portrait.jpg` (cible < 200 KB).
5. Vérifier `robots.txt`, `sitemap.xml`, favicon.
6. Ajouter `<link rel="icon" type="image/png" href="/favicon.png" />` si manquant.
7. Vérifier que `og-image.png` est référencé par défaut **et** override possible page par page (déjà supporté par `BaseLayout`).

**Validation Session 8 :**
- [ ] Test OG sur LinkedIn Post Inspector + Twitter Card Validator + Facebook Sharing Debugger.
- [ ] `sitemap.xml` ne contient que les pages voulues.
- [ ] Lighthouse SEO ≥ 95.

---

### 📍 Session 9 — Mentions légales + footer + détails (Phase 3, priorité 🟢)

**Complexité : 🟢 Faible**.

**Fichiers touchés :**
- Création `src/pages/legal.astro` (ou `/legal/index.astro`).
- Mise à jour `Footer.astro` : ajout lien `/legal`, mise à jour mention auto-entrepreneur + SIRET + ville.
- Création éventuelle `src/pages/404.astro` (page non prévue par l'audit mais opportunité).

**Contenu `/legal` :**
- Identité éditeur : Stéphane Karasiewicz, Skaraz Data, Outreau, France.
- SIRET, code APE/NAF, TVA intra (statut auto-entrepreneur → mention "TVA non applicable, art. 293 B du CGI").
- Hébergement : GitHub Pages (GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107).
- Données personnelles / RGPD : politique courte (pas de tracking, formulaire = mailto / DM LinkedIn).
- Cookies : aucun (à confirmer si Calendly embed pose problème).
- Crédits / licence (MIT pour le code, voir README).

**Validation Session 9 :**
- [ ] Footer pointe vers `/legal`.
- [ ] Mention SIRET visible.
- [ ] Localisation alignée Outreau partout.

---

## 4 — Récapitulatif composants

### À créer

| Composant | Session | Réutilisations prévues |
|---|---|---|
| `Logo.astro` | 2 | Nav, Footer, Hero, About |
| `OfferTier.astro` | 2 | Homepage |
| `Testimonial.astro` | 2 | Homepage, About, Case Study |
| `TrustLogos.astro` | 2 | Homepage, About |
| `CareerEntry.astro` | 3 | About |
| `PublicationCard.astro` | 6 | Research |
| `CTA.astro` *(optionnel)* | 2 | Toutes les pages |

### À refondre

| Composant | Sessions |
|---|---|
| `Nav.astro` | 2 (simplification 6→4 entrées) ; 5 (ajout Resources) ; 7 (retirer Projects si décidé) |
| `Footer.astro` | 9 (SIRET, lien Legal, ville) |
| `BaseLayout.astro` | 2 (description default) ; 7 (prop noindex) ; 8 (ogImage default) ; 9 (favicon) |

### À garder tel quel

- `ProjectCard.astro`
- `CategoryFilter.astro` (utilisée par `/projects`, à conserver même si liste filtrée)
- Templates `[...slug].astro` (projets + blog) — petits ajustements seulement (Session 7).

---

## 5 — Récapitulatif routes

| Route | Statut actuel | Action | Session |
|---|---|---|---|
| `/` | Long portfolio scrollable | Refonte profonde | 2 |
| `/about` | N'existe pas | Créer | 3 |
| `/case-study` | N'existe pas (existe `/projects/case-study-raincoat`) | Décider URL + refondre | 4 |
| `/resources` | N'existe pas | Créer | 5 |
| `/research` | N'existe pas (ancre `#publications`) | Créer | 6 |
| `/blog` | Existe | Léger ajustement éditorial | 6 |
| `/blog/[slug]` | Existe | Aucun changement majeur | — |
| `/projects` | Existe | Filtrer ou cacher | 7 |
| `/projects/[slug]` | Existe | `noindex` ciblé pour 26 entrées | 7 |
| `/legal` | N'existe pas | Créer | 9 |
| `/404` | N'existe pas (fallback Astro par défaut) | Créer (optionnel) | 9 |

---

## 6 — Risques et points de vigilance

| # | Risque | Sévérité | Mitigation |
|---|---|---|---|
| 1 | **Perte de trafic SEO court terme** sur les anciens mots-clés (data scientist freelance, fraud detection, IoT) | 🟠 | Accepter ; le trafic ne convertissait pas en revenu. Tracking 3-6 mois sur les nouveaux mots-clés. |
| 2 | **Reality Check PDF n'existe pas encore** | 🟠 | Phase 3 pilotée par production du livrable côté Stéphane. Pas bloquant pour Sessions 2-4. |
| 3 | **Calendly unique** pour CTA gratuit + Discovery payante | 🟡 | Décision côté Stéphane : créer un 2e slot ou laisser le message Calendly qualifier. |
| 4 | **Localisation incohérente** Boulogne-sur-Mer / Outreau | 🟢 | Aligner Outreau partout Session 2 (homepage + JSON-LD) et Session 9 (footer + legal). |
| 5 | **Pas de mécanisme noindex existant** | 🟢 | Implémenté Session 7 via prop `BaseLayout` + schema collection. |
| 6 | **Logo SVG dupliqué 3 fois** | 🟢 | Composant `Logo.astro` Session 2. |
| 7 | **Astro static = pas de redirect serveur** pour Case Study | 🟡 | Si on change l'URL, utiliser `<meta http-equiv="refresh">` ou laisser les 2 URLs avec canonical pointant vers la nouvelle. |
| 8 | **Sitemap auto = tout publié par défaut** | 🟢 | Ajouter `filter` dans `astro.config.mjs` Session 7. |
| 9 | **`portrait.jpg` 519 KB** trop lourd pour OG | 🟢 | Optimisation Session 8 + bascule sur `og-image.png` (35 KB). |
| 10 | **JSON-LD homepage encore au pitch ancien** | 🟠 | Réécriture complète Session 2. |
| 11 | **Schema enum `projects` figé** sur 6 catégories | 🟢 | Pas bloquant ; si ajout catégorie "Climate" nécessaire en Session 6, c'est 1 ligne. |
| 12 | **Aucune page 404 personnalisée** | 🟢 | Opportunité Session 9. |
| 13 | **Pas de favicon explicite** | 🟢 | Vérifier Session 8. |
| 14 | **Calendly embed pose problème RGPD** ? | 🟢 | À vérifier Session 9 — sinon ajouter mention cookies. |
| 15 | **CI GitHub Pages** : 1 push = 1 build, pas de preview branch | 🟡 | Tester en local (`npm run build && npm run preview`) avant chaque push. |

---

## 7 — Estimation de complexité

| Session | Complexité | Estimation effort | Phase |
|---|---|---|---|
| 2 — Homepage | 🔴 Forte | ~3-4 h en session continue | 1 |
| 3 — About | 🟠 Moyenne | ~1,5-2 h | 2 |
| 4 — Case Study | 🟢 Faible | ~1-1,5 h | 2 |
| 5 — Resources | 🟢 Faible | ~1 h | 3 |
| 6 — Research + Blog | 🟠 Moyenne | ~1,5-2 h | 3 |
| 7 — Nettoyage Projects | 🟠 Moyenne | ~1,5-2 h | 2 |
| 8 — Meta + OG + SEO | 🟢 Faible | ~1 h | 1 |
| 9 — Legal + Footer + 404 | 🟢 Faible | ~1 h | 3 |

**Total brut estimé : 10-13 h** de Claude Code productif, réparties sur 8 sessions distinctes.

---

## 8 — Hypothèses prises (à valider avant Session 2)

1. La langue du site reste **anglais** (cohérent LinkedIn + cible parametric insurance US/UK/EU/LatAm).
2. Le **CTA primaire homepage** est *"Send 'reality' on LinkedIn"* (DM-first), CTA secondaire *"Book a Discovery Call"* (Calendly).
3. Le **témoignage Jan Paral est conservé tel quel** (l'audit suggère de le "reformater" — je suggère un encadré qui met en gras la phrase clé "rare combination of skills" plutôt qu'une réécriture, parce qu'on n'invente pas un témoignage).
4. La **page `/case-study` garde le slug `/projects/case-study-raincoat`** pour ne pas casser les backlinks LinkedIn existants. Un alias `/case-study` peut être ajouté ultérieurement.
5. Le **Reality Check PDF** sera produit côté Stéphane en parallèle ; Session 5 peut être lancée avec un placeholder.
6. **Pas d'analytics** ajoutées (cohérent RGPD-friendly, vu identification "auto-entrepreneur, France").
7. **Pas de formulaire email** sur le site : DM LinkedIn + Calendly + mailto sont les seuls canaux de capture.
8. La **localisation officielle** est **Outreau, France** (offre complète tranche). Boulogne-sur-Mer sera remplacé partout.
9. Le **Calendly link existant** (`/15-minute-meeting`) reste le seul utilisé Session 2 ; un slot Discovery payante distinct est une décision indépendante côté Stéphane.
10. Le **schema `projects` enum catégories** reste tel quel — pas d'ajout de catégorie "Climate" en Session 2-7.

---

## 9 — Plan d'attaque proposé pour la suite

```
J+0   ──┐
        │  Session 1 ✅ (cette session)
J+1   ──┘
J+2   ──┐
        │  Session 2 — Homepage (la grosse pièce)
        │  Session 8 — Meta + OG (rapide, peut suivre Session 2 le même jour)
J+3   ──┘
                    → DÉPLOIEMENT PROD : 70 % du ROI

J+4   ──┐
        │  Session 7 — Nettoyage projects
        │  Session 4 — Case Study
J+5   ──┘
J+6   ──┐
        │  Session 3 — About
J+7   ──┘
                    → DÉPLOIEMENT PROD : site funnel complet

J+8+  ──┐
        │  Session 5 — Resources (dépend Reality Check PDF)
        │  Session 6 — Research + Blog
        │  Session 9 — Legal + Footer
J+14  ──┘
                    → DÉPLOIEMENT PROD : version finale
```

---

## 10 — Avant de lancer la Session 2

**Questions à confirmer côté Stéphane :**

1. **Hero H1 final** : *"From climate data to production pipelines — in 8 weeks, not 9 months."* — confirmé tel quel ou variation ?
2. **CTA primaire** : "Send 'reality' on LinkedIn" → lien vers profil LinkedIn direct, ou URL `https://www.linkedin.com/messaging/compose?recipient=stephane-karasiewicz` ? (Note : LinkedIn ne supporte pas le pré-remplissage de DM via URL — à confirmer).
3. **Témoignage Jan Paral** : reformulation autorisée (l'audit dit "reformater") ou citation textuelle stricte ?
4. **Page `/case-study`** : conserver `/projects/case-study-raincoat` ou créer `/case-study` ?
5. **Suppression complète du tech stack** ou conservation en `/about` (Session 3) ?
6. **Process "How I Work"** : à supprimer entièrement de la homepage ou garder une version condensée ?

Une fois ces 6 points tranchés, **Session 2 peut démarrer immédiatement**.

---

*Fin du REFACTOR_PLAN.md — Session 1 close.*
