"""AI-generated tests for #28 [BUG-01]; no human refinement recorded."""

import importlib
import unittest
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app import meal_requests
from app.main import app
from app.meal_constraints import evaluate_meal_constraints
from app.meal_requests import Constraints

MEAL = {
    "id": "fixture-chicken",
    "name": "Fixture Chicken",
    "location": "The Fixture Dining Hall",
    "nutrition": {"protein_g": 47},
    "provenance": {"protein_g": {"kind": "documented"}},
}
OTHER_LOCATION_MEAL = {
    **MEAL,
    "id": "fixture-salad",
    "name": "Fixture Salad",
    "location": "Observatory Hill",
}


class LocationLabelTests(unittest.TestCase):
    def setUp(self):
        module = importlib.import_module("app.location_matching")
        self.label = module.location_label
        self.resolve = module.resolve_location

    def test_issue28_label_ignores_case_spacing_punctuation_and_leading_the(self):
        for variant in (
            "The Halal Shack",
            "halal shack",
            "  THE   Halal  Shack ",
            "the halal-shack",
            "Halal Shack.",
        ):
            with self.subTest(variant=variant):
                self.assertEqual(self.label(variant), "halal shack")

    def test_issue28_location_label_keeps_the_inside_a_name(self):
        self.assertEqual(self.label("Over The Hill"), "over the hill")

    def test_issue28_location_label_of_non_text_is_empty(self):
        for value in (None, 42, ["The Halal Shack"]):
            with self.subTest(value=value):
                self.assertEqual(self.label(value), "")

    def test_issue28_resolves_normalized_name_to_the_canonical_menu_location(self):
        known = ["The Halal Shack", "Observatory Hill"]
        for requested in ("Halal Shack", "the halal shack", "HALAL-SHACK"):
            with self.subTest(requested=requested):
                self.assertEqual(self.resolve(requested, known), "The Halal Shack")

    def test_issue28_resolves_a_close_typo_with_one_clear_match(self):
        known = ["The Halal Shack", "Observatory Hill"]
        for requested in ("halal shak", "Hala Shack", "observatory hil"):
            with self.subTest(requested=requested):
                self.assertIsNotNone(self.resolve(requested, known))
        self.assertEqual(self.resolve("halal shak", known), "The Halal Shack")
        self.assertEqual(self.resolve("observatory hil", known), "Observatory Hill")

    def test_issue28_does_not_resolve_unrelated_or_partial_names(self):
        known = ["The Halal Shack", "Observatory Hill"]
        for requested in ("Newcomb Hall", "Halal", "Shack", "the", ""):
            with self.subTest(requested=requested):
                self.assertIsNone(self.resolve(requested, known))

    def test_issue28_does_not_guess_between_two_close_locations(self):
        self.assertIsNone(self.resolve("Rink Grill", ["Runk Grill", "Rank Grill"]))

    def test_issue28_ignores_missing_or_non_text_menu_locations(self):
        known = [None, 42, "", "The Halal Shack", "The Halal Shack"]
        self.assertEqual(self.resolve("halal shack", known), "The Halal Shack")
        self.assertIsNone(self.resolve("halal shack", [None, 42, ""]))


class LocationValidationTests(unittest.TestCase):
    def assert_codes(self, requested, expected):
        result = evaluate_meal_constraints(
            {"location": "The Halal Shack"}, Constraints(location=requested)
        )
        self.assertCountEqual([error.code for error in result.errors], expected)

    def test_issue28_validator_accepts_normalized_location_names(self):
        for requested in ("Halal Shack", "the halal-shack", "THE HALAL SHACK"):
            with self.subTest(requested=requested):
                self.assert_codes(requested, [])

    def test_issue28_validator_stays_strict_about_typos_and_other_locations(self):
        for requested in ("halal shak", "Observatory Hill", "Halal"):
            with self.subTest(requested=requested):
                self.assert_codes(requested, ["LOCATION_NOT_ALLOWED"])


class LocationRecommendationTests(unittest.TestCase):
    def setUp(self):
        self.interpret = AsyncMock()
        self.recommend = AsyncMock(return_value={"meal_id": MEAL["id"]})
        for getter, dependency in (
            (meal_requests.get_interpreter, lambda: self.interpret),
            (meal_requests.get_recommender, lambda: self.recommend),
            (meal_requests.get_menu, lambda: [MEAL, OTHER_LOCATION_MEAL]),
        ):
            app.dependency_overrides[getter] = dependency
            self.addCleanup(app.dependency_overrides.pop, getter)

    def submit(self, location):
        self.interpret.return_value = {"location": location}
        with TestClient(app) as client:
            response = client.post(
                "/api/requests/interpret",
                json={"text": f"Find a meal at {location}.", "recommend": True},
            )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_issue28_near_miss_location_returns_a_validated_meal_there(self):
        for requested in ("Fixture Dining Hall", "the fixture dinning hall"):
            with self.subTest(requested=requested):
                result = self.submit(requested)
                self.assertEqual(result["status"], "recommended")
                self.assertEqual(result["meal"], MEAL)
                context = self.recommend.await_args.kwargs
                self.assertEqual(
                    context["constraints"].location, "The Fixture Dining Hall"
                )
                self.assertEqual([item["id"] for item in context["menu"]], [MEAL["id"]])

    def test_issue28_unknown_location_returns_no_match_without_model(self):
        result = self.submit("Newcomb Hall")
        self.assertEqual(
            result, {"status": "recommendation_failed", "reason": "no_match"}
        )
        self.recommend.assert_not_awaited()

    def test_issue28_near_miss_cannot_bypass_validation_of_other_locations(self):
        self.recommend.return_value = {"meal_id": OTHER_LOCATION_MEAL["id"]}
        result = self.submit("fixture dinning hall")
        self.assertEqual(
            result,
            {"status": "recommendation_failed", "reason": "correction_exhausted"},
        )
        self.assertEqual(self.recommend.await_count, 3)
        for call in self.recommend.await_args_list[1:]:
            self.assertEqual(
                call.kwargs["validation_errors"][0]["code"], "LOCATION_NOT_ALLOWED"
            )


if __name__ == "__main__":
    unittest.main()
