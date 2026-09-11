from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

class Train(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    train_no: str
    name: str
    source: str
    destination: str
    current_station: str
    current_delay: float
    status: str

class Station(BaseModel):
    code: str
    name: str
    distance_km: float
    scheduled_arrival: Optional[str]
    scheduled_departure: Optional[str]
    platform: Optional[int]

class ConfidenceBand(BaseModel):
    p10: datetime
    p50: datetime
    p90: datetime
    width_minutes: float

class StationETAPrediction(BaseModel):
    station: Station
    eta: datetime
    delay_minutes: float
    confidence: ConfidenceBand
    status: str

class ETAPrediction(BaseModel):
    train_no: str
    generated_at: datetime
    current_station: str
    current_delay_minutes: float
    model_confidence: float = Field(ge=0, le=100)
    insight: str
    predictions: List[StationETAPrediction]

class LiveTrainState(BaseModel):
    train_no: str
    current_station: str
    delay_minutes: float
    weather_flag: str = "clear"
    trains_ahead: int = 2
    updated_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
    models: str
