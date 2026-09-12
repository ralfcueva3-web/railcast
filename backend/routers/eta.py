from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import re

from fastapi import APIRouter, Depends, HTTPException, Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.models.predictor import predictor
from backend.models.schemas import ETAPrediction, LiveTrainState
from backend.services.redis_service import RedisService
from backend.services.ntes_service import NTESService
from backend.data.demo_station_data import get_demo_station_data


router = APIRouter(
    prefix="/eta",
    tags=["ETA"],
)

bearer_scheme = HTTPBearer()

ntes_service = NTESService()

IST = ZoneInfo("Asia/Kolkata")


def get_redis(request: Request) -> RedisService:
    return request.app.state.redis


# =============================================================
# NTES DATE
# =============================================================

def _today_ntes_date() -> str:
    now = datetime.now(IST)

    months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ]

    return (
        f"{str(now.day).zfill(2)}-"
        f"{months[now.month - 1]}-"
        f"{now.year}"
    )


# =============================================================
# DEMO FALLBACK HELPERS
# =============================================================

def _get_demo_train(train_no: str):
    """
    Find a train in the explicit demo station data.
    """

    train_no = str(train_no).strip()

    for station_code in ["RPH", "HWH"]:

        demo_data = get_demo_station_data(
            station_code
        )

        if not demo_data:
            continue

        for train in demo_data.get("trains", []):

            if (
                str(
                    train.get("train_no", "")
                ).strip()
                == train_no
            ):
                return train

    return None


