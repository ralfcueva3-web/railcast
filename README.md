# RailCast — Dynamic ETA Forecast for Coaching Trains

**Smart India Hackathon 2026 · Problem Statement 26028 · Ministry of Railways · Smart Automation**

RailCast is a real-time machine-learning ETA forecasting prototype for Indian Railways coaching trains. The pilot route is **13028 Kaviguru Express**, evaluated from **Nalhati Junction (NHT) to Howrah Junction (HWH)**. The system chains segment-level XGBoost regressors with an LSTM sequence model, producing an ensemble ETA and an uncertainty band (P10/P50/P90).

> **Data note:** the included 700-row dataset is synthetic training data designed for development and demonstration. It must not be represented as official Indian Railways operational data.

## Route used by the pilot

| Station | Code | Cumulative km | Scheduled arrival | Platform |
|---|---|---:|---:|---:|
| Nalhati Junction | NHT | 45 | 08:45 | 1 |
| Rampur Hat | RPH | 59 | 09:10 | 3 |
| Sainthia Junction | SNT | 87 | 09:34 | 4 |
| Ahmadpur Junction | AMP | 101 | 09:47 | 2 |
| Bolpur Shantiniketan | BHP | 120 | 10:05 | 2 |
| Barddhaman Junction | BWN | 171 | 11:27 | 5 |
| Bandel Junction | BDC | 239 | 12:40 | 3 |
| Howrah Junction | HWH | 278 | 13:55 | 1 |

The schedule and route reference were cross-checked against current public timetable sources. citeturn0search0turn0search3

## Architecture

```text
                 ┌─────────────────────────┐
                 │ React + TypeScript UI   │
                 │ Passenger / Staff View  │
                 └────────────┬────────────┘
                              │ REST + WebSocket
                 ┌────────────▼────────────┐
                 │ FastAPI API             │
                 │ JWT · Pydantic · CORS   │
                 └──────┬─────────┬────────┘
                        │         │
              ┌─────────▼───┐ ┌──▼───────────┐
              │ Redis        │ │ PostgreSQL   │
              │ live state   │ │ history      │
              └──────────────┘ └──────────────┘
                        │
                 ┌──────▼───────────────┐
                 │ RailCast Predictor   │
                 │ XGBoost per segment  │
                 │ + LSTM sequence      │
                 │ → stacking ensemble  │
                 │ → P10 / P50 / P90    │
                 └──────────────────────┘
```

## ML pipeline

1. `ml/generate_data.py` creates 100 synthetic journeys × 7 segments = **700 rows**.
2. `ml/train_xgboost.py` trains one regression pipeline for each segment.
3. `ml/train_lstm.py` trains a sequence model over station-to-station delay states.
4. `backend/models/predictor.py` chains the segment predictions. XGBoost contributes 65% and LSTM 35% to the ensemble.
5. Uncertainty is estimated from model disagreement and a calibrated development heuristic. This is a prototype confidence interval, not a statistically validated operational forecast interval.

## Setup

### 1. Train the models

```bash
cd railcast
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate

pip install -r backend/requirements.txt
python ml/generate_data.py
python ml/train_xgboost.py
python ml/train_lstm.py
python ml/evaluate.py
```

The model binaries are intentionally ignored by Git. For deployment, store them in an artifact registry/object store or build them into a controlled model image.

### 2. Start PostgreSQL + Redis

```bash
docker compose up -d postgres redis
```

### 3. Start FastAPI

```bash
export DATABASE_URL=postgresql://railcast:railcast@localhost:5432/railcast
export REDIS_URL=redis://localhost:6379/0
export JWT_SECRET='use-a-long-random-production-secret'
uvicorn backend.main:app --reload --port 8000
```

Windows PowerShell:

```powershell
$env:DATABASE_URL="postgresql://railcast:railcast@localhost:5432/railcast"
$env:REDIS_URL="redis://localhost:6379/0"
$env:JWT_SECRET="use-a-long-random-production-secret"
uvicorn backend.main:app --reload --port 8000
```

### 4. Start everything with Compose

```bash
docker compose up --build
```

The backend is available at `http://localhost:8000`.

## Authentication

The API uses JWT. Obtain a development token:

```bash
curl -X POST "http://localhost:8000/auth/token?username=railcast&password=railcast-demo"
```

Set the returned token as:

```bash
export VITE_API_TOKEN='<token>'
```

For production, configure `AUTH_USERNAME`, `AUTH_PASSWORD`, and a strong `JWT_SECRET` through a secret manager.

## API

### `GET /eta/{train_no}/{station_code}`

Returns upcoming station ETAs from the requested current station.

Example:

```text
GET /eta/13028/NHT
Authorization: Bearer <JWT>
```

Response shape:

```json
{
  "train_no": 13028,
  "generated_at": "2026-09-09T08:00:00Z",
  "current_station": "NHT",
  "current_delay_minutes": 4.0,
  "model_confidence": 82.4,
  "insight": "Ensemble predicts stable recovery after current station.",
  "predictions": [
    {
      "station": {"code":"RPH","name":"Rampur Hat","distance_km":59},
      "eta": "2026-09-09T03:43:00Z",
      "delay_minutes": 5.8,
      "confidence": {
        "p10": "...",
        "p50": "...",
        "p90": "...",
        "width_minutes": 11.4
      },
      "status": "on_time"
    }
  ]
}
```

### `WS /live/{train_no}`

Streams live predictions. The prototype pushes every 120 seconds.

```text
ws://localhost:8000/live/13028
```

For a production deployment, authenticate the WebSocket during the connection handshake and place the token in a secure short-lived mechanism rather than a long-lived URL query parameter.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Passenger view:

```text
http://localhost:5173/
```

Staff dashboard:

```text
http://localhost:5173/dashboard
```

Set:

```text
VITE_API_BASE_URL=http://localhost:8000
VITE_API_TOKEN=<jwt>
```

## Project structure

```text
railcast/
├── frontend/       # React + TypeScript + Tailwind
├── backend/        # FastAPI + JWT + Redis + PostgreSQL
├── ml/             # synthetic data + XGBoost + LSTM
├── database/       # schema and seed
├── .github/        # CI/CD
└── docker-compose.yml
```

## Production hardening roadmap

- Replace synthetic data with authorized NTES/railway operational feeds.
- Add model/version registry, artifact checksums and rollback.
- Calibrate P10/P50/P90 using held-out historical residuals or conformal prediction.
- Add route-wide feature store for weather, congestion, block sections, crossings and upstream train interactions.
- Authenticate WebSocket handshakes.
- Add rate limiting, structured logs, OpenTelemetry traces and Prometheus metrics.
- Add automated model drift checks and scheduled retraining.
- Add PostgreSQL migrations instead of one-shot initialization scripts.
- Use managed PostgreSQL/Redis and a secret manager in production.
