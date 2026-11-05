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

```sh
.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload
```

Start the frontend in another terminal:

```sh
cd frontend
npm run dev
```

Open [localhost:5173](http://localhost:5173). API docs are at [localhost:8000/docs](http://localhost:8000/docs).

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
