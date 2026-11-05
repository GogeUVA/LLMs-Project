"""Interpret meal requests without generating or validating recommendations."""

from collections.abc import Awaitable, Callable
from functools import partial
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from .dietary import DietaryRequirements
from .groq_interpreter import (
    InterpreterUnavailable,
    InvalidInterpretation,
    interpret_with_groq,
)

router = APIRouter(prefix="/api/requests")
Interpreter = Callable[[str, DietaryRequirements], Awaitable[object]]


class MealRequest(BaseModel):
    text: Annotated[str, Field(max_length=2000)]
    dietary: DietaryRequirements = Field(default_factory=DietaryRequirements)

    @field_validator("text")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Describe the meal you want.")
        return value


class StrictModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class NutritionTargets(StrictModel):
    min_protein_grams: Annotated[float, Field(gt=0, allow_inf_nan=False)] | None = None
    max_calories: Annotated[int, Field(gt=0)] | None = None


class Constraints(StrictModel):
    goal: Annotated[str, Field(min_length=1, max_length=160)] | None = None
    max_budget_cents: Annotated[int, Field(ge=0)] | None = None
    location: Annotated[str, Field(min_length=1, max_length=160)] | None = None
    meal_time: (
        Annotated[str, Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")] | None
    ) = None
    nutrition: NutritionTargets | None = None
    dietary: DietaryRequirements = Field(default_factory=DietaryRequirements)


class Clarification(StrictModel):
    field: Literal[
        "goal", "max_budget_cents", "location", "meal_time", "nutrition", "dietary"
    ]
    question: Annotated[str, Field(min_length=1, max_length=240)]


class Interpretation(Constraints):
    clarifications: list[Clarification] = Field(default_factory=list)
    unsupported_details: list[str] = Field(default_factory=list)


class ReviewedRequest(StrictModel):
    status: Literal["ready", "needs_clarification"]
    original_text: str
    constraints: Constraints
    clarifications: list[Clarification]
    unsupported_details: list[str]


def get_interpreter() -> Interpreter:
    return partial(interpret_with_groq, schema=Interpretation.model_json_schema())


@router.post("/interpret", response_model_exclude_none=True)
async def interpret_request(
    request: MealRequest, interpreter: Annotated[Interpreter, Depends(get_interpreter)]
) -> ReviewedRequest:
    try:
        raw = await interpreter(request.text, request.dietary)
        result = (
            Interpretation.model_validate_json(raw)
            if isinstance(raw, str)
            else Interpretation.model_validate(raw)
        )
    except InterpreterUnavailable:
        raise HTTPException(
            503, "Meal request review is temporarily unavailable."
        ) from None
    except (InvalidInterpretation, ValidationError):
        raise HTTPException(
            502, "Couldn’t review that request. Please try again."
        ) from None

    constraints = result.model_dump(exclude={"clarifications", "unsupported_details"})
    for clarification in result.clarifications:
        if clarification.field != "dietary":
            constraints[clarification.field] = None
    saved = request.dietary.model_dump()
    extracted = (
        result.dietary.model_dump()
        if not any(item.field == "dietary" for item in result.clarifications)
        else {}
    )
    constraints["dietary"] = {
        field: list(dict.fromkeys(saved[field] + extracted.get(field, [])))
        for field in saved
    }
    return ReviewedRequest(
        status="needs_clarification" if result.clarifications else "ready",
        original_text=request.text,
        constraints=Constraints.model_validate(constraints),
        clarifications=result.clarifications,
        unsupported_details=result.unsupported_details,
    )
