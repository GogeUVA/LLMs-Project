"""Dietary requirements and deterministic checks against supplied menu evidence."""

from collections.abc import Mapping
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

DietaryText = Annotated[
    str, StringConstraints(strict=True, strip_whitespace=True, min_length=1)
]


class DietaryRequirements(BaseModel):
    """Keep user intent separate from menu facts and generated candidates."""

    model_config = ConfigDict(extra="forbid", validate_assignment=True)
    allergies: list[DietaryText] = Field(default_factory=list)
    restrictions: list[DietaryText] = Field(default_factory=list)
    preferences: list[DietaryText] = Field(default_factory=list)
    dislikes: list[DietaryText] = Field(default_factory=list)


class DietaryEvidence(BaseModel):
    """None is unknown; an empty allergen list means explicitly recorded none.

    Ingestion must not convert absent/incomplete lists to empty lists. Dietary
    labels must be documented classifications, not model-generated guesses.
    """

    model_config = ConfigDict(strict=True)
    ingredients: list[DietaryText] | None = None
    allergens: list[DietaryText] | None = None
    dietary: dict[str, bool | None] = Field(default_factory=dict)


class DietaryError(BaseModel):
    code: Literal["ALLERGEN_CONFLICT", "DIETARY_CONFLICT", "RESTRICTION_DATA_UNKNOWN"]
    field: Literal["ingredients", "allergens", "dietary"]
    message: str


class DietaryResult(BaseModel):
    status: Literal["compatible", "conflict", "unknown", "not_applicable"]
    errors: list[DietaryError] = Field(default_factory=list)


def _normalize(value: str) -> str:
    return " ".join(value.casefold().split())


# Canonical labels shared with the request editor. Menu imports must supply
# complete allergen evidence before a missing label can count as absent.
_SUPPORTED_ALLERGENS = frozenset(
    {
        "peanut",
        "tree nuts",
        "milk",
        "egg",
        "wheat",
        "soy",
        "fish",
        "shellfish",
        "sesame",
    }
)
_ALLERGEN_ALIASES = {"peanuts": "peanut", "eggs": "egg", "tree nut": "tree nuts"}


def _allergen_label(value: str) -> str:
    label = _normalize(value)
    return _ALLERGEN_ALIASES.get(label, label)


def check_dietary(
    requirements: DietaryRequirements,
    evidence: Mapping[str, object] | DietaryEvidence,
) -> DietaryResult:
    """Check supplied evidence without mutating user requirements.

    Compatibility is limited to supported checks, not food-safety certification.
    Unsupported restriction labels remain unknown; no taxonomy is inferred.
    """
    if not requirements.allergies and not requirements.restrictions:
        return DietaryResult(status="not_applicable")

    raw = evidence.model_dump() if isinstance(evidence, DietaryEvidence) else evidence
    parsed = {}
    # An invalid field must not hide a conflict recorded in another field.
    for field in ("ingredients", "allergens", "dietary"):
        try:
            item = DietaryEvidence.model_validate({field: raw.get(field)})
            parsed[field] = getattr(item, field)
        except ValidationError:
            parsed[field] = {} if field == "dietary" else None
    menu = DietaryEvidence(**parsed)
    errors: list[DietaryError] = []

    def unknown(field: Literal["ingredients", "allergens", "dietary"], text: str):
        errors.append(
            DietaryError(code="RESTRICTION_DATA_UNKNOWN", field=field, message=text)
        )

    if not menu.ingredients:
        unknown("ingredients", "Ingredients are unknown; compatibility is unconfirmed.")

    allergens = {_allergen_label(item) for item in menu.allergens or []}
    ingredients = {_allergen_label(item) for item in menu.ingredients or []}
    for allergy in requirements.allergies:
        label = _allergen_label(allergy)
        if label in allergens | ingredients:
            errors.append(
                DietaryError(
                    code="ALLERGEN_CONFLICT",
                    field="allergens",
                    message=f"Menu evidence lists {allergy}, a stated allergy.",
                )
            )
        elif menu.allergens is None or label not in _SUPPORTED_ALLERGENS:
            unknown("allergens", f"Allergen information for {allergy} is unknown.")

    for restriction in requirements.restrictions:
        values = [
            value
            for label, value in menu.dietary.items()
            if _normalize(label) == _normalize(restriction)
        ]
        if False in values:
            errors.append(
                DietaryError(
                    code="DIETARY_CONFLICT",
                    field="dietary",
                    message=f"Menu evidence conflicts with the {restriction} restriction.",
                )
            )
        elif not values or any(value is None for value in values):
            unknown("dietary", f"Compatibility with {restriction} is unknown.")

    if any(error.code != "RESTRICTION_DATA_UNKNOWN" for error in errors):
        return DietaryResult(status="conflict", errors=errors)
    if errors:
        return DietaryResult(status="unknown", errors=errors)
    return DietaryResult(status="compatible")
