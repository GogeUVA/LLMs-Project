# Hoos Eating Development Guidelines

## 1. Project Overview

Hoos Eating is an AI-powered meal recommendation application designed to help University of Virginia students find meals that match their nutrition goals, budget, location, schedule, and dietary preferences.

The primary objective of the Alpha release is to demonstrate that students can describe their meal needs in natural language and receive relevant, menu-grounded meal recommendations.

The LLM is a central component of the application. However, recommendations must be validated against supplied menu data and supported constraints before being presented to users.

### Core Alpha Workflow

- Collect a student's meal requirements through natural language input.
- Process the request and generate a meal recommendation using the supplied menu data.
- Validate the recommendation against the available menu data and supported constraints.
- Return validation errors to the LLM when a recommendation fails validation.
- Display only recommendations that pass validation.
- Record the student's meal selection.

All new features should support this workflow or an explicitly approved future product requirement.

## 2. Architectural Principles

Follow these principles when implementing or modifying application functionality.

### Separation of Responsibilities

**Keep the following responsibilities logically separated:**

- User Input: Collect meal requirements, preferences, budget, timing, and location.
- Request Processing: Interpret and organize the student's requirements.
- LLM Integration: Generate recommendations using the supplied menu information and structured requirements.
- Recommendation Validation: Independently verify generated recommendations against actual menu data and supported constraints.
- Correction Handling: Communicate validation errors back to the LLM so it can correct invalid recommendations.
- Presentation: Display only validated recommendations to the student.
- Selection Tracking: Record the student's selected meal.

Do not combine unrelated responsibilities into a single large function or module.

### LLM Integration

The LLM should be used for tasks that benefit from natural language understanding and generation.

**Requirements:**

- Ground recommendations in the supplied menu data.
- Provide the model with relevant student requirements.
- Use structured outputs wherever practical.
- Handle malformed, incomplete, or unexpected model responses.
- Never assume that an LLM response is automatically correct.
- Do not allow generated recommendations to bypass validation.
- Keep model integration separate from deterministic business logic.
- Avoid hardcoding provider-specific behavior throughout the application.

### Recommendation Validation

Recommendation validation must be deterministic and implemented using ordinary application code rather than relying on the LLM to verify its own output.

**Validation should check applicable requirements, including:**

- Whether the recommended item exists in the supplied menu data.
- Whether the recommendation satisfies supported dietary constraints.
- Whether the recommendation respects supported budget constraints.
- Whether required recommendation fields are present.
- Whether generated values are consistent with the underlying menu information.

Only validated recommendations should be presented as verified results.

When validation fails, return actionable validation errors to the LLM for correction.

Do not silently accept invalid recommendations or invent missing menu information.

### Proposed Alpha Technology Stack

The repository currently has no application code, framework, dependency manifest, or established test runner. Use this as the proposed direction when implementation begins, and confirm it still fits the team and deployment requirements before adding dependencies:

- **Student interface:** React, TypeScript, and Vite for the student-facing meal request and recommendation flow.
- **Application API:** Python with FastAPI. Keep request processing, LLM integration, deterministic validation, and selection tracking in separate modules.
- **Data contracts:** Pydantic for API boundary schemas. Keep recommendation validation in deterministic application code; generated output must not bypass it.
- **Persistence:** PostgreSQL with SQLAlchemy for meal selections and menu records if persistent storage is needed. Use clearly labeled synthetic fixtures until an authoritative campus menu dataset is available.
- **LLM integration:** A provider-neutral adapter with structured outputs where supported. Mock model calls in automated tests and load credentials from environment configuration.
- **Testing:** Use Python's standard-library `unittest` for dependency-free backend logic, or adopt `pytest` if the project later establishes it as the test runner. For the React interface, use Vitest and Testing Library; use Playwright for critical end-to-end workflows.

These are recommendations, not installed or adopted dependencies. Do not add a framework or package until an issue requires it and the existing repository and deployment needs have been reviewed.

## 3. Repository Structure

**The currently established repository structure includes:**

- README.md — Project overview and Alpha workflow.
- AGENTS.md — Shared instructions for AI coding agents.
- docs/startup-proposals/ — Startup and product proposal documentation.

As the application develops, organize additional code and documentation according to the existing technology stack.

