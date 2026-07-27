# Budget Dragon 🐉

Self-hosted budgeting PWA — **YNAB meets Habitica meets Pokémon**. Upload the
Excel export from your bank, watch RPG health-bars fill per category, and raise a
pixel dragon that evolves as your finances improve. Runs entirely on your
Raspberry Pi; no financial data leaves the device unless you opt into cloud AI.

> **MVP status.** This is Pass 1 — a complete, runnable vertical slice:
> upload → parse → classify → store → dashboard (lifebars + dragon). Charts,
> transactions editing UI, rules editor, achievements, and forecasting are
> scaffolded in the backend and land in later passes (see [Roadmap](#roadmap)).

## Quick start (Raspberry Pi / production)

```bash
cp .env.example .env          # defaults are fine for local-only use
docker compose up -d
# first time only — pull the local classification model:
docker compose exec ollama ollama pull llama3.2
```

Open `http://<pi-ip>:8000`, click **Upload statement**, pick your
`Assistant_financier-Transactions_*.xlsx` export. Done.

- The SQLite database + nightly backups live in `./data` (a mounted volume).
- To run **without any AI**, set `AI_PROVIDER=rules` in `.env` and you can
  delete the `ollama` service from `docker-compose.yml`. Deterministic rules +
  the bank's own categories already classify ~85% of transactions.

## Local development (macOS)

Two terminals:

```bash
# backend
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
AI_PROVIDER=rules DATA_DIR=./data uvicorn app.main:app --reload --port 8000

# frontend (proxies /api to :8000)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

## How classification works

Each transaction runs through a pipeline, cheapest/most-certain first:

1. **Merchant rules** — substring matches (Migros → Groceries, SBB → Mobility …).
   Seeded from `backend/app/seed/budget_seed.json`; user-editable later.
2. **Bank category map** — the export already tags most rows (French); mapped to
   your budget categories deterministically.
3. **AI provider** — only the leftovers (ambiguous "Paiements", "Général", unknown
   merchants) are batched to Ollama (local) or OpenAI (cloud, opt-in).
4. **Fallback** — anything still unresolved is stored `unclassified` and flagged
   `needs_review`. Imports never fail because AI is down.

The provider is a swappable abstraction (`backend/app/classify/`) — add a new
LLM by dropping in one file.

## The dragon

Derived from your real numbers (`backend/app/dragon.py`):

| | Trigger |
|---|---|
| **Baby → Young → Adult → Legendary** | cumulative net saved, gated by ≥90% budget adherence |
| **excited** | just after an upload |
| **angry** | a category is over budget |
| **sleepy** | no transactions in 14 days (finances neglected) |
| **happy** | positive net this month |

Sprites are modular matrices in `frontend/src/dragonSprites.ts` — add a new pet
by adding one sprite set, nothing else changes.

## The budget

Categories and monthly amounts are extracted from your `Budget-Tool.xlsm`
(`Hilfstabelle` sheet) into `backend/app/seed/budget_seed.json`. Re-run after
editing the workbook:

```bash
cd backend/app/seed
python3 generate_seed.py /path/to/Budget-Tool.xlsm
```

## Architecture

```
budget-pwa/
├── backend/          FastAPI + SQLAlchemy + SQLite
│   └── app/
│       ├── parser.py        bank .xlsx → normalized rows (pluggable per format)
│       ├── classify/        provider abstraction (rules / ollama / openai)
│       ├── budget_calc.py   spend-vs-budget lifebar rollups
│       ├── dragon.py        finances → dragon stage + mood
│       ├── routes/          /api/import, /api/dashboard, /api/transactions …
│       └── seed/            budget_seed.json + generator
├── frontend/         React + TS + Vite + Tailwind + PWA (offline-installable)
├── Dockerfile        multi-stage: build PWA → serve from FastAPI (one image)
└── docker-compose.yml  app + ollama + nightly backup
```

Data model (`backend/app/models.py`): Transactions, Categories, MerchantRules,
BankCategoryMap, DragonState, ImportBatches, Settings — all in one SQLite file.
Migration path to PostgreSQL is a URL change (SQLAlchemy 2.0, no raw SQL).

## Roadmap

- **Pass 2** — Chart.js statistics, transactions page (search/filter/split/bulk),
  visual rules editor, subscription detection.
- **Pass 3** — achievements + cosmetic skins, forecasting (reuse the Monte-Carlo
  engine in `../strategy/`), monthly "boss battle" summary, PDF/Excel export,
  background import processing.

## Security

- Everything local by default. `AI_PROVIDER=ollama` keeps classification on-device.
- Cloud OpenAI is opt-in (`AI_PROVIDER=openai`) and sends only payee strings.
- API keys live in `.env` (gitignored). No telemetry.
