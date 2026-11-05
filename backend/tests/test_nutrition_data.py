"""AI-generated tests for #15 [SETUP-02]; no human refinement recorded."""

import json
import math
import unittest
from pathlib import Path

DATA_PATH = Path(__file__).parents[1] / "data" / "nutrition" / "halal_shack.json"


class NutritionDataIssue15Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with DATA_PATH.open(encoding="utf-8") as dataset_file:
            cls.dataset = json.load(dataset_file)

    def test_issue15_dataset_records_source_and_effective_date(self):
        self.assertEqual(self.dataset["location"], "The Halal Shack")
        self.assertEqual(
            self.dataset["location_page_url"],
            "https://virginia.mydininghub.com/en/location/the-halal-shack",
        )
        self.assertIn("images.elevate-dxp.com/adobe/assets", self.dataset["source_url"])
        self.assertEqual(
            self.dataset["source_document"], "THS_Allergen&NutritionChart_F26-S27.pdf"
        )
        self.assertEqual(self.dataset["source_updated"], "2026-08-09")
        self.assertEqual(self.dataset["review_status"], "reviewed")
        self.assertIn("confirmed", self.dataset["review_note"])
        self.assertGreaterEqual(len(self.dataset["items"]), 10)

    def test_issue15_each_item_has_unique_identity_serving_and_nutrition(self):
        items = self.dataset["items"]
        item_ids = [item["id"] for item in items]

        self.assertEqual(len(item_ids), len(set(item_ids)))
        for item in items:
            with self.subTest(item=item.get("name")):
                self.assertTrue(item["name"].strip())
                self.assertEqual(item["location"], "The Halal Shack")
                self.assertGreater(item["serving_size"]["amount"], 0)
                self.assertTrue(item["serving_size"]["unit"].strip())
                self.assertTrue(item["nutrition"])
                self.assertEqual(item["source_page"], 2)

    def test_issue15_nutrition_values_are_nonnegative_numbers_with_units_in_keys(self):
        for item in self.dataset["items"]:
            for nutrient, value in item["nutrition"].items():
                with self.subTest(item=item["name"], nutrient=nutrient):
                    self.assertRegex(nutrient, r"_(kcal|g|mg|mcg)$")
                    self.assertIsInstance(value, (int, float))
                    self.assertNotIsInstance(value, bool)
                    self.assertTrue(math.isfinite(value))
                    self.assertGreaterEqual(value, 0)

    def test_issue15_signature_bowl_serving_variants_are_not_merged(self):
        avo_bowls = [
            item for item in self.dataset["items"] if item["name"] == "Avo Chicken Bowl"
        ]

        self.assertEqual(len(avo_bowls), 1)
        self.assertEqual(
            avo_bowls[0]["serving_size"],
            {"amount": 24, "unit": "oz", "weight_grams": 333},
        )

    def test_issue15_signature_nutrition_values_match_published_chart(self):
        items_by_name = {item["name"]: item for item in self.dataset["items"]}

        self.assertEqual(
            items_by_name["Avo Chicken Bowl"]["nutrition"]["calories_kcal"], 570
        )
        self.assertEqual(
            items_by_name["Avo Chicken Bowl"]["nutrition"]["total_fat_g"], 47
        )
        self.assertEqual(
            items_by_name["Avo Chicken Bowl"]["nutrition"]["sodium_mg"], 830
        )
        self.assertEqual(
            items_by_name["Naanarito Burrito"]["nutrition"]["calories_kcal"], 820
        )


if __name__ == "__main__":
    unittest.main()
