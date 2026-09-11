from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import re

from fastapi import APIRouter, Depends, HTTPException, Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.models.predictor import predictor
from backend.models.schemas import ETAPrediction, LiveTrainState
from backend.services.redis_service import RedisService
from backend.services.ntes_service import NTESService


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
    """
    Return today's date in the format expected by NTES.

    Example:
        11-Sep-2026
    """

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
# CPOS CODE EXTRACTION
# =============================================================

def _extract_cpos_code(cpos: str) -> str:
    """
    Extract station code from NTES CPOS text.

    Example:
        Departed from KUMEDPUR(KDPR) at 07:51 11-Sep

    Returns:
        KDPR
    """

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
    """
    Extract station name from NTES CPOS text.

    Example:
        Departed from KUMEDPUR(KDPR) at 07:51 11-Sep

    Returns:
        KUMEDPUR
    """

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
    """
    Return normalized station codes from a route.
    """

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
    """
    Find the latest scheduled station already visited.

    NTES actual arrival/departure values are used.
    """

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
    """
    Find a station index in the scheduled route.
    """

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
    """
    Find the first scheduled station that has not yet
    recorded an actual arrival/departure.

    Returns -1 if every station appears visited.
    """

    for index, station in enumerate(route):

        actual_arrival = station.get(
            "actual_arrival"
        )

        actual_departure = station.get(
            "actual_departure"
        )

        if not actual_arrival and not actual_departure:
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
    """
    Insert the live CPOS position into the scheduled route.

    CPOS can represent a physical railway location that is
    NOT itself a scheduled passenger stop.

    Therefore RailCast creates a temporary live-position
    station and places it immediately before the next
    unvisited scheduled station.

    No station is hardcoded.
    """

    if not live_code:
        return route, ""

    normalized_route = [
        dict(item)
        for item in route
    ]

    codes = _route_codes(
        normalized_route
    )

    # =========================================================
    # CPOS ALREADY EXISTS IN THE SCHEDULED ROUTE
    # =========================================================

    if live_code in codes:

        return (
            normalized_route,
            live_code,
        )

    # =========================================================
    # DETERMINE WHERE THE TRAIN IS
    # =========================================================
    #
    # Preferred approach:
    #
    #     Find the first station that has NOT been visited.
    #
    # The live CPOS lies somewhere before that station.
    #
    # =========================================================

    next_unvisited_index = _first_unvisited_index(
        normalized_route
    )

    if next_unvisited_index > 0:

        anchor_index = (
            next_unvisited_index - 1
        )

    elif next_unvisited_index == 0:

        # Train is before the first scheduled station.
        anchor_index = -1

    else:

        # =====================================================
        # FALLBACK 1:
        # Latest station marked as visited
        # =====================================================

        anchor_index = _latest_visited_index(
            normalized_route
        )

    # =========================================================
    # FALLBACK 2:
    # route_data current station
    # =========================================================

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

        route_current_index = _find_route_station_index(
            normalized_route,
            route_current,
        )

        if route_current_index >= 0:

            anchor_index = route_current_index

    # =========================================================
    # FINAL FALLBACK
    # =========================================================
    #
    # If no reliable anchor exists, place the live position
    # immediately before the first scheduled station.
    #
    # =========================================================

    if anchor_index < 0:

        insertion_index = 0

    else:

        insertion_index = anchor_index + 1

    # =========================================================
    # SAFETY:
    # NEVER INSERT AFTER DESTINATION
    # =========================================================

    if insertion_index >= len(normalized_route):

        # If the route is completely visited, place CPOS
        # immediately before the final destination.

        if len(normalized_route) >= 2:

            insertion_index = (
                len(normalized_route) - 1
            )

        else:

            return (
                normalized_route,
                "",
            )

    # =========================================================
    # CURRENT TIME
    # =========================================================

    now = datetime.now(IST)

    current_time = now.strftime(
        "%H:%M"
    )

    # =========================================================
    # DISTANCE ANCHOR
    # =========================================================

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

    # =========================================================
    # CREATE LIVE POSITION
    # =========================================================

    live_station = {
        "station_code": live_code,

        "station_name": (
            live_name
            or live_code
        ),

        # CPOS is a physical location rather than a scheduled
        # passenger stop, so use the nearest known route
        # distance as an anchor.
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

    # =========================================================
    # INSERT LIVE POSITION
    # =========================================================

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

    # Keep train number as STRING throughout API/Pydantic.
    #
    # This preserves:
    #
    #     03030
    #
    # instead of:
    #
    #     3030

    train_no = (
        str(train_no)
        .strip()
        .zfill(5)
    )

    # Numeric representation is used only where required
    # by Redis / ML.

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

            # Redis is supplementary.
            # ETA must still work without it.

            state = None

        # =====================================================
        # 2. GET DYNAMIC NTES ROUTE
        # =====================================================

        today = _today_ntes_date()

        route_data = (
            ntes_service.get_train_route(
                train_no,
                today,
            )
        )

        if not route_data:

            raise HTTPException(
                status_code=502,
                detail=(
                    "Unable to retrieve train "
                    "route from NTES."
                ),
            )

        dynamic_route = route_data.get(
            "route",
            [],
        )

        if len(dynamic_route) < 2:

            raise HTTPException(
                status_code=502,
                detail=(
                    "NTES returned an invalid "
                    "train route."
                ),
            )

        # =====================================================
        # 3. GET DETAILED NTES STATUS
        # =====================================================

        try:

            status_data = (
                ntes_service.get_train_status(
                    train_no,
                    today,
                )
            )

        except Exception:

            status_data = {}

        # =====================================================
        # 4. EXTRACT CPOS
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
        # 5. DETERMINE ACTUAL CURRENT POSITION
        # =====================================================

        # NTES CPOS has highest priority because it represents
        # the live physical position.

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
        # 6. SOURCE / DESTINATION
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
        # 7. TRAIN START STATUS
        # =====================================================

        train_yet_to_start = bool(
            route_data.get(
                "yet_to_start",
                False,
            )
        )

        # =====================================================
        # 8. CURRENT DELAY
        # =====================================================

        # NTES is the source of truth.

        ntes_delay = float(
            route_data.get(
                "delay",
                0,
            )
            or 0
        )

        if train_yet_to_start:

            current_delay = 0.0

        else:

            current_delay = ntes_delay

        # =====================================================
        # 9. REDIS SUPPLEMENTARY FEATURES
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
        # 10. BUILD PREDICTION ROUTE
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
        # Requested station exists in scheduled route
        # =====================================================

        if station_code in route_codes:

            prediction_station_code = (
                station_code
            )

        # =====================================================
        # CASE B:
        # Requested station is current NTES CPOS
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
                        "NTES reported the live "
                        "station position, but "
                        "RailCast could not "
                        "place that position "
                        "relative to the "
                        "scheduled route."
                    ),
                )

            current_station = cpos_code

            if cpos_name:

                current_station_name = (
                    cpos_name
                )

        # =====================================================
        # CASE C:
        # Requested station is stale but NTES has CPOS
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
                            "NTES reported the "
                            "train's current "
                            "physical position, "
                            "but RailCast could "
                            "not place that "
                            "position relative "
                            "to the scheduled "
                            "route."
                        ),
                    )

                # Trust the live NTES position.

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
                        f"NTES route and "
                        f"NTES did not "
                        f"provide a current "
                        f"CPOS."
                    ),
                )

        # =====================================================
        # 11. JOURNEY COMPLETED
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
        # 12. RUN RAILCAST PREDICTOR
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

            # Predictor uses numeric train number.

            train_no=train_no_int,

            route=prediction_route,
        )

        # =====================================================
        # 13. MODEL CONFIDENCE
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
        # 14. ML INSIGHT
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
        # 15. ADD CPOS CONTEXT
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
        # 16. FINAL RESPONSE
        # =====================================================

        return ETAPrediction(
            train_no=train_no,

            generated_at=datetime.now(
                timezone.utc
            ),

            # Actual live position from NTES.

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

        raise HTTPException(
            status_code=502,
            detail=(
                f"Dynamic ETA request failed: "
                f"{str(exc)}"
            ),
        ) from exc