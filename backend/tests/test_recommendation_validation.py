import importlib
import unittest

from app.dietary import DietaryRequirements
from app.meal_requests import Constraints

DOCUMENTED = {"kind": "documented"}


class RecommendationValidationTests(unittest.TestCase):
    def setUp(self):
        self.api = importlib.import_module("app.recommendation_validation")
        self.meal = {
            "id": "synthetic-newcomb-bean-bowl",
            "name": "Synthetic Bean Bowl",
            "location": "Newcomb Hall",
            "price": {"amount": 7.25, "currency": "USD"},
            "ingredients": ["rice", "beans"],
            "allergens": [],
            "dietary": {"vegan": True},
            "nutrition": {"protein_g": 23, "calories_kcal": 410},
            "provenance": {
                "price": DOCUMENTED,
                "protein_g": DOCUMENTED,
                "calories_kcal": DOCUMENTED,
            },
        }
        self.menu = [self.meal]

    def validate(self, candidate, constraints=None, menu=None):
        return self.api.validate_recommendation(
            candidate,
            self.menu if menu is None else menu,
            Constraints() if constraints is None else constraints,
        )

    @staticmethod
    def error_codes(result):
        return [error.code for error in result.errors]

    def test_issue11_accepts_a_known_eligible_meal(self):
        result = self.validate({"meal_id": self.meal["id"]})

        self.assertTrue(result.valid)
        self.assertEqual(result.meal_id, self.meal["id"])
        self.assertEqual(result.errors, [])

    def test_issue11_rejects_malformed_model_output(self):
        for candidate in (
            None,
            [],
            {},
            {"meal_id": ""},
            {"meal_id": "   "},
            {"meal_id": 42},
        ):
            with self.subTest(candidate=candidate):
                result = self.validate(candidate)
                self.assertFalse(result.valid)
                self.assertIsNone(result.meal_id)
                self.assertEqual(self.error_codes(result), ["MALFORMED_RECOMMENDATION"])

    def test_issue11_rejects_an_unknown_meal_identifier(self):
        result = self.validate({"meal_id": "synthetic-meal-that-does-not-exist"})

        self.assertFalse(result.valid)
        self.assertIsNone(result.meal_id)
        self.assertEqual(self.error_codes(result), ["UNKNOWN_MEAL_ID"])

    def test_issue11_uses_menu_facts_instead_of_model_claims(self):
        candidate = {
            "meal_id": self.meal["id"],
            "price": {"amount": 1.00, "currency": "USD"},
            "location": "Observatory Hill",
        }

        result = self.validate(candidate, Constraints(max_budget_cents=700))

        self.assertFalse(result.valid)
        self.assertEqual(result.meal_id, self.meal["id"])
        self.assertEqual(self.error_codes(result), ["BUDGET_EXCEEDED"])

    def test_issue11_allows_a_price_equal_to_the_maximum_budget(self):
        result = self.validate(
            {"meal_id": self.meal["id"]}, Constraints(max_budget_cents=725)
        )

        self.assertTrue(result.valid)
        self.assertEqual(result.errors, [])

    def test_issue11_does_not_use_missing_price_to_pass_a_budget(self):
        meal_without_price = {
            **self.meal,
            "price": None,
            "provenance": {},
        }

        result = self.validate(
            {"meal_id": self.meal["id"]},
            Constraints(max_budget_cents=725),
            [meal_without_price],
        )

        self.assertFalse(result.valid)
        self.assertEqual(self.error_codes(result), ["PRICE_UNKNOWN"])

    def test_issue11_rejects_a_known_dietary_conflict(self):
        conflicting_meal = {**self.meal, "dietary": {"vegan": False}}
        constraints = Constraints(dietary=DietaryRequirements(restrictions=["vegan"]))

        result = self.validate(
            {"meal_id": self.meal["id"]}, constraints, [conflicting_meal]
        )

        self.assertFalse(result.valid)
        self.assertEqual(self.error_codes(result), ["DIETARY_CONFLICT"])

    def test_issue11_returns_all_structured_validation_errors(self):
        result = self.validate(
            {"meal_id": self.meal["id"]},
            Constraints(max_budget_cents=700, location="Observatory Hill"),
        )

        self.assertFalse(result.valid)
        self.assertCountEqual(
            self.error_codes(result),
            ["BUDGET_EXCEEDED", "LOCATION_NOT_ALLOWED"],
        )
        for error in result.errors:
            self.assertIsInstance(error.field, str)
            self.assertTrue(error.field)
            self.assertIsInstance(error.message, str)
            self.assertTrue(error.message)


if __name__ == "__main__":
    unittest.main()
