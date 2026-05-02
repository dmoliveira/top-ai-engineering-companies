SHELL := /bin/bash

.PHONY: serve validate build-pages check

serve:
	python3 -m http.server 8000 -d docs

validate:
	python3 scripts/validate_data.py

build-pages:
	python3 scripts/build_company_pages.py

check: validate build-pages
