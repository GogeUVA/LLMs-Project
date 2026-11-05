# Setup validation — #14 [SETUP-01]

## Executed locally

The default Homebrew Node executable fails because an ICU library is missing.
Checks used the existing `/Users/evin/.nvm/versions/node/v22.16.0/bin/node`
executable directly, without changing shell configuration or environment variables.
In the commands below, `NODE` denotes that full executable path, not an environment
variable that was created. `NPM` denotes
`/Users/evin/.nvm/versions/node/v22.16.0/lib/node_modules/npm/bin/npm-cli.js`.

From `frontend/`:

- `NODE NPM ci --ignore-scripts --no-audit`: passed; recreated node_modules from the lockfile.
- `NODE node_modules/vitest/vitest.mjs run --coverage`: passed, 1 test, 100% measured shell line coverage.
- `NODE node_modules/eslint/bin/eslint.js .`: passed.
- `NODE node_modules/prettier/bin/prettier.cjs --check .`: passed.
- `NODE node_modules/typescript/bin/tsc --noEmit`: passed.
- `NODE node_modules/vite/bin/vite.js build`: passed.

From `backend/`:

- `../.venv/bin/python -m coverage run -m unittest discover -s tests -v`: passed, 2 tests.
- `../.venv/bin/python -m coverage report`: passed, 100% of 9 measured app statements.
- `../.venv/bin/python -m ruff check .`: passed after import sorting.
- `../.venv/bin/python -m ruff format --check .`: passed.

Both suites were run before production code and failed on their missing application
imports. Tests were reviewed for scope, deterministic assertions, and no live APIs
before implementation. All 3 tests are AI-generated; none are attributed to humans.

## Limitations

- `npm audit fix --ignore-scripts` exits 1 with 10 moderate findings through the
  lint tooling's transitive minimatch dependency. Critical findings from the initial
  test-tool selection were resolved by selecting current Vitest. No forced downgrade
  or unverified dependency override was applied. Review upstream lint-tool updates
  before adopting the scaffold as a maintained production project.
- FastAPI's resolved Starlette TestClient emits a deprecation warning for httpx;
  tests pass. Revisit its test-client dependency during a future dependency update.
- The browser rendered the landing page successfully and its layout was visually
  inspected at the available viewport. Mobile-device testing was not performed.
- Port 8000 was already occupied. This API was started on port 8001 for direct
  health verification. The default Vite-to-port-8000 proxy was not integration-tested.
- `npm ci` with lifecycle scripts enabled, a full separate clean checkout, and
  GitHub Actions were not run. Frontend installation was verified using
  `--ignore-scripts`; the backend used a new repository-local virtual environment.
- Coverage is limited to the tiny implemented shell/health endpoint, not future
  recommendations, provider adapters, validation, or browser bootstrap.
- No commit, push, PR, deployment, credential changes, or external service setup
  was performed.
