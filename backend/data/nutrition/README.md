# Nutrition data

Each location has a JSON file containing a source record and its menu items.

## Record format

- Dataset metadata: `location`, `location_page_url`, `source_url`,
  `source_document`, `source_updated`, and `review_status`.
- `items`: records with a stable `id`, source item `name`, `location`,
  `serving_size`, `nutrition`, and `source_page`.
- `serving_size`: `amount` and `unit`, plus `weight_grams` when the source gives
  a gram weight.
- Nutrition keys include the unit in the name, such as `calories_kcal`,
  `total_fat_g`, or `sodium_mg`. Values are numeric and retain the source's
  reported precision.
- Omit unavailable values rather than representing them as zero. A reported
  numeric zero is retained as zero.
- Give different serving sizes or source-defined variants different IDs. Do not
  combine distinct source records or infer nutrition for an unlisted variant.

Set `review_status` to `needs_human_review` before verification and to `reviewed`
after a teammate compares the records with the linked source. Record that review
in `review_note` and in the issue or pull request. Source URLs and update dates
describe provenance; they do not guarantee current availability or that a
restaurant has not changed its recipe.

The initial Halal Shack file contains the ten prepared Signature Menu items
reported on page 2 of the linked nutrition chart. Build-your-own ingredients
and the protein cup's variable nutrition range are excluded from this first
slice because they are not single prepared-item nutrition records.
