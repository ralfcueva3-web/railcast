from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split
from tensorflow import keras

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "processed" / "railcast_training.csv"
MODEL_DIR = ROOT / "models"
FEATURES = ["train_no","day_of_week","time_of_day","season","weather_flag","trains_ahead","delay_at_entry"]

def main() -> None:
    df = pd.read_csv(DATA)
    print("\nXGBoost evaluation")
    for segment, group in df.groupby("segment"):
        path = MODEL_DIR / f"xgb_model_{segment.replace('-', '_')}.pkl"
        if not path.exists():
            print(f"{segment}: model missing")
            continue
        X = group[FEATURES]; y = group["delay_at_exit"]
        _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=26028)
        pred = joblib.load(path).predict(X_test)
        print(f"{segment}: MAE={mean_absolute_error(y_test,pred):.3f} min, RMSE={mean_squared_error(y_test,pred)**0.5:.3f} min")

    lstm_path = MODEL_DIR / "lstm_model.h5"
    scaler_path = MODEL_DIR / "lstm_scaler.pkl"
    if lstm_path.exists() and scaler_path.exists():
        weather_map = {"clear":0.0,"cloudy":1.0,"rain":2.0,"storm":3.0}
        df["weather_numeric"] = df["weather_flag"].map(weather_map)
        seqs, targets, segs = [], [], []
        for _, journey in df.groupby("journey_id"):
            j = journey.sort_values("segment")
            vals = j[["delay_at_exit","weather_numeric","trains_ahead","day_of_week","time_of_day"]].to_numpy(dtype=np.float32)
            tar = j["delay_at_exit"].to_numpy(dtype=np.float32)
            names = j["segment"].tolist()
            for i in range(len(vals)):
                s = vals[max(0,i-2):i+1]
                if len(s)<3: s=np.vstack([np.repeat(s[[0]],3-len(s),axis=0),s])
                seqs.append(s); targets.append(tar[i]); segs.append(names[i])
        X=np.asarray(seqs); y=np.asarray(targets)
        scaler=joblib.load(scaler_path)
        X=scaler.transform(X.reshape(-1,5)).reshape(X.shape)
        pred=keras.models.load_model(lstm_path, compile=False).predict(X,verbose=0).ravel()
        print("\nLSTM evaluation")
        for seg in sorted(set(segs)):
            idx=[i for i,s in enumerate(segs) if s==seg]
            print(f"{seg}: MAE={mean_absolute_error(y[idx],pred[idx]):.3f} min, RMSE={mean_squared_error(y[idx],pred[idx])**0.5:.3f} min")

if __name__ == "__main__":
    main()
