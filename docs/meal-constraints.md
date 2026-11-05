# Meal constraint policy

The deterministic meal constraint checker takes a trusted menu record and a
structured request. Its caller resolves the candidate against the supplied menu
before evaluating it. The checker returns field-specific errors for every
requested hard constraint the record fails or cannot verify.

- **Budget** compares a documented USD price in exact cents with the user's
  maximum. A price equal to the maximum passes. Missing prices, estimated
  prices, other currencies, and fractional cents leave the budget unverified.
- **Location** compares the menu location with the requested location
  after ignoring case and extra whitespace. Use the location label from the
  menu when resolving requests.
- **Time** interprets the requested clock time and explicit service date in
  `America/New_York`. A time during a daylight saving gap or repeated hour
  requires clarification. Documented service windows use ISO 8601 timestamps
  with UTC offsets, include their start, and exclude their end. Compare them as
  instants so a window can span midnight. Missing, estimated, or unusable
  windows leave availability unverified.
- **Dietary needs** use the dietary evidence checker to reject conflicts and
  unverified hard requirements.
- **Nutrition** applies explicit numeric targets to documented values for the
  recorded serving. Equal values meet minimum and maximum targets. Descriptive
  goals such as “high protein” carry no numeric threshold.

The current Halal Shack nutrition dataset supplies nutrient values and a
location. Requests that also require a documented price or service window need
additional menu evidence.
