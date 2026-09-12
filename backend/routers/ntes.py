from fastapi import APIRouter, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
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
# DEMO HELPERS
# =========================================================

def get_demo_train(
    train_no: str,
):
    """
    Find a train inside the explicit demo station data.
    """

    train_no = str(train_no).strip()

    for station_code in ["RPH", "HWH"]:

        demo_data = get_demo_station_data(
            station_code
        )

        if not demo_data:
            continue

        for train in demo_data.get(
            "trains",
            [],
        ):

            if str(
                train.get("train_no", "")
            ).strip() == train_no:

                return train

    return None


def build_demo_train_status(
    train_no: str,
    date: str,
):
    """
    Build an explicitly labelled demo NTES-style
    train status response.
    """

    train = get_demo_train(
        train_no
    )

    if not train:
        return None

    source = (
        str(
            train.get("source")
            or ""
        )
        .strip()
        .upper()
    )

    destination = (
        str(
            train.get("destination")
            or ""
        )
        .strip()
        .upper()
    )

    source_name = (
        train.get("source_name")
        or source
    )

    destination_name = (
        train.get("destination_name")
        or destination
    )

    delay = int(
        train.get(
            "departure_delay",
            train.get(
                "arrival_delay",
                0,
            ),
        )
        or 0
    )

    return {
        "train_no": str(train_no),
        "date": str(date),

        "CPOS": (
            f"{source_name} "
            f"({source})"
        ),

        "LSTN": source,

        "STATUS": (
            f"Train is currently at "
            f"{source_name} ({source})."
        ),

        "STTS": (
            f"Running {delay} minutes "
            f"late."
        ),

        "train_name": train.get(
            "train_name"
        ),

        "source": source,
        "source_name": source_name,

        "destination": destination,
        "destination_name": destination_name,

        "delay_minutes": delay,

        "data_source": "DEMO_FALLBACK",
        "demo": True,
        "cached": False,

        "generated_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }


def build_demo_train_route(
    train_no: str,
    date: str,
):
    """
    Build a small deterministic demo route from
    the explicit demo station-board data.

    This is intentionally labelled DEMO_FALLBACK.
    """

    train = get_demo_train(
        train_no
    )

    if not train:
        return None

    source = (
        str(
            train.get("source")
            or ""
        )
        .strip()
        .upper()
    )

    destination = (
        str(
            train.get("destination")
            or ""
        )
        .strip()
        .upper()
    )

    source_name = (
        train.get("source_name")
        or source
    )

    destination_name = (
        train.get("destination_name")
        or destination
    )

    arrival_time = train.get(
        "scheduled_arrival"
    )

    departure_time = train.get(
        "scheduled_departure"
    )

    arrival_delay = int(
        train.get(
            "arrival_delay",
            0,
        )
        or 0
    )

    departure_delay = int(
        train.get(
            "departure_delay",
            0,
        )
        or 0
    )

    # -----------------------------------------------------
    # Avoid duplicate route stations.
    # -----------------------------------------------------

    if source == destination:

        route = [
            {
                "station_code": source,
                "station_name": source_name,
                "distance": 0,
                "scheduled_arrival": arrival_time,
                "scheduled_departure": departure_time,
                "actual_arrival": None,
                "actual_departure": None,
                "platform": train.get(
                    "platform"
                ),
                "arrival_delay": arrival_delay,
                "departure_delay": departure_delay,
                "is_current": True,
            }
        ]

    else:

        route = [
            {
                "station_code": source,
                "station_name": source_name,
                "distance": 0,
                "scheduled_arrival": None,
                "scheduled_departure": departure_time,
                "actual_arrival": None,
                "actual_departure": None,
                "platform": train.get(
                    "platform"
                ),
                "arrival_delay": 0,
                "departure_delay": departure_delay,
                "is_current": True,
            },
            {
                "station_code": destination,
                "station_name": destination_name,
                "distance": 200,
                "scheduled_arrival": arrival_time,
                "scheduled_departure": arrival_time,
                "actual_arrival": None,
                "actual_departure": None,
                "platform": None,
                "arrival_delay": 0,
                "departure_delay": 0,
                "is_current": False,
            },
        ]

    return {
        "train_no": str(train_no),
        "date": str(date),

        "route": route,

        "current_station": source,
        "current_station_name": source_name,

        "yet_to_start": False,

        "data_source": "DEMO_FALLBACK",
        "demo": True,
        "cached": False,

        "generated_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }


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

    # =====================================================
    # 1. TRY LIVE NTES
    # =====================================================

    try:

        data = ntes_service.get_train_status(
            train_no,
            date,
        )

        if isinstance(data, dict):

            data["data_source"] = "NTES_LIVE"
            data["cached"] = False
            data["demo"] = False

        return data

    except Exception as error:

        print(
            "RAILCAST NTES TRAIN STATUS ERROR:",
            str(error),
        )

    # =====================================================
    # 2. DEMO FALLBACK
    # =====================================================

    demo_status = build_demo_train_status(
        train_no,
        date,
    )

    if demo_status:

        print(
            "RAILCAST DEMO TRAIN STATUS:",
            train_no,
        )

        return demo_status

    raise HTTPException(
        status_code=502,
        detail=(
            "NTES train status request failed "
            "and no demo data exists for train "
            f"{train_no}."
        ),
    )


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

    # =====================================================
    # 1. TRY LIVE NTES
    # =====================================================

    try:

        data = ntes_service.get_train_route(
            train_no,
            date,
        )

        if isinstance(data, dict):

            data["data_source"] = "NTES_LIVE"
            data["cached"] = False
            data["demo"] = False

        return data

    except Exception as error:

        print(
            "RAILCAST NTES ROUTE ERROR:",
            str(error),
        )

    # =====================================================
    # 2. DEMO FALLBACK
    # =====================================================

    demo_route = build_demo_train_route(
        train_no,
        date,
    )

    if demo_route:

        print(
            "RAILCAST DEMO TRAIN ROUTE:",
            train_no,
        )

        return demo_route

    raise HTTPException(
        status_code=502,
        detail=(
            "NTES route request failed "
            "and no demo route exists for train "
            f"{train_no}."
        ),
    )