import importlib
import unittest

from pydantic import ValidationError


class DietaryTests(unittest.TestCase):
    def setUp(self):
        self.api = importlib.import_module("app.dietary")
        self.requirements = self.api.DietaryRequirements(
            allergies=["peanut"],
            restrictions=["vegan"],
            preferences=["high protein"],
            dislikes=["mushroom"],
        )
        self.evidence = {
            "ingredients": ["rice", "beans"],
            "allergens": [],
            "dietary": {"vegan": True},
        }

    def check(self, evidence=None, requirements=None):
        return self.api.check_dietary(
            requirements if requirements is not None else self.requirements,
            self.evidence if evidence is None else evidence,
        )

    def test_issue1_preserves_all_four_categories_in_serialized_context(self):
        expected = {
            "allergies": ["peanut"],
            "restrictions": ["vegan"],
            "preferences": ["high protein"],
            "dislikes": ["mushroom"],
        }
        original = self.requirements.model_dump(mode="json")
        self.assertEqual(original, expected)
        restored = self.api.DietaryRequirements.model_validate(original)
        self.assertEqual(restored.model_dump(mode="json"), expected)

    def test_issue1_known_compatible_evidence_passes(self):
        result = self.check()
        self.assertEqual(result.status, "compatible")
        self.assertEqual(result.errors, [])

    def test_issue1_known_allergen_conflict_rejects(self):
        result = self.check({**self.evidence, "allergens": ["peanut"]})
        self.assertEqual(result.status, "conflict")
        self.assertIn("ALLERGEN_CONFLICT", [e.code for e in result.errors])

    def test_issue1_known_restriction_conflict_rejects(self):
        result = self.check({**self.evidence, "dietary": {"vegan": False}})
        self.assertEqual(result.status, "conflict")
        self.assertIn("DIETARY_CONFLICT", [e.code for e in result.errors])

    def test_issue1_absent_allergen_evidence_is_unknown(self):
        result = self.check({**self.evidence, "allergens": None})
        self.assertEqual(result.status, "unknown")
        self.assertIn("RESTRICTION_DATA_UNKNOWN", [e.code for e in result.errors])

    def test_issue1_absent_ingredients_are_not_claimed_compatible(self):
        result = self.check({**self.evidence, "ingredients": None})
        self.assertEqual(result.status, "unknown")
        self.assertTrue(result.errors)

    def test_issue1_missing_dietary_classification_is_unknown(self):
        result = self.check({**self.evidence, "dietary": {}})
        self.assertEqual(result.status, "unknown")

    def test_issue1_known_conflict_is_not_hidden_by_other_unknown_evidence(self):
        result = self.check({**self.evidence, "allergens": ["peanut"], "dietary": {}})
        self.assertEqual(result.status, "conflict")
        self.assertIn("ALLERGEN_CONFLICT", [e.code for e in result.errors])

    def test_issue1_disliked_food_is_not_a_hard_conflict(self):
        result = self.check({**self.evidence, "ingredients": ["mushroom"]})
        self.assertEqual(result.status, "compatible")
        self.assertEqual(self.requirements.dislikes, ["mushroom"])

    def test_issue1_soft_preferences_do_not_require_hard_constraint_evidence(self):
        requirements = self.api.DietaryRequirements(preferences=["vegan"])
        result = self.check({"dietary": {"vegan": False}}, requirements)
        self.assertEqual(result.status, "not_applicable")
        self.assertEqual(requirements.restrictions, [])

    def test_issue1_checks_do_not_mutate_original_context_across_candidates(self):
        before = self.requirements.model_dump(mode="json")
        self.check({**self.evidence, "allergens": ["peanut"]})
        self.check()
        self.assertEqual(self.requirements.model_dump(mode="json"), before)

    def test_issue1_blank_restriction_is_rejected_instead_of_silently_removed(self):
        with self.assertRaises(ValidationError):
            self.api.DietaryRequirements(restrictions=["   "])

    def test_issue1_wrong_category_type_is_rejected(self):
        with self.assertRaises(ValidationError):
            self.api.DietaryRequirements(allergies="peanut")

    def test_issue1_error_identifies_affected_evidence_and_explains_failure(self):
        result = self.check({**self.evidence, "allergens": ["peanut"]})
        error = next(e for e in result.errors if e.code == "ALLERGEN_CONFLICT")
        self.assertEqual(error.field, "allergens")
        self.assertIn("peanut", error.message.lower())

    def test_issue1_unlisted_allergy_stays_unknown(self):
        requirements = self.api.DietaryRequirements(allergies=["mustard"])
        self.assertEqual(self.check(requirements=requirements).status, "unknown")

    def test_issue1_plural_peanut_label_is_a_known_conflict(self):
        result = self.check({**self.evidence, "allergens": ["Peanuts"]})
        self.assertEqual(result.status, "conflict")
