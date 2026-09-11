export interface Station {
  code: string;
  name: string;
  distance_km: number;
  scheduled_arrival: string | null;
  scheduled_departure: string | null;
  platform: number | null;
}

export interface ConfidenceBand {
  p10: string;
  p50: string;
  p90: string;
  width_minutes: number;
}

export interface ETAPrediction {
  station: Station;
  eta: string;
  delay_minutes: number;
  confidence: ConfidenceBand;
  status: "early" | "on_time" | "delayed" | "late";
}

export interface Train {
  train_no: string;
  name: string;
  source: string;
  destination: string;
  current_station: string;
  current_delay: number;
  status: string;
}

export interface ETAResponse {
  train_no: string;
  generated_at: string;
  current_station: string;
  current_delay_minutes: number;
  model_confidence: number;
  insight: string;
  predictions: ETAPrediction[];
}

export interface LiveUpdate {
  train_no: string;
  generated_at: string;
  current_station: string;
  current_delay_minutes: number;
  model_confidence: number;
  predictions: ETAPrediction[];
}