def _build_demo_route(
    train_no: str,
    date: str,
):
    """
    Build a deterministic demo route when NTES is
    unavailable.

    The response is explicitly marked as DEMO_FALLBACK.
    """

    train = _get_demo_train(train_no)

    if not train:
        return None

    source = (
        str(
            train.get("source") or ""
        )
        .strip()
        .upper()
    )

    destination = (
        str(
            train.get("destination") or ""
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

    arrival_delay = int(
        train.get("arrival_delay", 0)
        or 0
    )

    departure_delay = int(
        train.get("departure_delay", 0)
        or 0
    )

    scheduled_arrival = (
        train.get("scheduled_arrival")
    )

    scheduled_departure = (
        train.get("scheduled_departure")
    )

    platform = train.get("platform")

    # ---------------------------------------------------------
    # Demo route
    # ---------------------------------------------------------

    route = [
        {
            "station_code": source,
            "station_name": source_name,
            "distance": 0,
            "scheduled_arrival": None,
            "scheduled_departure": scheduled_departure,
            "actual_arrival": None,
            "actual_departure": None,
            "platform": platform,
            "arrival_delay": arrival_delay,
            "departure_delay": departure_delay,
            "is_current": True,
        },
        {
            "station_code": destination,
            "station_name": destination_name,
            "distance": 200,
            "scheduled_arrival": scheduled_arrival,
            "scheduled_departure": scheduled_arrival,
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
        "delay": departure_delay,
        "yet_to_start": False,
        "data_source": "DEMO_FALLBACK",
        "demo": True,
        "cached": False,
        "generated_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }


def _build_demo_status(
    train_no: str,
    date: str,
):
    """
    Build deterministic demo live-status data.
    """

    train = _get_demo_train(train_no)

    if not train:
        return None

    source = (
        str(
            train.get("source") or ""
        )
        .strip()
        .upper()
    )

    source_name = (
        train.get("source_name")
        or source
    )

    destination = (
        str(
            train.get("destination") or ""
        )
        .strip()
        .upper()
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
            f"Running {delay} minutes late."
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


# =============================================================
# CPOS CODE EXTRACTION
# =============================================================

def _extract_cpos_code(cpos: str) -> str:

    if not cpos:
        return ""

    match = re.search(
        r"\(([A-Za-z0-9]{2,6})\)",
        str(cpos),
    )

    if not match:
        return ""

    return (
        str(match.group(1))
        .strip()
        .upper()
    )


# =============================================================
# CPOS NAME EXTRACTION
# =============================================================

def _extract_cpos_name(
    cpos: str,
    code: str,
) -> str:

    if not cpos or not code:
        return ""

    match = re.search(
        r"(?:from|at)\s+(.+?)\(([A-Za-z0-9]{2,6})\)",
        str(cpos),
        flags=re.IGNORECASE,
    )

    if not match:
        return ""

    extracted_code = (
        str(match.group(2))
        .strip()
        .upper()
    )

    if extracted_code != code.strip().upper():
        return ""

    return (
        str(match.group(1))
        .strip()
    )


# =============================================================
# ROUTE HELPERS
# =============================================================

def _route_codes(
    route: list[dict],
) -> list[str]:

    return [
        (
            str(
                item.get(
                    "station_code",
                    "",
                )
                or ""
            )
            .strip()
            .upper()
        )
        for item in route
    ]


def _latest_visited_index(
    route: list[dict],
) -> int:

    visited_indexes = []

    for index, station in enumerate(route):

        actual_arrival = station.get(
            "actual_arrival"
        )

        actual_departure = station.get(
            "actual_departure"
        )

        if (
            actual_arrival
            or actual_departure
        ):
            visited_indexes.append(index)

    if not visited_indexes:
        return -1

    return max(visited_indexes)


def _find_route_station_index(
    route: list[dict],
    station_code: str,
) -> int:

    target = (
        station_code
        or ""
    ).strip().upper()

    for index, station in enumerate(route):

        code = (
            str(
                station.get(
                    "station_code",
                    "",
                )
                or ""
            )
            .strip()
            .upper()
        )

        if code == target:
            return index

    return -1


def _first_unvisited_index(
    route: list[dict],
) -> int:

    for index, station in enumerate(route):

        actual_arrival = station.get(
            "actual_arrival"
        )

        actual_departure = station.get(
            "actual_departure"
        )

        if (
            not actual_arrival
            and not actual_departure
        ):
            return index

    return -1


# =============================================================
# INSERT LIVE CPOS INTO ROUTE
# =============================================================

def _insert_live_position_into_route(
    route: list[dict],
    live_code: str,
    live_name: str,
    route_data: dict,
) -> tuple[list[dict], str]:

    if not live_code:
        return route, ""

    normalized_route = [
        dict(item)
        for item in route
    ]

    codes = _route_codes(
        normalized_route
    )

    if live_code in codes:
        return (
            normalized_route,
            live_code,
        )

    next_unvisited_index = (
        _first_unvisited_index(
            normalized_route
        )
    )

    if next_unvisited_index > 0:

        anchor_index = (
            next_unvisited_index - 1
        )

    elif next_unvisited_index == 0:

        anchor_index = -1

    else:

        anchor_index = (
            _latest_visited_index(
                normalized_route
            )
        )

    if anchor_index < 0:

        route_current = (
            str(
                route_data.get(
                    "current_station",
                    "",
                )
                or ""
            )
            .strip()
            .upper()
        )

        route_current_index = (
            _find_route_station_index(
                normalized_route,
                route_current,
            )
        )

        if route_current_index >= 0:
            anchor_index = route_current_index

    if anchor_index < 0:
        insertion_index = 0
    else:
        insertion_index = anchor_index + 1

    if insertion_index >= len(
        normalized_route
    ):

        if len(normalized_route) >= 2:
            insertion_index = (
                len(normalized_route) - 1
            )
        else:
            return (
                normalized_route,
                "",
            )

    now = datetime.now(IST)

    current_time = now.strftime(
        "%H:%M"
    )

    if anchor_index >= 0:

        previous_station = (
            normalized_route[
                anchor_index
            ]
        )

        previous_distance = (
            previous_station.get(
                "distance",
                0,
            )
        )

        previous_arrival_delay = (
            previous_station.get(
                "arrival_delay",
                0,
            )
        )

        previous_departure_delay = (
            previous_station.get(
                "departure_delay",
                0,
            )
        )

    else:

        previous_distance = 0
        previous_arrival_delay = 0
        previous_departure_delay = 0

    live_station = {
        "station_code": live_code,

        "station_name": (
            live_name
            or live_code
        ),

        "distance": previous_distance,

        "scheduled_arrival": current_time,

        "scheduled_departure": current_time,

        "actual_arrival": current_time,

        "actual_departure": current_time,

        "platform": None,

        "arrival_delay": previous_arrival_delay,

        "departure_delay": previous_departure_delay,

        "is_current": True,

        "is_live_position": True,
    }

    normalized_route.insert(
        insertion_index,
        live_station,
    )

    return (
        normalized_route,
        live_code,
    )


# =============================================================
# ETA ENDPOINT
# =============================================================

@router.get(
    "/{train_no}/{station_code}",
    response_model=ETAPrediction,
)
async def get_eta(
    train_no: str,
    station_code: str,
    request: Request,
    redis: RedisService = Depends(get_redis),
    credentials: HTTPAuthorizationCredentials = Security(
        bearer_scheme
    ),
):

    # =========================================================
    # NORMALIZE INPUTS
    # =========================================================

    station_code = (
        station_code
        .strip()
        .upper()
    )

    train_no = (
        str(train_no)
        .strip()
        .zfill(5)
    )

    try:

        train_no_int = int(
            train_no
        )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid train number: "
                f"{train_no}"
            ),
        )

    try:

        # =====================================================
        # 1. REDIS LIVE STATE
        # =====================================================

        try:

            state = await redis.get_state(
                train_no_int
            )

        except Exception:

            state = None

        # =====================================================
        # 2. GET DYNAMIC NTES ROUTE
        #
        # LIVE NTES -> DEMO FALLBACK
        # =====================================================

        today = _today_ntes_date()

        route_data = None
        route_is_demo = False

        try:

            route_data = (
                ntes_service.get_train_route(
                    train_no,
                    today,
                )
            )

        except Exception as route_error:

            print(
                "RAILCAST ETA NTES ROUTE ERROR:",
                str(route_error),
            )

            route_data = (
                _build_demo_route(
                    train_no,
                    today,
                )
            )

            route_is_demo = (
                route_data is not None
            )

        if not route_data:

            raise HTTPException(
                status_code=503,
                detail=(
                    "NTES route is unavailable "
                    "and no demo route exists "
                    f"for train {train_no}."
                ),
            )

        dynamic_route = route_data.get(
            "route",
            [],
        )

        if len(dynamic_route) < 2:

            raise HTTPException(
                status_code=503,
                detail=(
                    "RailCast could not build "
                    "a usable train route."
                ),
            )

        # =====================================================
        # 3. GET DETAILED NTES STATUS
        #
        # LIVE NTES -> DEMO FALLBACK
        # =====================================================

        status_data = {}

        try:

            status_data = (
                ntes_service.get_train_status(
                    train_no,
                    today,
                )
            )

        except Exception as status_error:

            print(
                "RAILCAST ETA NTES STATUS ERROR:",
                str(status_error),
            )

            demo_status = (
                _build_demo_status(
                    train_no,
                    today,
                )
            )

            if demo_status:

                status_data = demo_status

            else:

                status_data = {}

        # =====================================================
        # 4. SOURCE FLAG
        # =====================================================

        using_demo = (
            route_is_demo
            or status_data.get(
                "demo",
                False,
            )
        )

        if using_demo:

            route_data["data_source"] = (
                "DEMO_FALLBACK"
            )

            route_data["demo"] = True

        # =====================================================
        # 5. EXTRACT CPOS
        # =====================================================

        cpos_text = (
            str(
                status_data.get(
                    "CPOS",
                    "",
                )
                or ""
            )
            .strip()
        )

        cpos_code = (
            _extract_cpos_code(
                cpos_text
            )
        )

        cpos_name = (
            _extract_cpos_name(
                cpos_text,
                cpos_code,
            )
        )

        # =====================================================
        # 6. CURRENT POSITION
        # =====================================================

        current_station = (
            cpos_code
            or (
                str(
                    route_data.get(
                        "current_station",
                        "",
                    )
                    or ""
                )
                .strip()
                .upper()
            )
            or station_code
        )

        current_station_name = (
            cpos_name
            or (
                str(
                    route_data.get(
                        "current_station_name",
                        "",
                    )
                    or ""
                )
                .strip()
            )
            or current_station
        )

        # =====================================================
        # 7. SOURCE / DESTINATION
        # =====================================================

        destination_code = (
            str(
                dynamic_route[-1].get(
                    "station_code",
                    "",
                )
                or ""
            )
            .strip()
            .upper()
        )

        # =====================================================
        # 8. START STATUS
        # =====================================================

        train_yet_to_start = bool(
            route_data.get(
                "yet_to_start",
                False,
            )
        )

        # =====================================================
        # 9. CURRENT DELAY
        # =====================================================

        ntes_delay = float(
            route_data.get(
                "delay",
                status_data.get(
                    "delay_minutes",
                    0,
                ),
            )
            or 0
        )

        if train_yet_to_start:
            current_delay = 0.0
        else:
            current_delay = ntes_delay

        # =====================================================
        # 10. REDIS FEATURES
        # =====================================================

        if state is not None:

            weather_flag = (
                state.weather_flag
            )

            trains_ahead = (
                state.trains_ahead
            )

        else:

            weather_flag = "clear"

            trains_ahead = 0

            state = LiveTrainState(
                train_no=train_no,

                current_station=(
                    current_station
                ),

                delay_minutes=(
                    current_delay
                ),

                updated_at=datetime.now(
                    timezone.utc
                ),
            )

        # =====================================================
        # 11. BUILD PREDICTION ROUTE
        # =====================================================

        prediction_route = (
            dynamic_route
        )

        prediction_station_code = (
            station_code
        )

        route_codes = _route_codes(
            prediction_route
        )

        # =====================================================
        # CASE A:
        # Requested station exists
        # =====================================================

        if station_code in route_codes:

            prediction_station_code = (
                station_code
            )

        # =====================================================
        # CASE B:
        # Requested station is CPOS
        # =====================================================

        elif (
            cpos_code
            and station_code == cpos_code
        ):

            (
                prediction_route,
                prediction_station_code,
            ) = (
                _insert_live_position_into_route(
                    route=dynamic_route,
                    live_code=cpos_code,
                    live_name=cpos_name,
                    route_data=route_data,
                )
            )

            if (
                not prediction_station_code
                or prediction_station_code
                not in _route_codes(
                    prediction_route
                )
            ):

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "RailCast could not "
                        "place the live "
                        "station position."
                    ),
                )

            current_station = cpos_code

            if cpos_name:
                current_station_name = (
                    cpos_name
                )

        # =====================================================
        # CASE C:
        # Requested station is stale
        # =====================================================

        else:

            if cpos_code:

                (
                    prediction_route,
                    prediction_station_code,
                ) = (
                    _insert_live_position_into_route(
                        route=dynamic_route,
                        live_code=cpos_code,
                        live_name=cpos_name,
                        route_data=route_data,
                    )
                )

                if (
                    not prediction_station_code
                    or prediction_station_code
                    not in _route_codes(
                        prediction_route
                    )
                ):

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "RailCast could not "
                            "place the train's "
                            "current position."
                        ),
                    )

                current_station = (
                    cpos_code
                )

                if cpos_name:
                    current_station_name = (
                        cpos_name
                    )

            else:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Station {station_code} "
                        f"is not present in "
                        f"train {train_no}'s "
                        f"route."
                    ),
                )

        # =====================================================
        # 12. JOURNEY COMPLETED
        # =====================================================

        if (
            current_station
            == destination_code
        ):

            return ETAPrediction(
                train_no=train_no,

                generated_at=datetime.now(
                    timezone.utc
                ),

                current_station=(
                    current_station
                ),

                current_delay_minutes=(
                    current_delay
                ),

                model_confidence=55.0,

                insight=(
                    "Journey completed. "
                    "The train has reached "
                    "its destination."
                ),

                predictions=[],
            )

        # =====================================================
        # 13. RAILCAST ML PREDICTION
        # =====================================================

        predictions = predictor.predict(
            station_code=(
                prediction_station_code
            ),

            delay=current_delay,

            day=datetime.now(
                IST
            ).weekday(),

            weather=weather_flag,

            trains_ahead=trains_ahead,

            train_no=train_no_int,

            route=prediction_route,
        )

        # =====================================================
        # 14. MODEL CONFIDENCE
        # =====================================================

        if predictions:

            confidence_width = sum(
                prediction.confidence.width_minutes
                for prediction in predictions
            )

            average_width = (
                confidence_width
                / max(
                    1,
                    len(predictions),
                )
            )

            model_conf = max(
                55.0,
                min(
                    98.0,
                    100.0
                    - average_width * 2.0,
                ),
            )

        else:

            model_conf = 55.0

        # =====================================================
        # 15. ML INSIGHT
        # =====================================================

        if train_yet_to_start:

            insight = (
                "Train has not started yet. "
                "RailCast is estimating "
                "downstream arrival times "
                "from the scheduled departure "
                "and current operating "
                "conditions."
            )

        elif current_delay < 0:

            insight = (
                "Train is currently running "
                "early; RailCast is monitoring "
                "recovery toward scheduled "
                "timings."
            )

        elif current_delay <= 5:

            insight = (
                "Train is running close to "
                "schedule. RailCast predicts "
                "stable downstream arrival "
                "timings."
            )

        elif current_delay <= 15:

            insight = (
                "Moderate delay is currently "
                "propagating through downstream "
                "stations."
            )

        else:

            insight = (
                "Higher upstream delay is "
                "propagating; ETA uncertainty "
                "is elevated."
            )

        # =====================================================
        # 16. CPOS CONTEXT
        # =====================================================

        if (
            cpos_code
            and cpos_name
            and current_station == cpos_code
        ):

            insight = (
                f"NTES reports the train at "
                f"{cpos_name} ({cpos_code}). "
                + insight
            )

        # =====================================================
        # 17. DEMO CONTEXT
        # =====================================================

        if using_demo:

            insight = (
                "Demo fallback is active because "
                "live NTES data is unavailable. "
                + insight
            )

        # =====================================================
        # 18. FINAL RESPONSE
        # =====================================================

        return ETAPrediction(
            train_no=train_no,

            generated_at=datetime.now(
                timezone.utc
            ),

            current_station=(
                current_station
            ),

            current_delay_minutes=(
                current_delay
            ),

            model_confidence=round(
                model_conf,
                1,
            ),

            insight=insight,

            predictions=predictions,
        )

    # =========================================================
    # ERROR HANDLING
    # =========================================================

    except HTTPException:

        raise

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:

        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        print(
            "RAILCAST ETA ERROR:",
            str(exc),
        )

        raise HTTPException(
            status_code=502,
            detail=(
                f"Dynamic ETA request failed: "
                f"{str(exc)}"
            ),
        ) from exc