# Tabula

Tabula is a spreadsheet editor that records what you do to your data as a
replayable **workflow**: renaming a column, filtering rows, splitting a
column, converting types, and so on are all captured as declarative steps
while you edit — not just applied to the cells in front of you. That
recording is a first-class object: publish it with a name and tags, and
later run it again against a *different* spreadsheet to get the same
transformation applied automatically.

The project has three parts

| Part | What it is | Stack |
|---|---|---|
| **Frontend** (this directory) | The spreadsheet grid, the workflow-recording UI, the Editor/Workflows screens | React + TypeScript + Vite + Zustand + Tailwind |
| [`engine/`](engine) | A standalone Python library that runs the same workflow steps against real data with Polars — the reference implementation the frontend's operations are defined against | Python + Polars + Pydantic |
| [`server/`](server) | Accounts and the workflow catalog: register/login, publish a workflow with a name/tags/creator, list and filter by tag | FastAPI + SQLAlchemy (SQLite) + JWT |

## Features

- **Spreadsheet editing** — grid with typed columns (text/number/date/boolean), cell formatting, sort, filter, find & replace, multi-sheet workbooks, `.xlsx`/`.csv` import and export.
- **Workflow recording** — structural edits (rename/reorder/delete/add a column, change its type) and the operations under the **Operações** menu (filter rows, trim whitespace, fill null/constant, cast types, split/concat/extract/replace columns, math operations, rounding, padding, map-values, deduplicate, add column) are all recorded as steps on the sheet, viewable in the workflow panel.
- **Run a workflow elsewhere** — import a workflow `.json`, or reuse a sheet's own recorded steps, and apply it to another sheet or a freshly imported file; skipped/failed steps are reported individually rather than aborting the run.
- **Workflow catalog** — the **Workflows** screen (via the "Tabula" menu) lists workflows *published* to the server, grouped by tag, each showing its creator and step list. Publishing requires an account; only the creator can delete their own workflow.
- **Import → run → download** — pick a spreadsheet, run a catalog workflow on it, and download the result immediately, choosing the output filename and format (`.xlsx`/`.csv`).

## Getting started

### Run natively

Three processes, each in its own terminal:

```bash
# 1. Backend (accounts + workflow catalog) — from server/
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"   # first time only
.venv/Scripts/python -m uvicorn tabula_server.main:app --app-dir src --port 8420

# 2. Frontend — from the repo root
npm install   # first time only
npm run dev

# 3. Engine — no process to run; it's a library exercised by its own test suite
```

Open the frontend (Vite prints the URL, typically `http://localhost:5173`). It talks to the backend at `http://localhost:8420` by default — override with `VITE_API_BASE_URL` if the backend runs elsewhere.

### Run with Docker Compose

```bash
docker compose up
```

Builds and starts the frontend (`:5173`) and the backend (`:8420`) together, with source bind-mounted for hot reload and the SQLite catalog on a named volume so it survives `docker compose down`. Don't run this alongside native `npm run dev` / `uvicorn` processes on the same ports — stop one before starting the other.

Useful env vars for the backend (see [`server/src/tabula_server/security.py`](server/src/tabula_server/security.py) and [`main.py`](server/src/tabula_server/main.py)):

| Variable | Default | Purpose |
|---|---|---|
| `TABULA_DB_URL` | `sqlite:///./tabula.db` | Where the catalog is stored |
| `TABULA_SECRET_KEY` | a fixed dev value | JWT signing key — **set this before deploying anywhere beyond your own machine** |
| `TABULA_CORS_ORIGINS` | `*` | Comma-separated allowed origins |

## Project structure

```
src/                    Frontend
  model/                Sheet/workflow data model + types (mirrors the engine's operation registry)
  commands/              The command reducer — every user action goes through applyCommand()
  workflow/              Recording, describing, exporting/importing, and running workflow steps
  grid/                  The spreadsheet grid itself (selection, clipboard, cells)
  components/            Toolbar, menus, modals, the Editor and Workflows screens
  api/                   Client for server/ (auth + workflow catalog)
  store/                 Zustand stores (workbook state + undo history, auth session)

engine/src/tabula_engine/
  definition/             The declarative operation registry (OperationSpec subclasses) — the source of truth an operation's params
  engine/                 Polars compiler for each operation type
  execution/              Append-only Run records of a workflow execution
  io/                     Spreadsheet readers (xlsx/csv) with type inference

server/src/tabula_server/
  models.py, schemas.py  User + Workflow ORM models and API schemas
  security.py             Password hashing (PBKDF2) and JWT tokens
  main.py                 FastAPI routes
```

## Testing

```bash
# Frontend
npx tsc -b && npx oxlint src

# Engine
cd engine && .venv/Scripts/python -m pytest

# Server
cd server && .venv/Scripts/python -m pytest
```