**Before creating new directories or reorganizing existing files:**

- Inspect the current repository structure.
- Identify existing conventions and reusable modules.
- Follow the existing architecture unless there is a documented reason to change it.
- Avoid introducing duplicate implementations.

Keep documentation organized and updated as the project evolves.

## 4. Coding Standards

**All generated and manually written code should follow these conventions:**

- Write readable, maintainable, and modular code.
- Use descriptive variable, function, class, and file names.
- Prefer small functions with clearly defined responsibilities.
- Avoid unnecessary duplication.
- Use existing project dependencies before introducing new libraries.
- Follow the formatting and linting conventions already established in the repository.
- Handle errors explicitly rather than silently ignoring failures.
- Validate external inputs and LLM responses.
- Avoid unnecessary abstractions and premature optimization.
- Add comments when explaining non-obvious business logic.
- Keep secrets, API keys, and credentials out of source control.
- Never log sensitive student information unnecessarily.

Do not introduce a new framework, package, dependency, or architectural pattern without first checking whether the project already has an equivalent solution.

### Dependency Management

**Before installing a dependency:**

- Inspect the existing dependency manifest.
- Check whether the functionality can be implemented using existing libraries.
- Prefer established and actively maintained packages.
- Update the appropriate dependency manifest and lockfile.
- Document any significant new dependency when appropriate.

Do not change package managers or runtime versions without an explicit reason.

## 5. GitHub Issues and User Stories

Every Alpha feature or bug fix must be associated with a GitHub issue.

**User stories should follow the standard format:**

> As a [role], I want [goal], so that [benefit].

**Use consistent issue identifiers:**

- [US-XX] — User stories and product functionality.
- [BUG-XX] — Bug fixes.
- [SETUP-XX] — Infrastructure and development setup.
- [TEST-XX] — Testing infrastructure and quality improvements.

**Each user story must include:**

- User story description.
- Business value.
- Explicit acceptance criteria.
- Relevant implementation considerations.
- Associated testing requirements.

Acceptance criteria should be measurable and independently testable.

**Where appropriate, identify tests as:**

- [unit]
- [integration]
- [e2e]

Every planned Alpha feature must map to at least one GitHub issue.

Avoid implementing untracked features without first creating or identifying the corresponding issue.

Reference relevant GitHub issue numbers in commits and pull requests.

## 6. Mandatory Test-Driven Development (TDD)

Follow test-driven development for all new Alpha functionality.

Tests must be written before production code.

**For every GitHub issue:**

- Review the user story and acceptance criteria.
- Identify expected behavior and relevant edge cases.
- Write tests covering the acceptance criteria.
- Run the tests and confirm that the new tests fail for the expected reason.
- Implement the minimum production code necessary to satisfy the tests.
- Rerun the tests and confirm they pass.
- Run the relevant regression tests.
- Refactor while keeping the test suite passing.

Do not write production code first and create tests afterward.

### Testing Requirements

Use the testing framework already established by the repository.

**Write appropriate:**

- Unit tests for individual functions and business logic.
- Integration tests for interactions between application components.
- End-to-end tests for important student-facing workflows.

**Test cases should cover:**

- Expected successful behavior.
- Invalid inputs.
- Missing or incomplete data.
- Unexpected LLM responses.
- Menu items that do not exist.
- Dietary or budget constraint violations.
- Recommendation validation failures.
- LLM correction behavior.
- Cases where no valid recommendation can be generated.

### LLM Testing

Automated tests must use mocked LLM responses rather than depending on live model API calls.

Use controlled menu fixtures so tests remain reproducible.

Test both valid and invalid model responses.

Test the recommendation validation and correction pipeline independently from the live LLM provider.

Evaluate live model behavior separately from deterministic automated tests.

### Test Naming and Issue Traceability

Use descriptive test names that make their purpose clear.

Where practical, include the associated user story or issue identifier in test names.

**Examples:**

- test_us01_generates_menu_grounded_recommendation
- test_us02_rejects_nonexistent_menu_item
- test_us03_rejects_budget_violation
- test_us04_returns_validation_errors_for_correction

Maintain a clear relationship between GitHub issues, acceptance criteria, tests, and implementation.

## 7. AI-Generated Test Attribution

