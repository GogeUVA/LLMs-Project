"""Interpret meal requests and route ready requests to recommendations."""

import json
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import aclosing
from functools import partial
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from .dietary import DietaryRequirements
from .groq_interpreter import (
    InterpreterTimeout,
    InterpreterUnavailable,
    InvalidInterpretation,
    interpret_with_groq,
)
from .recommendations import (
    Recommendation,
    RecommendationFailure,
    Recommender,
    get_recommender,
    load_menu,
    recommend_meal,
)

router = APIRouter(prefix="/api/requests")
Interpreter = Callable[..., Awaitable[object]]


class PriorTurn(BaseModel):
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    questions: list[Annotated[str, Field(min_length=1, max_length=240)]] = Field(
        default_factory=list, max_length=6
    )


class MealRequest(BaseModel):
    text: Annotated[str, Field(max_length=2000)]
    dietary: DietaryRequirements = Field(default_factory=DietaryRequirements)
    recommend: bool = False
    excluded_meal_ids: list[Annotated[str, Field(min_length=1, max_length=200)]] = (
        Field(default_factory=list, max_length=20)
    )

    history: list[PriorTurn] = Field(default_factory=list, max_length=20)

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


MealReply = ReviewedRequest | Recommendation | RecommendationFailure


def get_menu(request: MealRequest) -> list[dict] | None:
    if not request.recommend:
        return []
    try:
        return load_menu()
    except (OSError, ValueError, KeyError, TypeError):
        return None


def get_interpreter() -> Interpreter:
    return partial(interpret_with_groq, schema=Interpretation.model_json_schema())


async def review_request(
    request: MealRequest, interpreter: Interpreter
) -> ReviewedRequest:
    try:
        if request.history:
            raw = await interpreter(
                request.text,
                request.dietary,
                history=[turn.model_dump() for turn in request.history],
            )
        else:
            raw = await interpreter(request.text, request.dietary)
        result = (
            Interpretation.model_validate_json(raw)
            if isinstance(raw, str)
            else Interpretation.model_validate(raw)
        )
    except InterpreterTimeout:
        raise HTTPException(504, "Meal request review timed out.") from None
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
        original_text=request.history[0].text if request.history else request.text,
        constraints=Constraints.model_validate(constraints),
        clarifications=result.clarifications,
        unsupported_details=result.unsupported_details,
    )


async def reply_to_request(
    request: MealRequest,
    interpreter: Interpreter,
    recommender: Recommender,
    menu: list[dict] | None,
) -> AsyncIterator[MealReply | Literal["correcting"]]:
    review = await review_request(request, interpreter)
    if not request.recommend or review.status != "ready":
        yield review
        return
    if menu is None:
        yield RecommendationFailure(reason="model_unavailable")
        return
    async with aclosing(
        recommend_meal(
            request_text=request.text,
            original_request_text=review.original_text,
            constraints=review.constraints,
            menu=menu,
            recommender=recommender,
            unsupported_details=review.unsupported_details,
            excluded_meal_ids=request.excluded_meal_ids,
        )
    ) as events:
        async for event in events:
            yield event


async def stream_review(
    request: MealRequest,
    interpreter: Interpreter,
    recommender: Recommender,
    menu: list[dict] | None,
) -> AsyncIterator[str]:
    yield json.dumps({"type": "progress"}) + "\n"
    try:
        async with aclosing(
            reply_to_request(request, interpreter, recommender, menu)
        ) as events:
            async for event in events:
                if event == "correcting":
                    payload = {"type": "progress", "stage": "correcting"}
                else:
                    payload = {
                        "type": "reply",
                        "reply": event.model_dump(exclude_none=True),
                    }
                yield json.dumps(payload) + "\n"
    except HTTPException as exc:
        yield json.dumps({"type": "error", "status": exc.status_code}) + "\n"


@router.post("/interpret", response_model=MealReply, response_model_exclude_none=True)
async def interpret_request(
    request: MealRequest,
    http_request: Request,
    interpreter: Annotated[Interpreter, Depends(get_interpreter)],
    recommender: Annotated[Recommender, Depends(get_recommender)],
    menu: Annotated[list[dict] | None, Depends(get_menu)],
) -> MealReply | StreamingResponse:
    if http_request.headers.get("accept") == "application/x-ndjson":
        return StreamingResponse(
            stream_review(request, interpreter, recommender, menu),
            media_type="application/x-ndjson",
            headers={"Cache-Control": "no-store"},
        )
    async with aclosing(
        reply_to_request(request, interpreter, recommender, menu)
    ) as events:
        async for event in events:
            if event != "correcting":
                return event
    raise HTTPException(502, "Couldn’t finish the meal request.")
