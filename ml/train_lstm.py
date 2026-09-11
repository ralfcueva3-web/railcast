from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from tensorflow import keras
from tensorflow.keras import layers


ROOT = Path(__file__).resolve().parent

DATA = (
    ROOT
    / "data"
    / "processed"
    / "railcast_training.csv"
)

MODEL_DIR = ROOT / "models"
MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

SEQ_LEN = 3

# IMPORTANT:
# delay_at_exit is deliberately NOT included here.
#
# The LSTM predicts the next segment's delay.
# Therefore it must only receive information that would
# actually be available before that prediction.
FEATURES = [
    "delay_at_entry",
    "weather_numeric",
    "trains_ahead",
    "day_of_week",
    "time_of_day",
]


def build_sequences(
    df: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray]:

    X = []
    y = []

    for _, journey in df.groupby("journey_id"):

        journey = journey.sort_values("segment")

        values = journey[
            FEATURES
        ].to_numpy(dtype=np.float32)

        targets = journey[
            "delay_at_exit"
        ].to_numpy(dtype=np.float32)

        # -----------------------------------------------------
        # For each segment:
        #
        # X = information available when entering segment
        # y = delay at the exit of that segment
        #
        # No delay_at_exit is included in X.
        # -----------------------------------------------------

        for i in range(len(values)):

            start = max(
                0,
                i - SEQ_LEN + 1,
            )

            sequence = values[
                start:i + 1
            ]

            # Pad early sequences to length 3.
            if len(sequence) < SEQ_LEN:

                padding = np.repeat(
                    sequence[[0]],
                    SEQ_LEN - len(sequence),
                    axis=0,
                )

                sequence = np.vstack(
                    [
                        padding,
                        sequence,
                    ]
                )

            X.append(sequence)

            # Target remains the actual exit delay.
            y.append(targets[i])

    return (
        np.asarray(X, dtype=np.float32),
        np.asarray(y, dtype=np.float32),
    )


def main() -> None:

    print("Loading training data...")

    df = pd.read_csv(DATA)

    print(
        f"Loaded {len(df)} training rows."
    )

    # ---------------------------------------------------------
    # Convert weather into numeric representation.
    # ---------------------------------------------------------

    weather_map = {
        "clear": 0.0,
        "cloudy": 1.0,
        "rain": 2.0,
        "storm": 3.0,
    }

    df["weather_numeric"] = (
        df["weather_flag"]
        .map(weather_map)
        .fillna(0.0)
        .astype(float)
    )

    # ---------------------------------------------------------
    # Build sequences.
    # ---------------------------------------------------------

    X, y = build_sequences(df)

    print(
        f"Sequence shape: {X.shape}"
    )

    print(
        f"Target shape: {y.shape}"
    )

    # ---------------------------------------------------------
    # Scale input features.
    # ---------------------------------------------------------

    scaler = StandardScaler()

    X_flat = X.reshape(
        -1,
        X.shape[-1],
    )

    X_scaled = scaler.fit_transform(
        X_flat
    ).reshape(X.shape)

    # ---------------------------------------------------------
    # LSTM model.
    # ---------------------------------------------------------

    model = keras.Sequential(
        [
            layers.Input(
                shape=(
                    SEQ_LEN,
                    len(FEATURES),
                )
            ),

            layers.LSTM(
                48,
                return_sequences=True,
            ),

            layers.Dropout(0.15),

            layers.LSTM(24),

            layers.Dense(
                16,
                activation="relu",
            ),

            layers.Dense(1),
        ]
    )

    model.compile(
        optimizer=keras.optimizers.Adam(
            learning_rate=0.001
        ),
        loss="mse",
        metrics=["mae"],
    )

    model.summary()

    # ---------------------------------------------------------
    # Training callbacks.
    # ---------------------------------------------------------

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=10,
            restore_best_weights=True,
        ),

        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            patience=4,
            factor=0.5,
        ),
    ]

    # ---------------------------------------------------------
    # Train.
    # ---------------------------------------------------------

    print(
        "\nTraining leakage-free LSTM..."
    )

    model.fit(
        X_scaled,
        y,
        validation_split=0.2,
        epochs=80,
        batch_size=32,
        callbacks=callbacks,
        verbose=1,
    )

    # ---------------------------------------------------------
    # Save model and scaler.
    # ---------------------------------------------------------

    model_path = (
        MODEL_DIR
        / "lstm_model.h5"
    )

    scaler_path = (
        MODEL_DIR
        / "lstm_scaler.pkl"
    )

    model.save(model_path)

    joblib.dump(
        scaler,
        scaler_path,
    )

    print(
        "\nLSTM training complete."
    )

    print(
        f"Saved model: {model_path}"
    )

    print(
        f"Saved scaler: {scaler_path}"
    )


if __name__ == "__main__":
    main()
    