The course requires reporting the ratio of AI-generated tests to manually refined or added tests.

Maintain accurate attribution.

**Distinguish between:**

- AI-generated tests accepted without substantive modification.
- AI-generated tests that were reviewed and substantively refined by a human.
- Tests independently written by a human.

Use a consistent repository convention to document human refinement or authorship, such as a # manual or // manual annotation where appropriate for the language.

Do not misrepresent test authorship.

Record test counts using the actual test suite rather than estimates.

**The team must be able to calculate:**

- Total automated tests.
- Tests per GitHub issue.
- AI-generated test count.
- Human-refined test count.
- Manually written test count.
- Automated test pass rate.
- Line code coverage.

## 8. Error Handling and Reliability

The application should fail safely and provide understandable feedback.

**Requirements:**

- Handle missing or malformed student input.
- Handle unavailable menu data.
- Handle model API failures.
- Handle malformed model responses.
- Handle failed recommendation validation.
- Prevent invalid recommendations from being displayed as verified.
- Avoid exposing internal errors or API credentials to users.

Do not fabricate menu items, nutrition information, prices, or availability.

If a recommendation cannot be validated, do not present it as a successful recommendation.

## 9. Documentation Requirements

Keep project documentation synchronized with the implementation.

**Update relevant documentation when changing:**

- Application architecture.
- Core Alpha functionality.
- LLM integration.
- Recommendation validation.
- Dependencies.
- Development setup.
- Testing procedures.
- User stories and acceptance criteria.

The README should remain the primary introduction to Hoos Eating.

The documentation should clearly explain the role of the LLM in the product and how recommendation validation protects the quality of generated results.

## 10. Git and Pull Request Guidelines

Use descriptive commit messages.

**Examples:**

- feat: implement natural language meal requests
- feat: add menu-grounded recommendations
- fix: reject invalid menu recommendations
- test: add recommendation validation coverage
- docs: update Alpha architecture

Reference GitHub issues when applicable.

**Pull requests should:**

- Reference the relevant GitHub issue.
- Describe the implementation.
- Explain significant design decisions.
- Include tests for the associated acceptance criteria.
- Report relevant test results.
- Avoid unrelated changes.

Do not claim that an issue is complete if its acceptance criteria or required tests remain unfinished.

## 11. Development and Test Commands

Do not assume a particular framework, language, or package manager.

**Before running commands:**

- Inspect the repository for dependency manifests and lockfiles.
- Identify the established development framework and testing tools.
- Inspect existing scripts and CI workflows.
- Use the project's documented commands.

**Keep the following commands documented and updated as the development environment becomes established:**

- Install dependencies.
- Start the application locally.
- Run the complete automated test suite.
- Run individual test files.
- Run linting and formatting.
- Generate line coverage reports.
- Build the application for production.

Never invent test results, coverage percentages, or successful build outcomes.

## 12. Alpha Development Priorities

Prioritize implementation according to the approved Alpha requirements and GitHub issues.

**The central Alpha objective is a complete working workflow:**

`Student Request → LLM Recommendation → Deterministic Validation → Correction if Needed → Validated Recommendation → Student Selection`

**Prioritize:**

- Reliable natural language meal requests.
- Accurate use of supplied menu data.
- Meaningful LLM-generated recommendations.
- Deterministic recommendation validation.
- Reliable correction handling.
- Clear presentation of validated recommendations.
- Student meal selection tracking.
- Automated test coverage for all Alpha functionality.

Avoid adding unrelated features that do not contribute to the Alpha MVP.

## 13. Instructions for AI Coding Agents

**When working on this repository:**

- Read this file before making changes.
- Inspect the relevant source files before proposing modifications.
- Follow the established architecture and coding conventions.
- Identify the relevant GitHub issue and acceptance criteria.
- Write tests before implementing production functionality.
- Never bypass recommendation validation.
- Never fabricate menu information or test results.
- Prefer minimal, targeted changes over unnecessary rewrites.
- Explain important implementation decisions.
- Report which tests were executed and whether they passed.
- Identify any remaining limitations or incomplete acceptance criteria.

If requirements are ambiguous, ask for clarification rather than inventing product behavior.

The goal is to produce reliable, testable, maintainable software while demonstrating disciplined AI-assisted test-driven development throughout the Alpha release.
