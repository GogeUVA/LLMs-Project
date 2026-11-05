from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING

from .dietary import DietaryError
from .meal_constraints import ConstraintError, evaluate_meal_constraints

if TYPE_CHECKING:
    from .meal_requests import Constraints


@dataclass
class RecommendationValidationResult:
    meal_id: str | None
    errors: list[ConstraintError | DietaryError]

    @property
    def valid(self) -> bool:
        return not self.errors


def _error(code: str, field: str, message: str) -> ConstraintError:
    return ConstraintError(code=code, field=field, message=message)


def _candidate_meal_id(candidate: object) -> str | None:
    if not isinstance(candidate, Mapping):
        return None
    meal_id = candidate.get("meal_id")
    if not isinstance(meal_id, str) or not meal_id.strip():
        return None
    return meal_id.strip()


def _find_meal(
    menu: Iterable[Mapping[str, object]], meal_id: str
) -> Mapping[str, object] | None:
    return next((meal for meal in menu if meal.get("id") == meal_id), None)


def validate_recommendation(
    candidate: object,
    menu: Iterable[Mapping[str, object]],
    constraints: Constraints,
    *,
    service_date: date | None = None,
) -> RecommendationValidationResult:
    """Resolve a generated meal ID and validate the trusted menu record.

    Model-supplied facts other than the meal identifier are intentionally ignored.
    Callers must use the resolved menu record when presenting recommendation details.
    """
    meal_id = _candidate_meal_id(candidate)
    if meal_id is None:
        return RecommendationValidationResult(
            meal_id=None,
            errors=[
                _error(
                    "MALFORMED_RECOMMENDATION",
                    "meal_id",
                    "The recommendation must contain a nonempty meal identifier.",
                )
            ],
        )

    meal = _find_meal(menu, meal_id)
    if meal is None:
        return RecommendationValidationResult(
            meal_id=None,
            errors=[
                _error(
                    "UNKNOWN_MEAL_ID",
                    "meal_id",
                    "The recommended meal does not exist in the supplied menu data.",
                )
            ],
        )

    constraint_result = evaluate_meal_constraints(
        meal, constraints, service_date=service_date
    )
    return RecommendationValidationResult(
        meal_id=meal_id,
        errors=constraint_result.errors,
    )
