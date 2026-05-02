#!/usr/bin/env python3
"""Generate static company detail pages, company index, and sitemap."""

from __future__ import annotations

import html
import json
from pathlib import Path
import shutil
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
COMPANIES_PATH = DOCS / "data" / "companies.json"
COMPANIES_DIR = DOCS / "companies"
BASE_URL = "https://dmoliveira.github.io/top-ai-engineering-companies"


def load_companies() -> list[dict]:
    return json.loads(COMPANIES_PATH.read_text())


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def trim_meta(value: str, limit: int = 155) -> str:
    value = value.strip()
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


def domain_label(url: str | None) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    return parsed.netloc.replace("www.", "")


def page_title(company: dict) -> str:
    return f"{company['name']} | AI Engineering Company Profile"


def meta_description(company: dict) -> str:
    article = "an" if company["business_type"][0].lower() in {"a", "e", "i", "o", "u"} else "a"
    return trim_meta(
        f"{company['name']} is {article} {company['business_type']} company in {company['country']}. Explore key facts, engineering and AI blog links, and related companies in this AI engineering directory."
    )


def canonical_url(company: dict) -> str:
    return f"{BASE_URL}/companies/{company['id']}/"


def related_companies(company: dict, companies: list[dict]) -> list[dict]:
    ranked = []
    for other in companies:
        if other["id"] == company["id"]:
            continue
        score = 0
        if other["business_type"] == company["business_type"]:
            score += 2
        if other["sub_type"][0] == company["sub_type"][0]:
            score += 2
        if other["country"] == company["country"]:
            score += 1
        if score:
            ranked.append((score, other["name"], other))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [item[2] for item in ranked[:6]]


def facts_html(company: dict) -> str:
    facts = [
        ("Founded", company["founded_year"]),
        ("CEO", company["ceo"]),
        ("Headquarters", company["hq_city"]),
        ("Country", company["country"]),
        ("Employee scale", company["employee_count_bucket"]),
        ("Business type", company["business_type"]),
    ]
    return "\n".join(
        f'<div class="fact-row"><span class="fact-label">{esc(label)}</span><strong>{esc(str(value))}</strong></div>'
        for label, value in facts
    )


def links_html(company: dict) -> str:
    link_map = [
        (company.get("website_url"), "Official website"),
        (company.get("engineering_blog_url"), "Engineering blog"),
        (company.get("ai_blog_url"), "AI / research blog"),
        (company.get("careers_url"), "Careers"),
    ]
    return "\n".join(
        f'<a class="pill" href="{esc(url)}" target="_blank" rel="noreferrer">{esc(label)}</a>'
        for url, label in link_map
        if url
    )


def tags_html(company: dict) -> str:
    return "\n".join(f'<span class="tag">{esc(tag)}</span>' for tag in company["tags"])


def sources_html(company: dict) -> str:
    return "\n".join(
        f'<li><a href="{esc(url)}" target="_blank" rel="noreferrer">{esc(domain_label(url) or url)}</a></li>'
        for url in company["source_urls"]
    )


def related_html(company: dict, companies: list[dict]) -> str:
    return "\n".join(
        f'''
        <a class="related-page-card" href="../{esc(other['id'])}/">
          <strong>{esc(other['name'])}</strong>
          <span>{esc(other['sub_type'][0])} • {esc(other['country'])}</span>
        </a>
        '''
        for other in related_companies(company, companies)
    )


