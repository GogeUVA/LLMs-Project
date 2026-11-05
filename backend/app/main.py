"""Minimal application entry point for setup issue #14."""

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from .meal_requests import router as meal_requests_router

app = FastAPI(title="Hoos Eating API", version="0.1.0")
app.include_router(meal_requests_router)


class HealthResponse(BaseModel):
    status: Literal["ok"]


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")
