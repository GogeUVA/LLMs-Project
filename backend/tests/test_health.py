"""AI-generated tests for #14 [SETUP-01]; no human refinement recorded."""

import unittest

from fastapi.testclient import TestClient

from app.main import app


class Setup01SmokeTests(unittest.TestCase):
    def test_setup01_health_endpoint_is_available_without_credentials(self):
        with TestClient(app) as client:
            response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_setup01_unknown_endpoint_does_not_return_success(self):
        with TestClient(app) as client:
            response = client.get("/api/recommendations")
        self.assertEqual(response.status_code, 404)
