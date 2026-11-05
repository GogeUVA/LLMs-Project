import importlib
import unittest
from datetime import date

from app.dietary import DietaryRequirements
from app.meal_requests import Constraints, NutritionTargets

SERVICE_DATE = date(2026, 11, 4)
DOCUMENTED = {"kind": "documented"}
ESTIMATED = {"kind": "estimated"}


class MealConstraintTests(unittest.TestCase):
    def setUp(self):
        self.evaluate = importlib.import_module(
            "app.meal_constraints"
        ).evaluate_meal_constraints
        self.meal = {
            "price": {"amount": 7.25, "currency": "USD"},
            "location": "Newcomb Hall",
            "availability": [
                {
                    "start": "2026-11-04T11:00:00-05:00",
                    "end": "2026-11-04T14:00:00-05:00",
                }
            ],
            "ingredients": ["rice", "beans"],
            "allergens": [],
            "dietary": {"vegan": True},
            "nutrition": {"protein_g": 23, "calories_kcal": 410},
            "provenance": {
                field: DOCUMENTED
                for field in ("price", "availability", "protein_g", "calories_kcal")
            },
        }

    def assert_outcome(self, meal, constraints, *errors, service_date=SERVICE_DATE):
        result = self.evaluate(meal, constraints, service_date=service_date)
        self.assertEqual(result.valid, not errors)
        self.assertCountEqual([error.code for error in result.errors], errors)

    def test_issue5_budget_compares_exact_cents_and_allows_equality(self):
        constraints = Constraints(max_budget_cents=725)
        for amount, errors in ((7.24, ()), (7.25, ()), (7.26, ("BUDGET_EXCEEDED",))):
            with self.subTest(amount=amount):
                meal = {**self.meal, "price": {"amount": amount, "currency": "USD"}}
                self.assert_outcome(meal, constraints, *errors)

    def test_issue5_budget_requires_documented_usable_usd_price(self):
        constraints = Constraints(max_budget_cents=725)
        for price, provenance in (
            (None, DOCUMENTED),
            ({"amount": 7.25, "currency": "USD"}, ESTIMATED),
            ({"amount": 7.25, "currency": "EUR"}, DOCUMENTED),
            ({"amount": 7.251, "currency": "USD"}, DOCUMENTED),
        ):
            with self.subTest(price=price, provenance=provenance):
                meal = {
                    **self.meal,
                    "price": price,
                    "provenance": {"price": provenance},
                }
                self.assert_outcome(meal, constraints, "PRICE_UNKNOWN")

    def test_issue5_location_must_match_the_menu_location(self):
        constraints = Constraints(location="newcomb hall")
        for location, errors in (
            ("Newcomb Hall", ()),
            ("Observatory Hill", ("LOCATION_NOT_ALLOWED",)),
            (None, ("LOCATION_UNKNOWN",)),
        ):
            with self.subTest(location=location):
                self.assert_outcome(
                    {**self.meal, "location": location}, constraints, *errors
                )

    def test_issue5_service_window_includes_start_and_excludes_end(self):
        for time, errors in (
            ("10:59", ("AVAILABILITY_MISMATCH",)),
            ("11:00", ()),
            ("13:59", ()),
            ("14:00", ("AVAILABILITY_MISMATCH",)),
            ("14:01", ("AVAILABILITY_MISMATCH",)),
        ):
            with self.subTest(time=time):
                self.assert_outcome(self.meal, Constraints(meal_time=time), *errors)

    def test_issue5_overnight_window_respects_the_requested_local_date(self):
        meal = {
            **self.meal,
            "availability": [
                {"start": "2026-11-05T04:00:00Z", "end": "2026-11-05T07:00:00Z"}
            ],
        }
        constraints = Constraints(meal_time="01:00")
        self.assert_outcome(meal, constraints, "AVAILABILITY_MISMATCH")
        self.assert_outcome(meal, constraints, service_date=date(2026, 11, 5))

    def test_issue5_time_requires_documented_valid_availability(self):
        constraints = Constraints(meal_time="12:00")
        for windows, provenance in (
            (None, DOCUMENTED),
            (self.meal["availability"], ESTIMATED),
            (
                [{"start": "2026-11-04T11:00:00", "end": "2026-11-04T14:00:00"}],
                DOCUMENTED,
            ),
        ):
            with self.subTest(windows=windows, provenance=provenance):
                meal = {
                    **self.meal,
                    "availability": windows,
                    "provenance": {"availability": provenance},
                }
                self.assert_outcome(meal, constraints, "AVAILABILITY_UNKNOWN")

    def test_issue5_time_requires_a_date_and_an_unambiguous_local_clock(self):
        for day, time in (
            (None, "12:00"),
            (date(2026, 3, 8), "02:30"),
            (date(2026, 11, 1), "01:30"),
        ):
            with self.subTest(day=day, time=time):
                self.assert_outcome(
                    self.meal,
                    Constraints(meal_time=time),
                    "MEAL_TIME_UNKNOWN",
                    service_date=day,
                )

    def test_issue5_rejects_known_dietary_conflicts_and_missing_hard_evidence(self):
        constraints = Constraints(
            dietary=DietaryRequirements(allergies=["peanut"], restrictions=["vegan"])
        )
        self.assert_outcome(self.meal, constraints)
        self.assert_outcome(
            {**self.meal, "allergens": ["peanut"]}, constraints, "ALLERGEN_CONFLICT"
        )
        self.assert_outcome(
            {**self.meal, "dietary": {"vegan": False}}, constraints, "DIETARY_CONFLICT"
        )
        self.assert_outcome(
            {**self.meal, "allergens": None}, constraints, "RESTRICTION_DATA_UNKNOWN"
        )

    def test_issue5_applies_only_explicit_nutrition_targets(self):
        self.assert_outcome({}, Constraints(goal="high protein"), service_date=None)
        self.assert_outcome(
            self.meal,
            Constraints(
                nutrition=NutritionTargets(min_protein_grams=23, max_calories=410)
            ),
        )
        for targets in (
            NutritionTargets(min_protein_grams=24),
            NutritionTargets(max_calories=409),
        ):
            with self.subTest(targets=targets):
                self.assert_outcome(
                    self.meal,
                    Constraints(nutrition=targets),
                    "NUTRITION_TARGET_NOT_MET",
                )

    def test_issue5_estimated_nutrition_cannot_verify_a_numeric_target(self):
        constraints = Constraints(nutrition=NutritionTargets(min_protein_grams=23))
        meal = {**self.meal, "provenance": {"protein_g": ESTIMATED}}
        self.assert_outcome(meal, constraints, "NUTRITION_UNKNOWN")
        self.assert_outcome({}, constraints, "NUTRITION_UNKNOWN")

    def test_issue5_reports_multiple_constraints_that_fail_on_the_same_meal(self):
        constraints = Constraints(max_budget_cents=700, location="Observatory Hill")
        self.assert_outcome(
            self.meal, constraints, "BUDGET_EXCEEDED", "LOCATION_NOT_ALLOWED"
        )
