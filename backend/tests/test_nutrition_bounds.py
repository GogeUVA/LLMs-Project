"""AI-generated tests for #32 [BUG-03]; no human refinement recorded."""

import unittest
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import groq_interpreter, meal_requests
from app.main import app
from app.meal_constraints import evaluate_meal_constraints
from app.meal_requests import Constraints, Interpretation, NutritionTargets
from app.recommendations import explain_match

DOCUMENTED = {"kind": "documented"}
MEAL = {
    "id": "fixture-falafel",
    "name": "Fixture Falafel",
    "location": "Fixture Dining",
    "nutrition": {"protein_g": 25, "calories_kcal": 600},
    "provenance": {"protein_g": DOCUMENTED, "calories_kcal": DOCUMENTED},
}


def nutrition_errors(**targets):
    constraints = Constraints(nutrition=NutritionTargets(**targets))
    return evaluate_meal_constraints(MEAL, constraints).errors


class StrictBoundValidationTests(unittest.TestCase):
    def test_issue32_exclusive_protein_minimum_rejects_the_boundary_value(self):
        errors = nutrition_errors(min_protein_grams=25, min_protein_exclusive=True)
        self.assertEqual([error.code for error in errors], ["NUTRITION_TARGET_NOT_MET"])
        self.assertIn("more than", errors[0].message)

    def test_issue32_exclusive_calorie_maximum_rejects_the_boundary_value(self):
        errors = nutrition_errors(max_calories=600, max_calories_exclusive=True)
        self.assertEqual([error.code for error in errors], ["NUTRITION_TARGET_NOT_MET"])
        self.assertIn("less than", errors[0].message)

    def test_issue32_exclusive_bounds_accept_values_strictly_inside(self):
        self.assertEqual(
            nutrition_errors(
                min_protein_grams=24.9,
                min_protein_exclusive=True,
                max_calories=601,
                max_calories_exclusive=True,
            ),
            [],
        )

    def test_issue32_inclusive_bounds_still_accept_the_boundary_value(self):
        for targets in (
            {"min_protein_grams": 25},
            {"max_calories": 600},
            {"min_protein_grams": 25, "min_protein_exclusive": False},
            {"max_calories": 600, "max_calories_exclusive": False},
        ):
            with self.subTest(targets=targets):
                self.assertEqual(nutrition_errors(**targets), [])

    def test_issue32_exclusive_flags_default_to_inclusive(self):
        targets = NutritionTargets(min_protein_grams=25, max_calories=600)
        self.assertIs(targets.min_protein_exclusive, False)
        self.assertIs(targets.max_calories_exclusive, False)

    def test_issue32_exclusive_flags_must_be_booleans(self):
        for field in ("min_protein_exclusive", "max_calories_exclusive"):
            for value in (1, "true", None):
                with (
                    self.subTest(field=field, value=value),
                    self.assertRaises(ValidationError),
                ):
                    NutritionTargets.model_validate({field: value})


class StrictBoundInterpretationTests(unittest.TestCase):
    def test_issue32_interpretation_schema_offers_the_exclusive_flags(self):
        nutrition = Interpretation.model_json_schema()["$defs"]["NutritionTargets"]
        for field in ("min_protein_exclusive", "max_calories_exclusive"):
            with self.subTest(field=field):
                self.assertEqual(nutrition["properties"][field]["type"], "boolean")

    def test_issue32_instructions_explain_which_words_are_exclusive(self):
        instructions = groq_interpreter._INSTRUCTIONS
        for phrase in (
            "min_protein_exclusive",
            "max_calories_exclusive",
            "more than",
            "less than",
            "at least",
            "at most",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, instructions)


class StrictBoundExplanationTests(unittest.TestCase):
    def explain(self, **targets):
        return explain_match(MEAL, Constraints(nutrition=NutritionTargets(**targets)))

    def test_issue32_explanation_describes_exclusive_targets(self):
        self.assertIn(
            "25 g protein per serving is more than your 24 g target.",
            self.explain(min_protein_grams=24, min_protein_exclusive=True),
        )
        self.assertIn(
            "600 kcal per serving is under your 700 kcal limit.",
            self.explain(max_calories=700, max_calories_exclusive=True),
        )

    def test_issue32_explanation_for_inclusive_targets_is_unchanged(self):
        explanation = self.explain(min_protein_grams=25, max_calories=600)
        self.assertIn("25 g protein per serving meets your 25 g minimum.", explanation)
        self.assertIn("600 kcal per serving fits your 600 kcal limit.", explanation)


class StrictBoundRecommendationTests(unittest.TestCase):
    def test_issue32_more_than_request_excludes_the_boundary_meal(self):
        higher = {
            **MEAL,
            "id": "fixture-shawarma",
            "name": "Fixture Shawarma",
            "nutrition": {"protein_g": 47, "calories_kcal": 640},
        }
        interpret = AsyncMock(
            return_value={
                "nutrition": {"min_protein_grams": 25, "min_protein_exclusive": True}
            }
        )
        recommend = AsyncMock(return_value={"meal_id": MEAL["id"]})
        for getter, dependency in (
            (meal_requests.get_interpreter, lambda: interpret),
            (meal_requests.get_recommender, lambda: recommend),
            (meal_requests.get_menu, lambda: [MEAL, higher]),
        ):
            app.dependency_overrides[getter] = dependency
            self.addCleanup(app.dependency_overrides.pop, getter)

        with TestClient(app) as client:
            response = client.post(
                "/api/requests/interpret",
                json={"text": "more than 25 g protein", "recommend": True},
            )

        result = response.json()
        self.assertEqual(
            result,
            {"status": "recommendation_failed", "reason": "correction_exhausted"},
        )
        self.assertEqual(recommend.await_count, 3)
        supplied = [item["id"] for item in recommend.await_args_list[0].kwargs["menu"]]
        self.assertEqual(supplied, [higher["id"]])
        for call in recommend.await_args_list[1:]:
            self.assertEqual(
                call.kwargs["validation_errors"][0]["code"], "NUTRITION_TARGET_NOT_MET"
            )


if __name__ == "__main__":
    unittest.main()
