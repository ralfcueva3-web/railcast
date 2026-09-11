import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "processed" / "railcast_training.csv"
MODEL_DIR = ROOT / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

FEATURES = [
    "train_no", "day_of_week", "time_of_day", "season", "weather_flag",
    "trains_ahead", "delay_at_entry"
]
CATEGORICAL = ["season", "weather_flag"]
NUMERIC = [x for x in FEATURES if x not in CATEGORICAL]

def main() -> None:
    if not DATA.exists():
        raise FileNotFoundError(f"Training data not found: {DATA}. Run ml/generate_data.py first.")
    df = pd.read_csv(DATA)
    for segment, group in df.groupby("segment"):
        X = group[FEATURES]
        y = group["delay_at_exit"]
        if len(group) < 20:
            raise ValueError(f"Insufficient samples for segment {segment}: {len(group)}")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=26028
        )
        preprocessor = ColumnTransformer([
            ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
            ("numeric", "passthrough", NUMERIC),
        ])
        model = XGBRegressor(
            n_estimators=350, max_depth=5, learning_rate=0.035,
            subsample=0.9, colsample_bytree=0.9, reg_alpha=0.1,
            reg_lambda=1.5, objective="reg:squarederror",
            random_state=26028, n_jobs=max(1, (os.cpu_count() or 2) - 1),
        )
        pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)])
        pipeline.fit(X_train, y_train)
        pred = pipeline.predict(X_test)
        mae = mean_absolute_error(y_test, pred)
        rmse = mean_squared_error(y_test, pred) ** 0.5
        safe_segment = segment.replace("-", "_")
        joblib.dump(pipeline, MODEL_DIR / f"xgb_model_{safe_segment}.pkl")
        print(f"{segment}: MAE={mae:.3f} min RMSE={rmse:.3f} min")

if __name__ == "__main__":
    main()
