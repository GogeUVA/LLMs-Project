"""Evaluate requested hard constraints against a supplied menu record."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from .dietary import DietaryError, check_dietary
from .meal_requests import Constraints
from .menu_evidence import documented_numeric_value

UVA_TIMEZONE = ZoneInfo("America/New_York")


@dataclass(frozen=True)
class ConstraintError:
    code: str
    field: str
    message: str


@dataclass
class ConstraintResult:
    errors: list[ConstraintError | DietaryError]

    @property
    def valid(self) -> bool:
        return not self.errors


def _mapping(value: object) -> Mapping[str, object]:
    return value if isinstance(value, Mapping) else {}


def _price_cents(
    meal: Mapping[str, object], provenance: Mapping[str, object]
) -> int | None:
    price = _mapping(meal.get("price"))
    amount = documented_numeric_value(
        price.get("amount"), _mapping(provenance.get("price"))
    )
    if amount is None or price.get("currency") != "USD":
        return None
    numerator, denominator = Decimal(str(amount)).as_integer_ratio()
    cents, remainder = divmod(numerator * 100, denominator)
    return None if remainder else cents


def _location_label(value: object) -> str:
    return " ".join(value.casefold().split()) if isinstance(value, str) else ""


def _requested_instant(service_date: date, clock: str) -> datetime | None:
    local = datetime.combine(service_date, time.fromisoformat(clock), UVA_TIMEZONE)
    # A gap or repeated wall time has two different UTC offsets.
    if local.utcoffset() != local.replace(fold=1).utcoffset():
        return None
    return local.astimezone(UTC)


def _window_instant(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        instant = datetime.fromisoformat(value)
        return instant.astimezone(UTC) if instant.tzinfo is not None else None
    except (ValueError, OverflowError):
        return None


def _availability_error(windows: object, instant: datetime) -> ConstraintError | None:
    has_invalid_window = False
    if isinstance(windows, list) and windows:
        for window in windows:
            start = _window_instant(_mapping(window).get("start"))
            end = _window_instant(_mapping(window).get("end"))
            if start is None or end is None or end <= start:
                has_invalid_window = True
            elif start <= instant < end:
                return None
        if not has_invalid_window:
            return ConstraintError(
                "AVAILABILITY_MISMATCH",
                "meal_time",
                "The meal is outside its documented service windows at the requested time.",
            )
    return ConstraintError(
        "AVAILABILITY_UNKNOWN",
        "meal_time",
        "The menu does not document usable service hours for this meal.",
    )


def _nutrition_errors(
    meal: Mapping[str, object],
    constraints: Constraints,
    provenance: Mapping[str, object],
) -> list[ConstraintError]:
    targets = constraints.nutrition
    if targets is None:
        return []

    nutrition = _mapping(meal.get("nutrition"))
    errors = []
    for field, target, label, is_minimum in (
        ("protein_g", targets.min_protein_grams, "minimum protein", True),
        ("calories_kcal", targets.max_calories, "maximum calories", False),
    ):
        if target is None:
            continue
        value = documented_numeric_value(
            nutrition.get(field), _mapping(provenance.get(field))
        )
        if value is None:
            errors.append(
                ConstraintError(
                    "NUTRITION_UNKNOWN", field, f"The menu does not document {field}."
                )
            )
        elif (is_minimum and value < target) or (not is_minimum and value > target):
            errors.append(
                ConstraintError(
                    "NUTRITION_TARGET_NOT_MET",
                    field,
                    f"The documented value of {value} does not meet the {label} target of {target}.",
                )
            )
    return errors


def evaluate_meal_constraints(
    meal: Mapping[str, object],
    constraints: Constraints,
    *,
    service_date: date | None = None,
) -> ConstraintResult:
    """Check hard constraints for a record already resolved from the menu."""
    provenance = _mapping(meal.get("provenance"))
    errors: list[ConstraintError | DietaryError] = []
    budget = constraints.max_budget_cents
    if budget is not None:
        cents = _price_cents(meal, provenance)
        if cents is None:
            errors.append(
                ConstraintError(
                    "PRICE_UNKNOWN",
                    "max_budget_cents",
                    "The menu does not document a usable USD price.",
                )
            )
        elif cents > budget:
            errors.append(
                ConstraintError(
                    "BUDGET_EXCEEDED",
                    "max_budget_cents",
                    f"The documented price of {cents} cents exceeds the {budget}-cent budget.",
                )
            )

    if constraints.location is not None:
        location = _location_label(meal.get("location"))
        if not location:
            errors.append(
                ConstraintError(
                    "LOCATION_UNKNOWN",
                    "location",
                    "The menu does not list a location for this meal.",
                )
            )
        elif location != _location_label(constraints.location):
            errors.append(
                ConstraintError(
                    "LOCATION_NOT_ALLOWED",
                    "location",
                    "The menu lists this meal at a different location.",
                )
            )

    if constraints.meal_time is not None:
        instant = (
            None
            if service_date is None
            else _requested_instant(service_date, constraints.meal_time)
        )
        if instant is None:
            errors.append(
                ConstraintError(
                    "MEAL_TIME_UNKNOWN",
                    "meal_time",
                    "The request needs a service date and an unambiguous Charlottesville local time.",
                )
            )
        else:
            source = _mapping(provenance.get("availability"))
            windows = (
                meal.get("availability") if source.get("kind") == "documented" else None
            )
            error = _availability_error(windows, instant)
            if error is not None:
                errors.append(error)

    errors.extend(check_dietary(constraints.dietary, meal).errors)
    errors.extend(_nutrition_errors(meal, constraints, provenance))
    return ConstraintResult(errors)
