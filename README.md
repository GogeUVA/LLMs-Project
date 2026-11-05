# LLMs-Project
Final project for LLMs and Software Engineering

## Hoos Eating

Hoos Eating helps UVA students describe their nutrition goals, budget, location, timing, and dietary preferences in natural language and receive suitable campus meal recommendations.

The Alpha workflow is:

1. Describe a meal need.
2. Generate a recommendation using supplied menu data.
3. Validate the recommendation against the menu data and supported constraints.
4. Automatically return validation errors to the model for correction.
5. Display only a checked recommendation.
6. Record the student's meal selection.

## Test-driven development

For each Alpha issue, the team will write and review tests before implementing the corresponding production behavior. The tests will first be run to confirm a meaningful failure, then the implementation will be added and the tests rerun until they pass. Refactoring will occur while the tests remain passing.

Automated tests will use controlled menu fixtures and mocked model responses so results are repeatable. Live model behavior will be evaluated separately. The team will record actual test counts, issue mappings, pass rate, line coverage, and the contributions of AI-generated, human-refined, and manually added tests. Test results, coverage, commits, and development history will only be reported from real evidence.

## Proposed technology stack

The repository does not yet have an application framework or dependency manifests. For the Alpha implementation, the proposed stack is:

- **Student interface:** React, TypeScript, and Vite for a responsive, keyboard-accessible meal request and recommendation flow.
- **Application API:** Python with FastAPI. Keep natural-language request handling, LLM calls, deterministic validation, and selection recording in separate modules.
- **Data contracts and validation:** Pydantic request/response models at API boundaries, with ordinary Python code responsible for menu-grounded recommendation checks. LLM output must never bypass validation.
- **Persistence:** PostgreSQL accessed through SQLAlchemy for student selections and, when the data source is established, menu records. Use controlled synthetic fixtures until an authoritative campus menu source is documented.
- **LLM integration:** A provider-neutral adapter behind the API, with structured output where supported. Mock the adapter in automated tests; keep credentials in environment configuration.
- **Quality checks:** Python `unittest` for the initial dependency-free validator slice; introduce `pytest` when a project dependency manifest and broader suite are established. Use Vitest and Testing Library for the React UI and Playwright for critical end-to-end flows.

This is a proposed direction, not a claim that these frameworks or services are already installed. The first issue implementation will use only the Python standard library so deterministic validation can start without locking in dependencies prematurely. Add manifests and framework dependencies when the first API or UI issue is implemented, after checking the team environment and deployment target.

## Running the current tests

The initial validator has no third-party dependencies. From the repository root, run `python3 -m unittest discover -s tests -v`. The current issue #11 slice is covered by `tests/test_us45_recommendation_validation.py`.
