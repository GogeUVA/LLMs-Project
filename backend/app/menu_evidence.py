"""Provenance for menu records and evidence for hard numeric checks."""

import json
from collections.abc import Mapping
from math import isfinite
from pathlib import Path


def documented_numeric_value(
    value: object, provenance: Mapping[str, object] | None
) -> int | float | None:
    """Return a numeric value only when the menu data documents it."""
    if provenance is None or provenance.get("kind") != "documented":
        return None
    if type(value) is int and value >= 0:
        return value
    if isinstance(value, float) and isfinite(value) and value >= 0:
        return value
    return None


def load_documented_menu(path: Path) -> list[dict]:
    """Attach the chart's provenance to fields it actually documents."""
    dataset = json.loads(path.read_text(encoding="utf-8"))
    source = {
        "kind": "documented",
        "source_name": dataset["source_document"],
        "source_url": dataset["source_url"],
    }
    if dataset.get("source_updated"):
        source["source_updated"] = dataset["source_updated"]

    meals = []
    for item in dataset["items"]:
        provenance = {}
        item_source = {**source}
        page = item.get("source_page", dataset.get("source_page"))
        if page is not None:
            item_source["source_page"] = page
        if item.get("serving_size"):
            provenance["serving_size"] = item_source
        for field, value in (item.get("nutrition") or {}).items():
            if documented_numeric_value(value, item_source) is not None:
                provenance[field] = item_source
        meals.append({**item, "provenance": provenance})
    return meals
