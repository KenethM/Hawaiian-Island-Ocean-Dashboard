from datetime import datetime, date
from typing import Literal
from pydantic import BaseModel, Field


BleachingSeverity = Literal["none", "mild", "moderate", "severe", "mortality"]


class DiverLogCreate(BaseModel):
    reef_site_id: str
    diver_name: str | None = None
    dive_date: date
    depth_m: float | None = Field(None, ge=0, le=200)
    coral_cover_pct: float | None = Field(None, ge=0, le=100)
    bleaching_pct: float | None = Field(None, ge=0, le=100)
    bleaching_severity: BleachingSeverity | None = None
    water_temp_c: float | None = Field(None, ge=0, le=40)
    visibility_m: float | None = Field(None, ge=0, le=100)
    species_notes: str | None = None
    general_notes: str | None = None


class DiverLogRead(DiverLogCreate):
    id: int
    user_id: int | None = None
    submitted_at: datetime

    model_config = {"from_attributes": True}
