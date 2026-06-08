from datetime import datetime
from pydantic import BaseModel


class PhReadingCreate(BaseModel):
    source: str
    location_name: str | None = None
    lat: float | None = None
    lng: float | None = None
    measured_at: datetime
    ph: float | None = None
    pco2: float | None = None
    aragonite_sat: float | None = None
    data_type: str


class PhReadingRead(PhReadingCreate):
    id: int
    submitted_at: datetime

    model_config = {"from_attributes": True}


class PhTrendPoint(BaseModel):
    date: str
    source: str
    avg_ph: float
    count: int


class PhPredictionPoint(BaseModel):
    date: str
    ph: float
    lower: float | None = None
    upper: float | None = None
    is_forecast: bool = False


class PhPrediction(BaseModel):
    trend: list[PhPredictionPoint]
    forecast: list[PhPredictionPoint]
    r_squared: float | None = None
