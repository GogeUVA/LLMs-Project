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
