SHELL := /bin/bash

.PHONY: serve validate check

serve:
	python3 -m http.server 8000 -d docs

validate:
	python3 scripts/validate_data.py

check: validate
