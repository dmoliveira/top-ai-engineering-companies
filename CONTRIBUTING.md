# Contributing

Thanks for helping improve this directory of top AI and engineering companies.

## Contribution rules

- Prefer official company sources for factual fields.
- Keep the project focused on product-first technology, infrastructure, and AI companies.
- Default inclusion bar is companies with 500+ employees and meaningful engineering or AI relevance.
- Add at least one official source URL for each company.
- Engineering blog and AI/research blog links should point to official company pages when available.

## Data workflow

1. Edit `docs/data/companies.json`.
2. Keep `business_type` and `sub_type` aligned with `docs/data/taxonomy.json`.
3. Run:

```bash
make validate
```

## Site workflow

Serve the site locally from `docs` because the app loads data with `fetch()`:

```bash
make serve
```

Then open `http://localhost:8000`.

## Style notes

- Keep copy concise and factual.
- Prefer category clarity over overly granular taxonomy.
- Treat this as a curated study directory, not a formal ranking.
