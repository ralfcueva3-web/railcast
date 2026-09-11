import csv
import math
import random
from datetime import datetime, timedelta
from pathlib import Path

SEED = 26028
random.seed(SEED)

OUT = Path(__file__).parent / "data" / "processed" / "railcast_training.csv"
OUT.parent.mkdir(parents=True, exist_ok=True)

STATIONS = [
    ("NHT", "RPH", 45, 59, 8, 2),
    ("RPH", "SNT", 59, 87, 14, 2),
    ("SNT", "AMP", 87, 101, 14, 1),
    ("AMP", "BHP", 101, 120, 19, 2),
    ("BHP", "BWN", 120, 171, 51, 2),
    ("BWN", "BDC", 171, 239, 68, 2),
    ("BDC", "HWH", 239, 278, 39, 0),
]
SEASONS = ("winter", "summer", "monsoon", "autumn")
WEATHER_EFFECT = {"clear": 0.0, "cloudy": 1.2, "rain": 5.5, "storm": 10.0}
SEGMENT_BASE = {"NHT-RPH": 2.0, "RPH-SNT": 3.2, "SNT-AMP": 2.0, "AMP-BHP": 2.3,
                "BHP-BWN": 4.0, "BWN-BDC": 6.0, "BDC-HWH": 5.0}

rows = []
for journey_id in range(1, 101):
    day = random.randint(0, 6)
    season = random.choice(SEASONS)
    weather = random.choices(
        ["clear", "cloudy", "rain", "storm"], weights=[0.58, 0.22, 0.16, 0.04]
    )[0]
    trains_ahead = max(0, int(random.gauss(2.4, 1.4)))
    delay = max(0.0, random.gauss(4.5, 5.0))
    for seg_idx, (src, dst, km0, km1, distance, halt) in enumerate(STATIONS):
        # Synthetic clock feature anchored to timetable departure + small variability.
        base_hour = [8.783, 9.2, 9.583, 9.8, 10.117, 11.483, 12.7][seg_idx]
        time_of_day = base_hour * 60 + random.gauss(0, 2.0)
        congestion = 0.9 * trains_ahead + (1.7 if seg_idx >= 4 else 0.4)
        weekend = -0.7 if day in (5, 6) else 0.6
        season_effect = {"winter": 0.5, "summer": 1.0, "monsoon": 2.2, "autumn": 0.3}[season]
        weather_effect = WEATHER_EFFECT[weather]
        recovery = -0.12 * delay if delay > 8 else -0.04 * delay
        segment = f"{src}-{dst}"
        noise = random.gauss(0, 2.0 if distance < 30 else 3.0)
        exit_delay = max(
            -3.0,
            delay + SEGMENT_BASE[segment] + congestion * 0.35 + season_effect * 0.25
            + weather_effect * 0.28 + weekend + recovery + noise
        )
        rows.append({
            "journey_id": journey_id,
            "train_no": 13028,
            "segment": segment,
            "station_from": src,
            "station_to": dst,
            "day_of_week": day,
            "time_of_day": round(time_of_day, 2),
            "season": season,
            "weather_flag": weather,
            "trains_ahead": trains_ahead,
            "delay_at_entry": round(delay, 2),
            "delay_at_exit": round(exit_delay, 2),
        })
        delay = exit_delay

with OUT.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

print(f"Wrote {len(rows)} rows to {OUT}")
