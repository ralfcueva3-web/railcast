import os
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager

import jwt
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.middleware.auth import JWTAuthMiddleware
from backend.models.predictor import predictor
from backend.models.schemas import HealthResponse, TokenResponse
from backend.routers.eta import router as eta_router
from backend.routers.live import router as live_router
from backend.routers import ntes
from backend.services.db_service import DatabaseService
from backend.services.redis_service import RedisService


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = DatabaseService()
    app.state.redis = RedisService()

    try:
        await app.state.db.connect()
    except Exception:
        app.state.db = None

    predictor.load()

    yield

    if app.state.db:
        await app.state.db.close()

    await app.state.redis.close()


app = FastAPI(
    title="RailCast API",
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

origins = [
    "http://localhost:5173",
    "https://railcast-xi.vercel.app",
    "https://railcast-git-main-ralf-cueva-s-projects.vercel.app",
]

extra_origins = os.getenv("CORS_ORIGINS", "")

if extra_origins:
    origins.extend(
        x.strip()
        for x in extra_origins.split(",")
        if x.strip()
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Authentication middleware
# ---------------------------------------------------------

app.add_middleware(JWTAuthMiddleware)


# ---------------------------------------------------------
# Routers
# ---------------------------------------------------------

app.include_router(eta_router)
app.include_router(live_router)
app.include_router(ntes.router)


# ---------------------------------------------------------
# Health
# ---------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health():
    db_ok = await app.state.db.ping() if app.state.db else False
    redis_ok = await app.state.redis.ping()

    return HealthResponse(
        status="ok"
        if db_ok and redis_ok and predictor.ready
        else "degraded",
        database="up" if db_ok else "down",
        redis="up" if redis_ok else "down",
        models="ready" if predictor.ready else "missing",
    )


# ---------------------------------------------------------
# Authentication
# ---------------------------------------------------------

@app.post("/auth/token", response_model=TokenResponse)
async def token(username: str, password: str):
    expected_user = os.getenv("AUTH_USERNAME", "railcast")
    expected_password = os.getenv("AUTH_PASSWORD", "railcast-demo")

    if username != expected_user or password != expected_password:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
        )

    exp = datetime.now(timezone.utc) + timedelta(hours=12)

    access_token = jwt.encode(
        {
            "sub": username,
            "exp": exp,
        },
        os.getenv("JWT_SECRET", "change-me"),
        algorithm="HS256",
    )

    return TokenResponse(
        access_token=access_token
    )


# ---------------------------------------------------------
# Root
# ---------------------------------------------------------

@app.get("/")
async def root():
    return {
        "service": "RailCast API",
        "problem_statement": "26028",
        "train": 13028,
    }