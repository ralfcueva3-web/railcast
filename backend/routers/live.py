import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.models.predictor import predictor
from backend.models.schemas import LiveTrainState


router = APIRouter(
    tags=["Live"]
)


@router.websocket("/live/{train_no}")
async def live_train(
    websocket: WebSocket,
    train_no: str,
):
    """
    WebSocket endpoint for live train ETA updates.

    Train numbers are kept as strings so leading-zero
    train numbers such as 03030 are preserved.
    """

    await websocket.accept()

    # =========================================================
    # NORMALIZE TRAIN NUMBER
    # =========================================================

    train_no = (
        str(train_no)
        .strip()
        .zfill(5)
    )

    # =========================================================
    # CURRENT WEBSOCKET PILOT
    # =========================================================
    #
    # This WebSocket endpoint is still configured only for
    # the existing pilot train.
    #
    # REST /eta and NTES station/train endpoints are dynamic.
    #
    # =========================================================

    if train_no != "13028":

        await websocket.send_json(
            {
                "error": (
                    "Only pilot train 13028 "
                    "is configured for WebSocket live updates."
                )
            }
        )

        await websocket.close(
            code=1008
        )

        return

    try:

        # =====================================================
        # INITIAL LIVE STATE
        # =====================================================

        state = LiveTrainState(
            train_no=train_no,

            current_station="NHT",

            delay_minutes=4.0,

            updated_at=datetime.now(
                timezone.utc
            ),
        )

        # =====================================================
        # CONTINUOUS LIVE LOOP
        # =====================================================

        while True:

            # -------------------------------------------------
            # Generate station-by-station ETA predictions
            # -------------------------------------------------

            preds = predictor.predict(
                station_code=state.current_station,

                delay=state.delay_minutes,

                day=datetime.now(
                    timezone.utc
                ).astimezone().weekday(),

                weather=state.weather_flag,

                trains_ahead=state.trains_ahead,

                # Predictor expects the numeric train number.
                train_no=int(train_no),
            )

            # -------------------------------------------------
            # Calculate confidence
            #
            # Do NOT use confidence.width_minutes directly
            # as a confidence percentage.
            # -------------------------------------------------

            if preds:

                average_width = (
                    sum(
                        prediction.confidence.width_minutes
                        for prediction in preds
                    )
                    / len(preds)
                )

                model_confidence = max(
                    55.0,
                    min(
                        98.0,
                        100.0
                        - average_width * 2.0,
                    ),
                )

            else:

                model_confidence = 55.0

            # -------------------------------------------------
            # Generate ML insight
            # -------------------------------------------------

            if preds:

                first_prediction = (
                    preds[0]
                )

                if (
                    first_prediction.delay_minutes
                    < state.delay_minutes
                ):

                    insight = (
                        "Ensemble predicts recovery "
                        "after the current station."
                    )

                elif (
                    first_prediction.delay_minutes
                    <= state.delay_minutes + 2
                ):

                    insight = (
                        "Ensemble predicts stable delay "
                        "after the current station."
                    )

                else:

                    insight = (
                        "Ensemble predicts increasing "
                        "delay after the current station."
                    )

            else:

                insight = (
                    "No ETA predictions available."
                )

            # -------------------------------------------------
            # WebSocket payload
            # -------------------------------------------------

            payload = {
                # IMPORTANT:
                # Keep train number as STRING.
                "train_no": train_no,

                "generated_at": (
                    datetime.now(
                        timezone.utc
                    ).isoformat()
                ),

                "current_station": (
                    state.current_station
                ),

                "current_delay_minutes": (
                    state.delay_minutes
                ),

                "model_confidence": round(
                    model_confidence,
                    1,
                ),

                "insight": insight,

                "predictions": [
                    prediction.model_dump(
                        mode="json"
                    )
                    for prediction in preds
                ],
            }

            await websocket.send_json(
                payload
            )

            # -------------------------------------------------
            # Update every 2 minutes
            # -------------------------------------------------

            await asyncio.sleep(
                120
            )

    # =========================================================
    # NORMAL DISCONNECT
    # =========================================================

    except (
        WebSocketDisconnect,
        asyncio.CancelledError,
    ):

        return

    # =========================================================
    # UNEXPECTED ERROR
    # =========================================================

    except Exception as exc:

        try:

            await websocket.send_json(
                {
                    "error": str(exc)
                }
            )

            await websocket.close(
                code=1011
            )

        except Exception:

            pass