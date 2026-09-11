import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

import joblib
import numpy as np
import pandas as pd
from tensorflow import keras

from backend.models.schemas import (
    ConfidenceBand,
    StationETAPrediction,
    Station,
)


# =========================================================
# PATHS / TIMEZONE
# =========================================================

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "ml" / "models"

# Indian Standard Time
IST = ZoneInfo("Asia/Kolkata")


# =========================================================
# DEFAULT PILOT ROUTE
# =========================================================

# Used only when a dynamic NTES route is not supplied.

ROUTE = [
    {
        "code": "NHT",
        "name": "Nalhati Junction",
        "distance_km": 45,
        "arr": "08:45",
        "dep": "08:47",
        "platform": 1,
    },
    {
        "code": "RPH",
        "name": "Rampur Hat",
        "distance_km": 59,
        "arr": "09:10",
        "dep": "09:12",
        "platform": 3,
    },
    {
        "code": "SNT",
        "name": "Sainthia Junction",
        "distance_km": 87,
        "arr": "09:34",
        "dep": "09:35",
        "platform": 4,
    },
    {
        "code": "AMP",
        "name": "Ahmadpur Junction",
        "distance_km": 101,
        "arr": "09:47",
        "dep": "09:48",
        "platform": 2,
    },
    {
        "code": "BHP",
        "name": "Bolpur Shantiniketan",
        "distance_km": 120,
        "arr": "10:05",
        "dep": "10:07",
        "platform": 2,
    },
    {
        "code": "BWN",
        "name": "Barddhaman Junction",
        "distance_km": 171,
        "arr": "11:27",
        "dep": "11:29",
        "platform": 5,
    },
    {
        "code": "BDC",
        "name": "Bandel Junction",
        "distance_km": 239,
        "arr": "12:40",
        "dep": "12:42",
        "platform": 3,
    },
    {
        "code": "HWH",
        "name": "Howrah Junction",
        "distance_km": 278,
        "arr": "13:55",
        "dep": "13:55",
        "platform": 1,
    },
]


