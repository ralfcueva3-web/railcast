from fastapi import APIRouter, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import json

from backend.services.ntes_service import NTESService
from backend.services.redis_service import RedisService
from backend.data.demo_station_data import get_demo_station_data


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/ntes",
    tags=["NTES"],
)


# =========================================================
# SERVICES
# =========================================================

ntes_service = NTESService()
redis_service = RedisService()

bearer_scheme = HTTPBearer()


# =========================================================
# CACHE CONFIGURATION
# =========================================================

STATION_CACHE_TTL = 300


def station_cache_key(
    station_code: str,
    hours: int,
) -> str:
    return (
        f"station:{station_code}:"
        f"live:{hours}"
    )


# =========================================================
# STATION LIVE TRAINS
# =========================================================

@router.get("/station/{station_code}")
async def get_station_trains(
    station_code: str,
    credentials: HTTPAuthorizationCredentials = Security(
        bearer_scheme
    ),
):
    """
    Station live-board endpoint.

    Priority:

        1. NTES live
        2. Redis cache
        3. Explicit demo fallback

    data_source tells the frontend which source
    produced the response.
    """

    station_code = (
        str(station_code)
        .strip()
        .upper()
    )

    if not station_code:
        raise HTTPException(
            status_code=400,
            detail="Station code is required.",
        )

    hours = 4

    cache_key = station_cache_key(
        station_code,
        hours,
    )

    # =====================================================
    # 1. TRY LIVE NTES
    # =====================================================

    try:

        data = ntes_service.get_station_trains(
            station_code,
            hours=hours,
        )

        data["data_source"] = "NTES_LIVE"
        data["cached"] = False
        data["demo"] = False

        # -------------------------------------------------
        # Save successful NTES response to Redis.
        # -------------------------------------------------

        try:

            await redis_service.client.setex(
                cache_key,
                STATION_CACHE_TTL,
                json.dumps(data),
            )

            print(
                "RAILCAST STATION CACHE SAVED:",
                station_code,
            )

        except Exception as cache_error:

            print(
                "RAILCAST STATION CACHE SAVE ERROR:",
                str(cache_error),
            )

        return data

    except Exception as ntes_error:

        print(
            "\nRAILCAST NTES UNAVAILABLE"
        )

        print(
            "Station:",
            station_code,
        )

        print(
            "Error:",
            str(ntes_error),
        )

    # =====================================================
    # 2. TRY REDIS CACHE
    # =====================================================

    try:

        cached_raw = await (
            redis_service.client.get(
                cache_key
            )
        )

        if cached_raw:

            cached_data = json.loads(
                cached_raw
            )

            cached_data["data_source"] = (
                "REDIS_CACHE"
            )

            cached_data["cached"] = True
            cached_data["demo"] = False

            print(
                "RAILCAST STATION CACHE HIT:",
                station_code,
            )

            return cached_data

        print(
            "RAILCAST STATION CACHE MISS:",
            station_code,
        )

    except Exception as cache_error:

        print(
            "RAILCAST REDIS STATION ERROR:",
            str(cache_error),
        )

    # =====================================================
    # 3. DEMO FALLBACK
    # =====================================================

    demo_data = get_demo_station_data(
        station_code
    )

    if demo_data:

        print(
            "RAILCAST DEMO FALLBACK:",
            station_code,
        )

        return demo_data

    # =====================================================
    # NOTHING AVAILABLE
    # =====================================================

    raise HTTPException(
        status_code=503,
        detail={
            "message": (
                "Live NTES data is unavailable, "
                "no cached data exists, and no demo "
                "data is configured for this station."
            ),
            "station_code": station_code,
            "data_source": "UNAVAILABLE",
        },
    )


# =========================================================
# TRAIN LIVE STATUS
# =========================================================

@router.get("/train/{train_no}")
async def get_train_status(
    train_no: str,
    date: str,
    credentials: HTTPAuthorizationCredentials = Security(
        bearer_scheme
    ),
):
    """
    Return detailed NTES live status for a train.
    """

    train_no = str(
        train_no
    ).strip()

    date = str(
        date
    ).strip()

    if not train_no:
        raise HTTPException(
            status_code=400,
            detail="Train number is required.",
        )

    if not date:
        raise HTTPException(
            status_code=400,
            detail="Date is required.",
        )

    try:

        return ntes_service.get_train_status(
            train_no,
            date,
        )

    except Exception as error:

        print(
            "RAILCAST NTES TRAIN STATUS ROUTER ERROR:",
            str(error),
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "NTES train status request failed. "
                f"{str(error)}"
            ),
        ) from error


# =========================================================
# TRAIN ROUTE
# =========================================================

@router.get("/train/{train_no}/route")
async def get_train_route(
    train_no: str,
    date: str,
    credentials: HTTPAuthorizationCredentials = Security(
        bearer_scheme
    ),
):
    """
    Return normalized dynamic NTES route.
    """

    train_no = str(
        train_no
    ).strip()

    date = str(
        date
    ).strip()

    if not train_no:
        raise HTTPException(
            status_code=400,
            detail="Train number is required.",
        )

    if not date:
        raise HTTPException(
            status_code=400,
            detail="Date is required.",
        )

    try:

        return ntes_service.get_train_route(
            train_no,
            date,
        )

    except Exception as error:

        print(
            "RAILCAST NTES ROUTE ROUTER ERROR:",
            str(error),
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "NTES route request failed. "
                f"{str(error)}"
            ),
        ) from error