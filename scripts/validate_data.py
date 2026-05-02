#!/usr/bin/env python3
"""Simple validation for companies.json and taxonomy.json."""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
COMPANIES_PATH = ROOT / "docs" / "data" / "companies.json"
TAXONOMY_PATH = ROOT / "docs" / "data" / "taxonomy.json"
HTTPS_RE = re.compile(r"^https://")
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HTML_RE = re.compile(r"[<>]")
SLUG_RE = re.compile(r"^[a-z0-9-]+$")
REQUIRED_FIELDS = {
    "id",
    "name",
    "business_type",
    "sub_type",
    "country",
    "hq_city",
    "founded_year",
    "ceo",
    "employee_count_bucket",
    "website_url",
    "tags",
    "description_short",
    "source_urls",
    "last_verified_at",
}


def load_json(path: Path):
    return json.loads(path.read_text())


def main() -> int:
    companies = load_json(COMPANIES_PATH)
    taxonomy = load_json(TAXONOMY_PATH)
    errors: list[str] = []

    for item in taxonomy["business_types"]:
        if HTML_RE.search(item["label"]):
            errors.append(f"taxonomy label cannot contain angle brackets: {item['label']}")
        for subtype in item["sub_types"]:
            if HTML_RE.search(subtype):
                errors.append(f"taxonomy sub_type cannot contain angle brackets: {subtype}")

    allowed_types = {item["label"]: set(item["sub_types"]) for item in taxonomy["business_types"]}
    seen_ids: set[str] = set()

    for index, company in enumerate(companies, start=1):
        missing = REQUIRED_FIELDS - company.keys()
        if missing:
            errors.append(f"company #{index} missing fields: {sorted(missing)}")

        company_id = company.get("id")
        if company_id in seen_ids:
            errors.append(f"duplicate id: {company_id}")
        else:
            seen_ids.add(company_id)
        if not isinstance(company_id, str) or not SLUG_RE.match(company_id):
            errors.append(f"invalid id slug: {company_id}")

        business_type = company.get("business_type")
        if business_type not in allowed_types:
            errors.append(f"{company_id}: invalid business_type '{business_type}'")

        sub_types = company.get("sub_type")
        if not isinstance(sub_types, list) or len(sub_types) != 1 or not all(isinstance(item, str) for item in sub_types):
            errors.append(f"{company_id}: sub_type must be a single-item string array")
            sub_types = []

        tags = company.get("tags")
        if not isinstance(tags, list) or not tags or not all(isinstance(item, str) for item in tags):
            errors.append(f"{company_id}: tags must be a non-empty string array")

        source_urls = company.get("source_urls")
        if not isinstance(source_urls, list) or not source_urls or not all(isinstance(item, str) for item in source_urls):
            errors.append(f"{company_id}: source_urls must be a non-empty string array")
            source_urls = []

        if not isinstance(company.get("description_short"), str) or not company.get("description_short").strip():
            errors.append(f"{company_id}: description_short must be a non-empty string")
        elif HTML_RE.search(company.get("description_short")):
            errors.append(f"{company_id}: description_short cannot contain angle brackets")

        last_verified_at = company.get("last_verified_at")
        if not isinstance(last_verified_at, str) or not ISO_DATE_RE.match(last_verified_at):
            errors.append(f"{company_id}: last_verified_at must use YYYY-MM-DD")

        for subtype in sub_types:
            if business_type in allowed_types and subtype not in allowed_types[business_type]:
                errors.append(f"{company_id}: invalid sub_type '{subtype}' for '{business_type}'")

        founded_year = company.get("founded_year")
        if not isinstance(founded_year, int) or founded_year < 1900 or founded_year > 2026:
            errors.append(f"{company_id}: invalid founded_year '{founded_year}'")

        if not isinstance(company.get("ceo"), str) or not company.get("ceo").strip():
            errors.append(f"{company_id}: ceo must be a non-empty string")
        elif HTML_RE.search(company.get("ceo")):
            errors.append(f"{company_id}: ceo cannot contain angle brackets")

        if not isinstance(company.get("hq_city"), str) or not company.get("hq_city").strip():
            errors.append(f"{company_id}: hq_city must be a non-empty string")
        elif HTML_RE.search(company.get("hq_city")):
            errors.append(f"{company_id}: hq_city cannot contain angle brackets")

        if not isinstance(company.get("name"), str) or not company.get("name").strip():
            errors.append(f"{company_id}: name must be a non-empty string")
        elif HTML_RE.search(company.get("name")):
            errors.append(f"{company_id}: name cannot contain angle brackets")

        for field in ["website_url", "engineering_blog_url", "ai_blog_url", "careers_url"]:
            value = company.get(field)
            if value is not None and not isinstance(value, str):
                errors.append(f"{company_id}: {field} must be a string or null")
            if isinstance(value, str) and value and not HTTPS_RE.match(value):
                errors.append(f"{company_id}: {field} must use https")

        for source_url in source_urls:
            if not HTTPS_RE.match(source_url):
                errors.append(f"{company_id}: source_url must use https -> {source_url}")

    if errors:
        print("Validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validation OK: {len(companies)} companies checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
