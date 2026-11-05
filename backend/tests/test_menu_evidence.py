import importlib
import unittest


class MenuEvidenceTests(unittest.TestCase):
    def setUp(self):
        module = importlib.import_module("app.menu_evidence")
        self.documented_value = module.documented_numeric_value

    def test_issue7_documented_value_can_be_used_for_numeric_checks(self):
        self.assertEqual(self.documented_value(24, {"kind": "documented"}), 24)

    def test_issue7_documented_zero_is_valid_evidence(self):
        self.assertEqual(self.documented_value(0, {"kind": "documented"}), 0)

    def test_issue7_estimate_cannot_be_used_to_satisfy_a_hard_constraint(self):
        self.assertIsNone(self.documented_value(30, {"kind": "estimated"}))

    def test_issue7_missing_value_or_provenance_cannot_satisfy_a_hard_constraint(self):
        for value, provenance in (
            (None, {"kind": "documented"}),
            (24, {"kind": "unknown"}),
            (24, None),
        ):
            with self.subTest(value=value, provenance=provenance):
                self.assertIsNone(self.documented_value(value, provenance))

    def test_issue7_invalid_numbers_are_not_evidence(self):
        for value in (True, "24", float("nan"), float("inf"), -1):
            with self.subTest(value=value):
                self.assertIsNone(self.documented_value(value, {"kind": "documented"}))

    def test_issue7_existing_dataset_preserves_document_provenance_per_field(self):
        from pathlib import Path

        from app.menu_evidence import load_documented_menu

        dataset = (
            Path(__file__).resolve().parents[1] / "data/nutrition/halal_shack.json"
        )
        meal = load_documented_menu(dataset)[0]
        protein = meal["provenance"]["protein_g"]
        self.assertEqual(protein["kind"], "documented")
        self.assertEqual(protein["source_updated"], "2026-08-09")
        self.assertEqual(protein["source_page"], 2)
        self.assertNotIn("price", meal["provenance"])
        self.assertNotIn("allergens", meal["provenance"])
        self.assertEqual(
            self.documented_value(meal["nutrition"]["protein_g"], protein), 23
        )
