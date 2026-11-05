# LLMs-Project

Final project for LLMs and Software Engineering.

## Hoos Eating

Hoos Eating helps University of Virginia students describe their nutrition goals, budget, location, timing, and dietary preferences in natural language and receive suitable campus meal recommendations.

The Alpha workflow is:

1. Describe a meal need.
2. Generate a recommendation using supplied menu data.
3. Validate the recommendation against the menu data and supported constraints.
4. Return validation errors to the model for correction when needed.
5. Display only recommendations that pass validation.
6. Record the student's meal selection.

See [AGENTS.md](AGENTS.md) for the proposed technology stack, architecture, coding conventions, and development workflow.

## Development setup — #14 [SETUP-01]

This scaffold adopts React + TypeScript + Vite for the web interface and Python
3.12 + FastAPI + Pydantic for the API. npm manages the frontend lockfile;
`backend/requirements.txt` pins the backend environment. Vitest + Testing Library
cover the interface; standard-library unittest + FastAPI TestClient cover the API.
ESLint/Prettier and Ruff provide linting/formatting. Coverage reports use V8 and
coverage.py. No recommendation, model call, menu dataset, or persistence is implemented yet.

### Prerequisites and installation

Use Node 22.12 or newer in the Node 22 release line, npm, and Python 3.12.
With nvm installed, `nvm install` and `nvm use` from this directory select Node 22.
If macOS reports a missing ICU library from Homebrew Node, select a working nvm
installation rather than using the broken Homebrew executable.

From the repository root:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm ci
```

On Windows, use `.venv\Scripts\python.exe` instead of `.venv/bin/python`.

### Start locally

In one terminal, from the repository root:

```sh
.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd frontend
npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173).
If port 8000 is occupied, stop your own conflicting service or choose another
port and update the target in `frontend/vite.config.ts` to match.
API documentation: http://127.0.0.1:8000/docs.
Health endpoint: http://127.0.0.1:8000/api/health returns `{"status":"ok"}`.
Vite proxies `/api` to the local backend, so development needs no CORS policy change.
The landing screen is explicitly a development preview; it does not generate meals.

### Tests and checks

From `frontend/`:

```sh
npm test
npm test -- src/App.test.tsx
npm run test:coverage
npm run lint
npm run format:check
npm run build
```

From `backend/`:

```sh
../.venv/bin/python -m unittest discover -s tests -v
../.venv/bin/python -m unittest discover -s tests -p test_health.py -v
../.venv/bin/python -m coverage run -m unittest discover -s tests -v
../.venv/bin/python -m coverage report
../.venv/bin/python -m ruff check .
../.venv/bin/python -m ruff format --check .
```

Run both suites for the complete automated test suite. To format intentionally,
run `npm run format` in `frontend/` and `../.venv/bin/python -m ruff format .` in
`backend/`. GitHub Actions runs lint, formatting, coverage tests, and the frontend
production build. CI runs only after changes are pushed; local preparation does
not execute GitHub Actions.

`npm run build` produces `frontend/dist/`; `npm run preview` previews that build.
The Python backend does not require compilation. Deployment is not configured:
a future host must serve static assets and route `/api` to the ASGI backend.
Playwright will be added with the first interactive Alpha workflow, not for this
static scaffold.

### Accounts, API keys, and data

**Nothing to sign up for or configure to run this scaffold. No environment
variables are required or read.** No `.env` file is needed.

For later Alpha issues:

- Choose an LLM provider as a team. Live model calls will need that provider's
  account, API key, and possibly billing. No provider is selected or integrated
  here; credentials must remain backend-only. Tests will mock model responses.
- Obtain an authoritative UVA menu dataset or confirm permission/access to a
  dining data source. No campus-menu API access is assumed. Until then, use
  explicitly labeled synthetic fixtures and never present them as live menus.
- PostgreSQL + SQLAlchemy are deferred until persistent menu/selection storage
  is implemented. Local PostgreSQL would not require a cloud account; a hosted
  database would require selecting a service.
- Hosting accounts are needed only when the team chooses deployment platforms.

Do not put secrets into frontend code or `VITE_*` variables: those are public in
built client assets. Concrete credential variable names will be documented when
a provider is adopted. `.env` files are ignored as a precaution, not configured.

### Architecture and next steps

- `frontend/src/`: presentation shell and interface smoke test.
- `backend/app/`: application entry point and typed health response.
- `backend/tests/`: API smoke tests.
- `.github/workflows/checks.yml`: matching frontend/backend checks.

When implementing tracked Alpha issues, keep request processing, provider-neutral
LLM integration, deterministic validation, correction handling, and selection
tracking in separate modules. Only validated recommendations may reach the UI.
Do not build those features into the health endpoint or placeholder shell.

### Test attribution

The initial suite has **3 AI-generated tests** for #14: one frontend smoke test
and two backend tests. Human-refined: **0**. Independently human-written: **0**.
Authorship is annotated in each test file. AI review and import formatting do not
count as human refinement. Update these counts using actual test output when
adding tests or recording substantive human review. Coverage currently measures
the application shell and backend app, not unimplemented Alpha features or the
browser bootstrap. See [setup validation](docs/setup-validation.md) for results.
