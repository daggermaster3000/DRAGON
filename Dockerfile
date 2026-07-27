# --- Stage 1: build the React PWA ---------------------------------------
FROM node:22-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python backend that also serves the built PWA -------------
FROM python:3.12-slim AS app
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/app ./app
# Built frontend lands at /app/static, which main.py serves as the SPA.
COPY --from=frontend /fe/dist ./static

EXPOSE 8000
# 2 workers is plenty for a single-user Pi; keeps memory low.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