class RailCastPredictor:

    def __init__(self) -> None:
        self.xgb: Dict[str, object] = {}
        self.lstm = None
        self.scaler = None
        self.loaded = False

    # =========================================================
    # MODEL LOADING
    # =========================================================

    def load(self) -> None:

        if self.loaded:
            return

        # -----------------------------------------------------
        # XGBoost models
        # -----------------------------------------------------

        if MODEL_DIR.exists():

            for path in MODEL_DIR.glob(
                "xgb_model_*.pkl"
            ):

                filename = path.stem
                prefix = "xgb_model_"

                if not filename.startswith(prefix):
                    continue

                segment = filename[len(prefix):]

                # Example:
                # xgb_model_NHT_RPH.pkl
                # -> NHT-RPH

                segment = segment.replace(
                    "_",
                    "-",
                )

                try:

                    self.xgb[segment] = joblib.load(
                        path
                    )

                except Exception as exc:

                    print(
                        f"Failed to load XGBoost model "
                        f"{path.name}: {exc}"
                    )

        # -----------------------------------------------------
        # LSTM model
        # -----------------------------------------------------

        lstm_path = MODEL_DIR / "lstm_model.h5"
        scaler_path = MODEL_DIR / "lstm_scaler.pkl"

        if lstm_path.exists():

            self.lstm = keras.models.load_model(
                lstm_path,
                compile=False,
            )

        if scaler_path.exists():

            self.scaler = joblib.load(
                scaler_path
            )

        self.loaded = True

    # =========================================================
    # MODEL READY
    # =========================================================

    @property
    def ready(self) -> bool:

        self.load()

        pilot_segments = len(ROUTE) - 1

        return (
            len(self.xgb) >= pilot_segments
            and self.lstm is not None
            and self.scaler is not None
        )

    # =========================================================
    # ROUTE NORMALIZATION
    # =========================================================

    @staticmethod
    def _normalize_route(
        route: Optional[List[dict]],
    ) -> List[dict]:

        if not route:
            return ROUTE

        normalized: List[dict] = []

        for item in route:

            # -------------------------------------------------
            # RailCast-native route
            # -------------------------------------------------

            if "code" in item:

                code = str(
                    item.get(
                        "code",
                        "",
                    )
                ).strip().upper()

                name = str(
                    item.get(
                        "name",
                        code,
                    )
                ).strip()

                distance = float(
                    item.get(
                        "distance_km",
                        0,
                    )
                    or 0
                )

                arr = item.get(
                    "arr",
                    "00:00",
                )

                dep = item.get(
                    "dep",
                    arr,
                )

                platform = item.get(
                    "platform"
                )

            # -------------------------------------------------
            # NTES route
            # -------------------------------------------------

            else:

                code = str(
                    item.get(
                        "station_code",
                        "",
                    )
                ).strip().upper()

                name = str(
                    item.get(
                        "station_name",
                        code,
                    )
                ).strip()

                distance = float(
                    item.get(
                        "distance",
                        0,
                    )
                    or 0
                )

                arr = item.get(
                    "scheduled_arrival",
                    "00:00",
                )

                dep = item.get(
                    "scheduled_departure",
                    arr,
                )

                platform = item.get(
                    "platform"
                )

            if not code:
                continue

            # -------------------------------------------------
            # NTES Source / Destination handling
            # -------------------------------------------------

            if arr in (
                None,
                "",
                "Source",
            ):
                arr = dep

            if dep in (
                None,
                "",
                "Destination",
            ):
                dep = arr

            arr = str(arr).strip()
            dep = str(dep).strip()

            # Extract HH:MM from values such as:
            #
            # 03:10
            # 03:10 11-Sep

            if " " in arr:
                arr = arr.split(" ")[0]

            if " " in dep:
                dep = dep.split(" ")[0]

            # -------------------------------------------------
            # Platform
            # -------------------------------------------------

            if platform is not None:

                try:

                    platform = int(
                        str(platform).strip()
                    )

                except (
                    ValueError,
                    TypeError,
                ):

                    platform = None

            normalized.append(
                {
                    "code": code,
                    "name": name,
                    "distance_km": distance,
                    "arr": arr,
                    "dep": dep,
                    "platform": platform,
                }
            )

        if len(normalized) < 2:

            raise ValueError(
                "Dynamic route must contain at least "
                "two valid stations."
            )

        return normalized

    # =========================================================
    # CLOCK HELPERS
    # =========================================================

    @staticmethod
    def _minutes(
        hm: str,
    ) -> float:

        hours, minutes = map(
            int,
            hm.split(":"),
        )

        return (
            hours * 60
            + minutes
        )

    @classmethod
    def _travel_minutes(
        cls,
        current_station: dict,
        next_station: dict,
    ) -> float:

        departure = cls._minutes(
            current_station["dep"]
        )

        arrival = cls._minutes(
            next_station["arr"]
        )

        duration = (
            arrival
            - departure
        )

        if duration <= 0:
            duration += 24 * 60

        return float(duration)

    @classmethod
    def _halt_minutes(
        cls,
        station: dict,
    ) -> float:

        arrival = cls._minutes(
            station["arr"]
        )

        departure = cls._minutes(
            station["dep"]
        )

        halt = (
            departure
            - arrival
        )

        if halt < 0:
            halt += 24 * 60

        return float(halt)

    # =========================================================
    # SCHEDULED DATETIME
    # =========================================================

    @classmethod
    def _scheduled_datetime(
        cls,
        now: datetime,
        current_station: dict,
        target_station: dict,
    ) -> datetime:

        """
        Convert the target station's HH:MM schedule into
        a real IST datetime.

        The target time is interpreted relative to the
        current station's scheduled departure so that
        overnight journeys work correctly.
        """

        current_dep_minutes = cls._minutes(
            current_station["dep"]
        )

        target_arr_minutes = cls._minutes(
            target_station["arr"]
        )

        target_date = now.date()

        # If target station's scheduled time is earlier
        # than the current station's scheduled departure,
        # it belongs to the next calendar day.

        if target_arr_minutes < current_dep_minutes:

            target_date = (
                target_date
                + timedelta(days=1)
            )

        hours = int(
            target_arr_minutes // 60
        )

        minutes = int(
            target_arr_minutes % 60
        )

        return datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            hours,
            minutes,
            tzinfo=IST,
        )

    # =========================================================
    # FEATURE HELPERS
    # =========================================================

    @staticmethod
    def _weather_numeric(
        weather: str,
    ) -> float:

        return {
            "clear": 0.0,
            "cloudy": 1.0,
            "rain": 2.0,
            "storm": 3.0,
        }.get(
            weather.lower(),
            0.0,
        )

    @staticmethod
    def _season_from_day(
        day: int,
    ) -> str:

        seasons = (
            "winter",
            "summer",
            "monsoon",
            "autumn",
        )

        return seasons[
            (day + 1) % 4
        ]

    @staticmethod
    def _status(
        delay: float,
    ) -> str:
        """
        Convert predicted delay into a passenger-facing status.

        Thresholds:
        - below -2 min: early
        - -2 to 5 min: on time
        - above 5 to 15 min: delayed
        - above 15 min: late
        """

        if delay < -2:
            return "early"

        if delay <= 5:
            return "on_time"

        if delay <= 15:
            return "delayed"

        return "late"

    # =========================================================
    # CONFIDENCE
    # =========================================================

    @staticmethod
    def _confidence_from_uncertainty(
        uncertainty: float,
    ) -> float:

        # Heuristic confidence.
        # This is NOT a calibrated probability.

        confidence = (
            100.0
            - uncertainty * 4.0
        )

        return max(
            55.0,
            min(
                98.0,
                confidence,
            ),
        )

    # =========================================================
    # MAIN PREDICTOR
    # =========================================================

    def predict(
        self,
        station_code: str,
        delay: float,
        day: int,
        weather: str,
        trains_ahead: int,
        train_no: int = 13028,
        route: Optional[List[dict]] = None,
    ) -> List[StationETAPrediction]:

        self.load()

        # -----------------------------------------------------
        # Dynamic NTES route
        # -----------------------------------------------------

        active_route = self._normalize_route(
            route
        )

        codes = [
            station["code"]
            for station in active_route
        ]

        station_code = (
            station_code
            .strip()
            .upper()
        )

        if station_code not in codes:

            raise ValueError(
                f"Station {station_code} is not "
                f"present in the selected train route."
            )

        start = codes.index(
            station_code
        )

        # Current station is destination.
        if start >= len(active_route) - 1:
            return []

        # -----------------------------------------------------
        # Current IST time
        # -----------------------------------------------------

        now = datetime.now(IST)

        # -----------------------------------------------------
        # IMPORTANT:
        #
        # NTES delay is the observed live delay.
        #
        # We DO NOT throw this away.
        # -----------------------------------------------------

        running_delay = float(
            delay
        )

        predictions: List[
            StationETAPrediction
        ] = []

        history_features = []

        weather_num = (
            self._weather_numeric(
                weather
            )
        )

        # =====================================================
        # SEGMENT LOOP
        # =====================================================

        for i in range(
            start,
            len(active_route) - 1,
        ):

            current_station = (
                active_route[i]
            )

            next_station = (
                active_route[i + 1]
            )

            segment = (
                f"{current_station['code']}-"
                f"{next_station['code']}"
            )

            xgb_model = self.xgb.get(
                segment
            )

            # =================================================
            # FEATURES
            # =================================================

            time_of_day = (
                self._minutes(
                    current_station["dep"]
                )
            )

            xgb_features = pd.DataFrame(
                [
                    {
                        "train_no": train_no,

                        "day_of_week": day,

                        "time_of_day": time_of_day,

                        "season": (
                            self._season_from_day(
                                day
                            )
                        ),

                        "weather_flag": weather,

                        "trains_ahead": (
                            trains_ahead
                        ),

                        "delay_at_entry": (
                            running_delay
                        ),
                    }
                ]
            )

            # =================================================
            # XGBOOST
            # =================================================

            if xgb_model is not None:

                xgb_delay = float(
                    xgb_model.predict(
                        xgb_features
                    )[0]
                )

                xgb_available = True

            else:

                xgb_delay = (
                    running_delay
                )

                xgb_available = False

            # =================================================
            # LSTM
            # =================================================

            history_features.append(
                [
                    running_delay,
                    weather_num,
                    trains_ahead,
                    day,
                    time_of_day,
                ]
            )

            sequence = np.asarray(
                history_features[-3:],
                dtype=np.float32,
            )

            # Pad sequence to 3 rows.

            if len(sequence) < 3:

                padding = np.repeat(
                    sequence[[0]],
                    3 - len(sequence),
                    axis=0,
                )

                sequence = np.vstack(
                    [
                        padding,
                        sequence,
                    ]
                )

            if (
                self.lstm is None
                or self.scaler is None
            ):

                raise RuntimeError(
                    "LSTM model or scaler unavailable."
                )

            scaled_sequence = (
                self.scaler
                .transform(sequence)
                .reshape(
                    1,
                    3,
                    5,
                )
            )

            lstm_delay = float(
                self.lstm.predict(
                    scaled_sequence,
                    verbose=0,
                )[0, 0]
            )

            # =================================================
            # XGB + LSTM ENSEMBLE
            # =================================================

            if xgb_available:

                model_delay = (
                    0.65 * xgb_delay
                    + 0.35 * lstm_delay
                )

            else:

                model_delay = (
                    lstm_delay
                )

            # -------------------------------------------------
            # IMPORTANT LIVE-DELAY LOGIC
            #
            # The ML model predicts a downstream delay
            # based on training data.
            #
            # NTES gives us the actual live delay.
            #
            # Therefore we allow ML to predict recovery,
            # but never allow it to erase hundreds of minutes
            # of real observed delay in one step.
            # -------------------------------------------------

            recovery_factor = 0.20

            predicted_delay = (
                running_delay
                + recovery_factor
                * (
                    model_delay
                    - running_delay
                )
            )

            # Maximum recovery allowed per station.
            #
            # Example:
            #
            # Current delay = 294
            # Model = 39
            #
            # Prediction cannot instantly become 39.
            #
            # Minimum first-step prediction:
            #
            # 294 - 60 = 234

            maximum_recovery = 60.0

            predicted_delay = max(
                running_delay
                - maximum_recovery,

                predicted_delay,
            )

            predicted_delay = max(
                -3.0,
                predicted_delay,
            )

            # =================================================
            # SCHEDULED ETA
            # =================================================

            scheduled_eta = (
                self._scheduled_datetime(
                    now=now,
                    current_station=current_station,
                    target_station=next_station,
                )
            )

            # -------------------------------------------------
            # ETA = scheduled arrival + predicted live delay
            #
            # This is the key correction.
            # -------------------------------------------------

            eta = (
                scheduled_eta
                + timedelta(
                    minutes=predicted_delay
                )
            )

            # -------------------------------------------------
            # Safety:
            #
            # ETA should not be in the past relative to
            # the current actual clock.
            # -------------------------------------------------

            if eta < now:

                minimum_eta = (
                    now
                    + timedelta(minutes=1)
                )

                eta = minimum_eta

            # =================================================
            # UNCERTAINTY
            # =================================================

            if xgb_available:

                model_disagreement = abs(
                    xgb_delay
                    - lstm_delay
                )

                uncertainty = max(
                    3.0,

                    model_disagreement
                    * 0.9

                    + 4.0

                    + 0.5
                    * math.sqrt(
                        i - start + 1
                    ),
                )

            else:

                uncertainty = max(
                    6.0,

                    5.0

                    + 0.75
                    * math.sqrt(
                        i - start + 1
                    ),
                )

            # -------------------------------------------------
            # Large live delays increase uncertainty.
            # -------------------------------------------------

            if running_delay > 60:

                uncertainty += min(
                    30.0,
                    running_delay * 0.08,
                )

            # =================================================
            # CONFIDENCE BAND
            # =================================================

            p10 = (
                eta
                - timedelta(
                    minutes=uncertainty
                )
            )

            p90 = (
                eta
                + timedelta(
                    minutes=uncertainty
                )
            )

            confidence = (
                self._confidence_from_uncertainty(
                    uncertainty
                )
            )

            # =================================================
            # STATION OBJECT
            # =================================================

            station = Station(
                code=next_station["code"],

                name=next_station["name"],

                distance_km=next_station[
                    "distance_km"
                ],

                scheduled_arrival=next_station[
                    "arr"
                ],

                scheduled_departure=next_station[
                    "dep"
                ],

                platform=next_station.get(
                    "platform"
                ),
            )

            # =================================================
            # RESULT
            # =================================================

            predictions.append(
                StationETAPrediction(
                    station=station,

                    eta=eta,

                    delay_minutes=round(
                        predicted_delay,
                        2,
                    ),

                    confidence=ConfidenceBand(
                        p10=p10,

                        p50=eta,

                        p90=p90,

                        width_minutes=round(
                            2 * uncertainty,
                            1,
                        ),
                    ),

                    status=self._status(
                        predicted_delay
                    ),
                )
            )

            # =================================================
            # NEXT SEGMENT
            # =================================================

            # The predicted delay becomes the input for
            # the next ML prediction.

            running_delay = (
                predicted_delay
            )

        return predictions


# =========================================================
# SINGLE PREDICTOR INSTANCE
# =========================================================

predictor = RailCastPredictor()