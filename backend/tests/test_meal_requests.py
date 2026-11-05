import importlib
import unittest
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.main import app


class MealRequestTests(unittest.TestCase):
    def setUp(self):
        self.requests = importlib.import_module("app.meal_requests")
        self.interpret = AsyncMock(
            return_value={
                "goal": "high protein",
                "max_budget_cents": 1000,
                "location": "Newcomb Hall",
                "meal_time": "12:30",
                "nutrition": {"min_protein_grams": 25},
                "dietary": {"restrictions": ["vegetarian"]},
                "clarifications": [],
                "unsupported_details": [],
            }
        )
        app.dependency_overrides[self.requests.get_interpreter] = lambda: self.interpret
        self.addCleanup(app.dependency_overrides.pop, self.requests.get_interpreter)

    def submit(self, text, **fields):
        with TestClient(app) as client:
            return client.post("/api/requests/interpret", json={"text": text, **fields})

    def test_issue2_supplies_supported_constraints_and_preserves_original_text(self):
        original = "  Vegetarian lunch at Newcomb at 12:30, $10 max, 25g protein.  "
        response = self.submit(original)
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["original_text"], original)
        self.assertEqual(result["status"], "ready")
        constraints = result["constraints"]
        for key, expected in {
            "goal": "high protein",
            "max_budget_cents": 1000,
            "location": "Newcomb Hall",
            "meal_time": "12:30",
            "nutrition": {"min_protein_grams": 25},
        }.items():
            self.assertEqual(constraints[key], expected)
        self.assertIn("vegetarian", constraints["dietary"]["restrictions"])
        self.interpret.assert_awaited_once()

    def test_issue2_preserves_profile_requirements_and_preferences(self):
        response = self.submit(
            "Vegetarian lunch",
            dietary={"allergies": ["peanut"], "preferences": ["mild"]},
        )
        self.assertEqual(response.status_code, 200)
        dietary = response.json()["constraints"]["dietary"]
        self.assertEqual(dietary["allergies"], ["peanut"])
        self.assertEqual(dietary["preferences"], ["mild"])
        self.assertEqual(dietary["restrictions"], ["vegetarian"])

    def test_issue2_blank_and_whitespace_requests_never_call_interpreter(self):
        for value in ("", " \t\n "):
            with self.subTest(value=value):
                self.assertEqual(self.submit(value).status_code, 422)
        self.interpret.assert_not_awaited()

    def test_issue2_ambiguous_location_requires_clarification(self):
        self.interpret.return_value = {
            "location": None,
            "clarifications": [
                {"field": "location", "question": "Which dining location do you mean?"}
            ],
        }
        response = self.submit("Lunch near the library")
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["status"], "needs_clarification")
        self.assertEqual(result["clarifications"][0]["field"], "location")
        self.assertIsNone(result["constraints"].get("location"))

    def test_issue2_conflicting_budget_does_not_choose_a_limit(self):
        self.interpret.return_value = {
            "max_budget_cents": None,
            "clarifications": [
                {"field": "max_budget_cents", "question": "Is your limit $8 or $12?"}
            ],
        }
        response = self.submit("My maximum is $8, and my maximum is $12.")
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["status"], "needs_clarification")
        self.assertIsNone(result["constraints"].get("max_budget_cents"))

    def test_issue2_unsupported_details_are_returned_separately(self):
        self.interpret.return_value = {
            "goal": "lunch",
            "unsupported_details": ["Wait time under five minutes"],
        }
        response = self.submit("Lunch with a wait under five minutes")
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(
            result["unsupported_details"], ["Wait time under five minutes"]
        )
        self.assertNotIn("wait_time", result["constraints"])

    def test_issue2_malformed_interpretation_returns_a_safe_error(self):
        self.interpret.return_value = {"max_budget_cents": "definitely free"}
        response = self.submit("Lunch for less than $10")
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("definitely free", response.text)

    def test_issue2_passes_clarifying_question_and_answer_separately(self):
        original = "Vegetarian lunch at Newcomb Hall at noon, under $10."
        question = "Should this be vegetarian or include chicken?"
        history = [{"text": original, "questions": [question]}]
        self.interpret.return_value = {
            "goal": "chicken salad",
            "location": "Newcomb Hall",
            "max_budget_cents": 1000,
            "meal_time": "12:00",
        }
        response = self.submit(
            "Chicken", history=history, dietary={"allergies": ["peanut"]}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["original_text"], original)
        self.assertEqual(
            response.json()["constraints"]["dietary"]["allergies"], ["peanut"]
        )
        self.assertEqual(self.interpret.await_args.args[0], "Chicken")
        self.assertEqual(self.interpret.await_args.kwargs["history"], history)

    def test_issue2_stream_announces_progress_and_delivers_structured_reply(self):
        import json

        with TestClient(app) as client:
            response = client.post(
                "/api/requests/interpret",
                json={"text": "Lunch under $10"},
                headers={"Accept": "application/x-ndjson"},
            )
        self.assertEqual(response.headers["content-type"], "application/x-ndjson")
        events = [json.loads(line) for line in response.text.splitlines()]
        self.assertEqual([event["type"] for event in events], ["progress", "reply"])
        self.assertEqual(events[-1]["reply"]["constraints"]["max_budget_cents"], 1000)
