# Hoos Eating

A campus meal recommendation app for University of Virginia students, built for LLMs and Software Engineering. The app will use natural-language requests and validate AI recommendations against menu data.

## Tech stack

- Frontend: React, TypeScript, Vite
- Backend: Python, FastAPI

## Setup

```sh
git clone https://github.com/GogeUVA/LLMs-Project.git
cd LLMs-Project
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm ci
```

## Run locally

Start the backend from the repository root:

Set `GROQ_API_KEY` before starting the backend to enable meal recommendations.

```sh
.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload
```

Start the frontend in another terminal:

```sh
cd frontend
npm run dev
```

Open [localhost:5173](http://localhost:5173). API docs are at [localhost:8000/docs](http://localhost:8000/docs).

For sign-in and profile sync, see [account setup](docs/accounts.md).

Try “Find a meal at The Halal Shack with at least 30 grams of protein.” The app
checks recommendations against the supplied menu. The current flow assumes
students use a meal exchange. Check Grubhub for item eligibility while the
exchange menu data is being added. See the [meal constraint policy](docs/meal-constraints.md).

The recommendation model receives only the eligible meals' menu facts, without
per-field source provenance, so broad requests stay within the provider's token
limit. Validation and the displayed result still use the full sourced records.

## Meal selections

Students can select a recommendation only after it has been displayed as a
validated result. The Alpha interface records the meal ID, a browser-session
identifier, the selection timestamp, and whether the choice changed within the
same session. Repeated clicks on the same choice do not create duplicate
records. These records describe in-app selections, not purchases or consumed
meals.

Selection records currently remain in browser storage on that device. They are
not synchronized to a server and are removed if the relevant browser storage is
cleared.

## Alternative recommendations

A displayed recommendation includes a **Try another meal** action. The
alternative request keeps the original request and preferences, excludes meals
already rejected in that request, and runs the remaining candidates through the
same constraint checks. If no eligible alternative remains, the interface says
so without relaxing the student's constraints.

## Tests

Frontend:

```sh
cd frontend
npm test
```

Backend, from the repository root:

```sh
cd backend
../.venv/bin/python -m unittest discover -s tests -v
```

## Production build

```sh
cd frontend
npm run build
```

Build output is saved to `frontend/dist/`.

See [AGENTS.md](AGENTS.md) for development guidelines and [setup validation](docs/setup-validation.md) for additional checks.
