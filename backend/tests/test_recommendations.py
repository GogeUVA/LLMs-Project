import json
import unittest
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app import meal_requests
from app.groq_interpreter import InterpreterTimeout
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
ALTERNATIVE_MEAL = {
    **MEAL,
    "id": "fixture-tofu",
    "name": "Fixture Tofu",
    "nutrition": {"protein_g": 35},
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

    def submit(self, *, stream=False, **fields):
        headers = {"Accept": "application/x-ndjson"} if stream else {}
        with TestClient(app) as client:
            response = client.post(
                "/api/requests/interpret",
                json={"text": REQUEST, "recommend": True, **fields},
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
                self.assertEqual(result["reason"], "correction_exhausted")
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

    def test_issue12_revalidates_each_attempt_and_preserves_context(self):
        original = "Find a high-protein lunch at Fixture Dining."
        self.recommend.side_effect = [
            {"meal_id": "invented-meal"},
            {"meal_id": LOW_PROTEIN_MEAL["id"]},
            {"meal_id": MEAL["id"]},
        ]
        response = self.submit(stream=True, history=[{"text": original}])
        events = [json.loads(line) for line in response.text.splitlines()]
        self.assertEqual(
            [(event["type"], event.get("stage")) for event in events],
            [
                ("progress", None),
                ("progress", "correcting"),
                ("progress", "correcting"),
                ("reply", None),
            ],
        )
        self.assertEqual(events[-1]["reply"]["meal"], MEAL)
        self.assertNotIn("invented-meal", response.text)
        self.assertNotIn(LOW_PROTEIN_MEAL["id"], response.text)
        self.assertEqual(self.recommend.await_count, 3)
        initial, first, second = [
            call.kwargs for call in self.recommend.await_args_list
        ]
        for correction, code in (
            (first, "MEAL_ID_UNKNOWN"),
            (second, "NUTRITION_TARGET_NOT_MET"),
        ):
            self.assertEqual(correction["original_request_text"], original)
            for key in ("request_text", "constraints", "menu"):
                self.assertEqual(correction[key], initial[key])
            self.assertEqual(correction["constraints"].nutrition.min_protein_grams, 30)
            error = correction["validation_errors"][0]
            self.assertEqual(error["code"], code)
            self.assertTrue(error["field"])
            self.assertTrue(error["message"])

    def test_issue12_caps_malformed_output_at_two_corrections(self):
        self.recommend.return_value = "PRIVATE INVALID MODEL TEXT"
        response = self.submit()
        self.assertEqual(self.recommend.await_count, 3)
        self.assertEqual(
            response.json(),
            {"status": "recommendation_failed", "reason": "correction_exhausted"},
        )
        for call in self.recommend.await_args_list[1:]:
            self.assertEqual(
                call.kwargs["validation_errors"][0]["code"], "INVALID_CANDIDATE_OUTPUT"
            )
            self.assertNotIn("PRIVATE INVALID MODEL TEXT", str(call.kwargs))
        self.assertNotIn("PRIVATE INVALID MODEL TEXT", response.text)

    def test_issue12_timeout_during_correction_stops_and_uses_timeout_recovery(self):
        self.recommend.side_effect = [
            {"meal_id": "invented-meal"},
            InterpreterTimeout("internal timeout"),
        ]
        response = self.submit()
        self.assertEqual(response.json().get("reason"), "timeout")
        self.assertEqual(self.recommend.await_count, 2)
        self.assertNotIn("internal timeout", response.text)

    def test_issue8_alternative_excludes_the_rejected_meal(self):
        app.dependency_overrides[meal_requests.get_menu] = lambda: [
            MEAL,
            ALTERNATIVE_MEAL,
        ]
        self.recommend.return_value = {"meal_id": ALTERNATIVE_MEAL["id"]}

        result = self.submit(excluded_meal_ids=[MEAL["id"]]).json()

        self.assertEqual(result["meal"], ALTERNATIVE_MEAL)
        supplied_ids = [item["id"] for item in self.recommend.await_args.kwargs["menu"]]
        self.assertEqual(supplied_ids, [ALTERNATIVE_MEAL["id"]])

    def test_issue8_reports_when_no_eligible_alternative_remains(self):
        result = self.submit(excluded_meal_ids=[MEAL["id"]]).json()

        self.assertEqual(
            result,
            {"status": "recommendation_failed", "reason": "no_alternative"},
        )
        self.recommend.assert_not_awaited()

    def test_issue8_repeated_rejected_meal_cannot_reach_the_user(self):
        app.dependency_overrides[meal_requests.get_menu] = lambda: [
            MEAL,
            ALTERNATIVE_MEAL,
        ]
        self.recommend.return_value = {"meal_id": MEAL["id"]}

        result = self.submit(excluded_meal_ids=[MEAL["id"]]).json()

        self.assertEqual(result["status"], "recommendation_failed")
        self.assertEqual(result["reason"], "correction_exhausted")
        self.assertNotIn("meal", result)
