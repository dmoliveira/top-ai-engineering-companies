# Top AI and Engineering Companies

[![GitHub Pages Deploy](https://github.com/dmoliveira/top-ai-engineering-companies/actions/workflows/pages.yml/badge.svg)](https://github.com/dmoliveira/top-ai-engineering-companies/actions/workflows/pages.yml)
[![GitHub Pages Ready](https://img.shields.io/badge/GitHub%20Pages-ready-black)](./docs/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Public Repo](https://img.shields.io/badge/repo-public-lightgrey)](./README.md)
[![Support via Stripe](https://img.shields.io/badge/support-stripe-635bff?logo=stripe&logoColor=white)](https://buy.stripe.com/8x200i8bSgVe3Vl3g8bfO00)

Curated GitHub Pages directory of **top AI companies, top engineering companies, and product-first big tech organizations** with a **D3 treemap**, key facts, and official engineering or AI study links.

Created by **[Diego Marinho](https://dmoliveira.github.io/my-cv-public/cv/human/)**.

## What this includes

- D3.js treemap grouped by business type and sub-type
- search by partial company name or keyword
- filters by country, business type, sub-type, and field tags
- company facts such as founded year, CEO, HQ, and employee scale bucket
- official engineering blog links, AI blog links, career links, and source links
- static GitHub Pages deployment from `/docs`

## Open the site locally

Serve from `/docs` because the site loads JSON with `fetch()`:

```bash
make serve
```

Open: [http://localhost:8000](http://localhost:8000)

## Validate data

```bash
make validate
```

## Data notes

- this is a curated directory, not a formal financial ranking
- default inclusion bar is companies with 500+ employees and strong engineering or AI relevance
- companies are grouped by `business type → sub-type → company`
- tile sizes are equal in v1 to avoid inventing an opaque score
- facts should be supported by official public sources whenever possible

## Project structure

- `docs/index.html`: main directory and treemap UI
- `docs/app.js`: D3 treemap logic, filters, and company details
- `docs/styles.css`: visual system and responsive layout
- `docs/data/companies.json`: canonical company dataset
- `docs/data/taxonomy.json`: controlled taxonomy values
- `docs/methodology.html`: curation and inclusion notes
- `docs/support.html`: support and contribution context
- `scripts/validate_data.py`: dataset validation

## Roadmap ideas

- expand to hundreds of companies while preserving taxonomy quality
- add richer source freshness tracking
- optionally add featured company pages or spotlight articles
- optionally add alternate views such as table mode or country mode

## License

MIT. See `LICENSE`.
