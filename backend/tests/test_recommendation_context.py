"""AI-generated tests for #30 [BUG-02]; no human refinement recorded."""

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from app.meal_requests import Constraints
from app.recommendations import (
    Recommendation,
    load_menu,
    recommend_meal,
    recommend_with_groq,
)

# Groq's on-demand tier allows 8,000 tokens per minute for the configured model.
# Roughly four JSON characters make a token, so the full sourced menu must stay
# well below that budget to leave room for the reply and the correction loop.
MAX_FULL_MENU_CONTEXT_CHARS = 12_000
CONSTRAINTS = Constraints.model_validate({"nutrition": {"min_protein_grams": 20}})


def sent_context(transport: AsyncMock) -> dict:
    messages = transport.await_args.args[0]
    return json.loads(messages[-1]["content"])


class RecommendationContextTests(unittest.TestCase):
    def setUp(self):
        self.menu = load_menu()
        patcher = patch(
            "app.recommendations.request_structured_groq",
            new=AsyncMock(return_value=json.dumps({"meal_id": self.menu[0]["id"]})),
        )
        self.transport = patcher.start()
        self.addCleanup(patcher.stop)

    def ask_model(self, **feedback):
        return asyncio.run(
            recommend_with_groq(
                request_text="at least 20g protein",
                constraints=CONSTRAINTS,
                menu=self.menu,
                **feedback,
            )
        )

    def test_issue30_menu_omits_provenance_but_keeps_menu_facts(self):
        self.ask_model()
        sent = sent_context(self.transport)["menu"]
        self.assertEqual(len(sent), len(self.menu))
        for item, record in zip(sent, self.menu, strict=True):
            with self.subTest(meal=record["id"]):
                self.assertNotIn("provenance", item)
                for field in ("id", "name", "location", "nutrition", "serving_size"):
                    self.assertEqual(item[field], record[field])

    def test_issue30_does_not_mutate_the_trusted_menu_records(self):
        self.ask_model()
        for record in self.menu:
            with self.subTest(meal=record["id"]):
                self.assertIn("provenance", record)
                self.assertTrue(record["provenance"])

    def test_issue30_correction_request_uses_the_compact_menu(self):
        errors = [{"code": "UNKNOWN_MEAL_ID", "field": "meal_id", "message": "x"}]
        self.ask_model(
            original_request_text="high protein lunch", validation_errors=errors
        )
        context = sent_context(self.transport)
        self.assertEqual(context["validation_errors"], errors)
        self.assertEqual(context["original_request"], "high protein lunch")
        self.assertTrue(all("provenance" not in item for item in context["menu"]))

    def test_issue30_full_sourced_menu_fits_the_provider_token_budget(self):
        self.ask_model()
        content = self.transport.await_args.args[0][-1]["content"]
        self.assertLess(len(content), MAX_FULL_MENU_CONTEXT_CHARS)

    def test_issue30_displayed_meal_keeps_full_record_and_provenance(self):
        chosen = self.menu[0]

        async def run():
            return [
                event
                async for event in recommend_meal(
                    request_text="at least 20g protein",
                    original_request_text="at least 20g protein",
                    constraints=CONSTRAINTS,
                    menu=self.menu,
                    recommender=recommend_with_groq,
                    unsupported_details=[],
                    excluded_meal_ids=[],
                )
            ]

        events = asyncio.run(run())
        self.assertEqual(len(events), 1)
        self.assertIsInstance(events[0], Recommendation)
        self.assertEqual(events[0].meal, chosen)
        self.assertEqual(events[0].meal["provenance"], chosen["provenance"])


if __name__ == "__main__":
    unittest.main()
