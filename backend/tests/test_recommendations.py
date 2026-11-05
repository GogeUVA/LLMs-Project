import json
import unittest
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app import meal_requests
from app.main import app

REQUEST = "Find a meal at Fixture Dining with at least 30 g of protein."
MEAL = {
    "id": "fixture-chicken",
    "name": "Fixture Chicken",
    "location": "Fixture Dining",
    "nutrition": {"protein_g": 47},
    "provenance": {"protein_g": {"kind": "documented"}},
}
LOW_PROTEIN_MEAL = {
    **MEAL,
    "id": "fixture-soup",
    "name": "Fixture Soup",
    "nutrition": {"protein_g": 12},
}


class RecommendationTests(unittest.TestCase):
    def setUp(self):
        self.interpret = AsyncMock(
            return_value={
                "goal": "high protein",
                "location": "Fixture Dining",
                "nutrition": {"min_protein_grams": 30},
            }
        )
        self.recommend = AsyncMock(return_value={"meal_id": MEAL["id"]})
        app.dependency_overrides[meal_requests.get_interpreter] = lambda: self.interpret
        self.addCleanup(app.dependency_overrides.pop, meal_requests.get_interpreter)
        for name, dependency in (
            ("get_recommender", lambda: self.recommend),
            ("get_menu", lambda: [MEAL, LOW_PROTEIN_MEAL]),
        ):
            getter = getattr(meal_requests, name, None)
            if getter is not None:
                app.dependency_overrides[getter] = dependency
                self.addCleanup(app.dependency_overrides.pop, getter)

    def submit(self, *, stream=False):
        headers = {"Accept": "application/x-ndjson"} if stream else {}
        with TestClient(app) as client:
            response = client.post(
                "/api/requests/interpret",
                json={"text": REQUEST, "recommend": True},
                headers=headers,
            )
        self.assertEqual(response.status_code, 200)
        return response

    def test_issue4_streams_a_validated_meal_and_explanation_from_menu_evidence(self):
        events = [
            json.loads(line) for line in self.submit(stream=True).text.splitlines()
        ]
        self.assertEqual(events[0]["type"], "progress")
        result = events[-1]["reply"]
        self.assertEqual(result["status"], "recommended")
        self.assertEqual(result["meal"], MEAL)
        self.assertIn("47 g", result["explanation"])
        self.assertIn("30 g", result["explanation"])
        self.recommend.assert_awaited_once()
        context = self.recommend.await_args.kwargs
        self.assertEqual(context["request_text"], REQUEST)
        self.assertEqual(context["constraints"].nutrition.min_protein_grams, 30)
        self.assertEqual([item["id"] for item in context["menu"]], [MEAL["id"]])

    def test_issue4_unknown_or_ineligible_meal_ids_cannot_reach_the_user(self):
        for meal_id in ("invented-meal", LOW_PROTEIN_MEAL["id"]):
            with self.subTest(meal_id=meal_id):
                self.recommend.return_value = {"meal_id": meal_id}
                result = self.submit().json()
                self.assertEqual(result["status"], "recommendation_failed")
                self.assertEqual(result["reason"], "invalid_recommendation")
                self.assertNotIn("meal", result)

    def test_issue4_malformed_model_output_is_withheld(self):
        for output in (
            "invalid JSON",
            {"meal_id": 42},
            {"meal_id": MEAL["id"], "protein_g": 99},
        ):
            with self.subTest(output=output):
                self.recommend.return_value = output
                result = self.submit().json()
                self.assertEqual(result["status"], "recommendation_failed")
                self.assertNotIn("meal", result)
                self.assertNotIn("explanation", result)

    def test_issue4_unverifiable_budget_returns_no_match_without_calling_model(self):
        self.interpret.return_value["max_budget_cents"] = 1000
        result = self.submit().json()
        self.assertEqual(result["status"], "recommendation_failed")
        self.assertEqual(result["reason"], "no_match")
        self.assertNotIn("meal", result)
        self.recommend.assert_not_awaited()

    def test_issue4_waits_for_clarification_before_recommending(self):
        self.interpret.return_value["clarifications"] = [
            {"field": "location", "question": "Which dining spot?"}
        ]
        result = self.submit().json()
        self.assertEqual(result["status"], "needs_clarification")
        self.recommend.assert_not_awaited()