def company_page_html(company: dict, companies: list[dict]) -> str:
    title = page_title(company)
    description = meta_description(company)
    canonical = canonical_url(company)
    initials = "".join(part[0].upper() for part in company["name"].split()[:2])
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(description)}" />
    <meta property="og:title" content="{esc(title)}" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="{esc(canonical)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="{esc(canonical)}" />
    <link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../../styles.css" />
  </head>
  <body>
    <header class="site-header site-header--compact">
      <div class="shell shell--topbar">
        <a class="brand" href="../../index.html" aria-label="Top AI and Engineering Companies home">
          <span class="brand-mark" aria-hidden="true"><img src="../../assets/favicon.svg" alt="" /></span>
          <span class="brand-copy"><strong>AI Engineering</strong><span>Directory</span></span>
        </a>
        <nav class="top-nav" aria-label="Primary">
          <a href="../../index.html">Directory</a>
          <a href="../../companies/index.html" aria-current="page">Company Pages</a>
          <a href="../../methodology.html">Methodology</a>
          <a href="../../support.html">Support</a>
        </nav>
        <div class="topbar-tools">
          <span class="icon-button mode-status" role="status"><span>SEO</span><span id="mode-label">Profile</span></span>
        </div>
      </div>
    </header>

    <main class="shell company-page-shell">
      <nav class="company-breadcrumbs" aria-label="Breadcrumbs">
        <a href="../../index.html">Directory</a>
        <span>›</span>
        <a href="../../companies/index.html">Companies</a>
        <span>›</span>
        <span>{esc(company['name'])}</span>
      </nav>

      <section class="hero-card company-page-hero">
        <div class="company-page-hero__main">
          <div class="company-avatar company-avatar--large">{esc(initials)}</div>
          <div>
            <p class="eyebrow">Company profile</p>
            <h1>{esc(company['name'])}</h1>
            <div class="pill-row">
              <span class="pill">{esc(company['business_type'])}</span>
              <span class="pill">{esc(company['sub_type'][0])}</span>
              <span class="pill">{esc(company['country'])}</span>
            </div>
            <p class="lede">{esc(company['description_short'])}</p>
            <div class="link-list">{links_html(company)}</div>
          </div>
        </div>
        <div class="hero-stats company-page-stats">
          <article class="stat-card"><span class="stat-label">Founded</span><span class="stat-value">{esc(str(company['founded_year']))}</span><span class="stat-caption">Company origin year</span></article>
          <article class="stat-card"><span class="stat-label">CEO</span><span class="stat-value company-page-stat-text">{esc(company['ceo'])}</span><span class="stat-caption">Current leadership</span></article>
          <article class="stat-card"><span class="stat-label">Scale</span><span class="stat-value company-page-stat-text">{esc(company['employee_count_bucket'])}</span><span class="stat-caption">Employee size bucket</span></article>
        </div>
      </section>

      <section class="workspace-grid workspace-grid--page">
        <article class="panel-card company-page-content">
          <div class="panel-header panel-header--tight"><div><p class="eyebrow">Overview</p><h2>Why study {esc(company['name'])}</h2></div></div>
          <p>{esc(company['description_short'])}</p>
          <p class="meta-line">This page is part of the Top AI and Engineering Companies directory and is intended for engineering blog discovery, AI landscape scanning, and company-level study.</p>

          <div class="panel-header panel-header--tight"><div><p class="eyebrow">Core facts</p><h2>Key details</h2></div></div>
          <div class="inspector-grid">{facts_html(company)}</div>

          <div class="panel-header panel-header--tight"><div><p class="eyebrow">Tags</p><h2>Fields and focus areas</h2></div></div>
          <div class="tag-list">{tags_html(company)}</div>

          <div class="panel-header panel-header--tight"><div><p class="eyebrow">Sources</p><h2>Official references</h2></div></div>
          <ul class="source-list">{sources_html(company)}</ul>
        </article>

        <aside class="inspector-rail company-page-sidebar">
          <section class="panel-card related-card">
            <div class="panel-header panel-header--tight"><div><p class="eyebrow">Related companies</p><h2>Similar organizations</h2></div></div>
            <div class="related-list">{related_html(company, companies)}</div>
          </section>

          <section class="panel-card tip-card">
            <h3>Continue exploring</h3>
            <p>Return to the interactive radial tree or browse the full company index to compare engineering and AI organizations by business type, country, and field tag.</p>
            <div class="link-list">
              <a class="primary-button" href="../../index.html">Open interactive directory</a>
              <a class="pill" href="../../companies/index.html">Browse all company pages</a>
            </div>
          </section>
        </aside>
      </section>
    </main>

    <footer class="site-footer">
      <div class="shell footer-grid">
        <p>Curated static directory for learning and research.</p>
        <p>Built for GitHub Pages using D3.js, official links, and a product-first curation lens.</p>
      </div>
    </footer>
  </body>
