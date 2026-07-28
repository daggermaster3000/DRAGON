"""FastAPI entrypoint. Serves the JSON API under /api and, in production, the
built React PWA as static files (single container, one `docker compose up -d`)."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .routes import achievements, categories, dashboard, health, imports, quip, rules, stats, subscriptions, transactions
from .seed_loader import init_db

settings = get_settings()
app = FastAPI(title="Budget PWA", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.cors_origins == "*" else settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(imports.router)
app.include_router(dashboard.router)
app.include_router(transactions.router)
app.include_router(stats.router)
app.include_router(rules.router)
app.include_router(subscriptions.router)
app.include_router(categories.router)
app.include_router(health.router)
app.include_router(achievements.router)
app.include_router(quip.router)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "ai_provider": settings.ai_provider}


# --- Static frontend (present only in the production image) ---------------
_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if _STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=_STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):  # noqa: ARG001 - SPA fallback to index.html
        candidate = _STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_STATIC_DIR / "index.html")
