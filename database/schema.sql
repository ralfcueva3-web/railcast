CREATE TABLE IF NOT EXISTS trains (
  train_no INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  source_code VARCHAR(8) NOT NULL,
  destination_code VARCHAR(8) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS stations (
  code VARCHAR(8) PRIMARY KEY,
  name TEXT NOT NULL,
  distance_km NUMERIC(8,2) NOT NULL,
  scheduled_arrival TIME,
  scheduled_departure TIME,
  platform INTEGER
);
CREATE TABLE IF NOT EXISTS segments (
  id BIGSERIAL PRIMARY KEY,
  station_from VARCHAR(8) NOT NULL REFERENCES stations(code),
  station_to VARCHAR(8) NOT NULL REFERENCES stations(code),
  distance_km NUMERIC(8,2) NOT NULL,
  UNIQUE(station_from,station_to)
);
CREATE TABLE IF NOT EXISTS historical_delays (
  id BIGSERIAL PRIMARY KEY,
  train_no INTEGER NOT NULL REFERENCES trains(train_no),
  segment VARCHAR(32) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  weather_flag VARCHAR(16) NOT NULL,
  trains_ahead INTEGER NOT NULL DEFAULT 0,
  delay_at_entry NUMERIC(8,2) NOT NULL,
  delay_at_exit NUMERIC(8,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hist_segment_time ON historical_delays(segment, observed_at DESC);
CREATE TABLE IF NOT EXISTS predictions (
  id BIGSERIAL PRIMARY KEY,
  train_no INTEGER NOT NULL REFERENCES trains(train_no),
  station_code VARCHAR(8) NOT NULL REFERENCES stations(code),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  p10 TIMESTAMPTZ NOT NULL,
  p50 TIMESTAMPTZ NOT NULL,
  p90 TIMESTAMPTZ NOT NULL,
  model_confidence NUMERIC(5,2) NOT NULL
);