</html>
"""


def company_index_html(companies: list[dict]) -> str:
    cards = "\n".join(
        f'''
        <a class="related-page-card company-index-card" href="./{esc(company['id'])}/">
          <strong>{esc(company['name'])}</strong>
          <span>{esc(company['business_type'])} • {esc(company['sub_type'][0])}</span>
          <span>{esc(company['country'])} • {esc(str(company['founded_year']))}</span>
        </a>
        '''
        for company in sorted(companies, key=lambda item: item["name"])
    )
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Company Pages | Top AI and Engineering Companies</title>
    <meta name="description" content="Browse dedicated static company pages for top AI and engineering companies, with key facts, official links, and related-company paths." />
    <link rel="canonical" href="{BASE_URL}/companies/" />
    <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../styles.css" />
  </head>
  <body>
    <header class="site-header site-header--compact">
      <div class="shell shell--topbar">
        <a class="brand" href="../index.html" aria-label="Top AI and Engineering Companies home">
          <span class="brand-mark" aria-hidden="true"><img src="../assets/favicon.svg" alt="" /></span>
          <span class="brand-copy"><strong>AI Engineering</strong><span>Directory</span></span>
        </a>
        <nav class="top-nav" aria-label="Primary">
          <a href="../index.html">Directory</a>
          <a href="./index.html" aria-current="page">Company Pages</a>
          <a href="../methodology.html">Methodology</a>
          <a href="../support.html">Support</a>
        </nav>
        <div class="topbar-tools"><span class="icon-button mode-status" role="status"><span>SEO</span><span id="mode-label">Index</span></span></div>
      </div>
    </header>
    <main class="shell app-shell">
      <section class="hero-card company-page-hero company-page-hero--index">
        <div class="hero-copy">
          <p class="eyebrow">Company pages</p>
          <h1>Browse dedicated company profiles</h1>
          <p class="lede">Each page includes key facts, official engineering or AI blog links, and related-company exploration paths.</p>
        </div>
      </section>
      <section class="panel-card category-card">
        <div class="panel-header panel-header--tight"><div><p class="eyebrow">All companies</p><h2>{len(companies)} static company pages</h2></div></div>
        <div class="company-index-grid">{cards}</div>
      </section>
    </main>
  </body>
</html>
"""


def write_sitemap(companies: list[dict]) -> None:
    urls = [
        f"{BASE_URL}/",
        f"{BASE_URL}/companies/",
        f"{BASE_URL}/methodology.html",
        f"{BASE_URL}/support.html",
        *[canonical_url(company) for company in companies],
    ]
    body = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in urls:
        body.append("  <url>")
        body.append(f"    <loc>{esc(url)}</loc>")
        body.append("  </url>")
    body.append("</urlset>")
    (DOCS / "sitemap.xml").write_text("\n".join(body) + "\n")


def remove_orphaned_company_dirs(valid_ids: set[str]) -> None:
    if not COMPANIES_DIR.exists():
        return
    for path in COMPANIES_DIR.iterdir():
        if path.name in {"index.html", ".gitkeep"}:
            continue
        if path.is_dir() and path.name not in valid_ids:
            shutil.rmtree(path)


def main() -> int:
    companies = load_companies()
    ensure_dir(COMPANIES_DIR)
    remove_orphaned_company_dirs({company["id"] for company in companies})

    for company in companies:
        page_dir = COMPANIES_DIR / company["id"]
        ensure_dir(page_dir)
        (page_dir / "index.html").write_text(company_page_html(company, companies))

    (COMPANIES_DIR / "index.html").write_text(company_index_html(companies))
    write_sitemap(companies)
    print(f"Generated {len(companies)} company pages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
