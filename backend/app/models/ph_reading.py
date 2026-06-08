from datetime import datetime
from sqlalchemy import String, Float, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class PhReading(Base):
    __tablename__ = "ph_readings"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    location_name: Mapped[str | None] = mapped_column(String(200))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ph: Mapped[float | None] = mapped_column(Float)
    pco2: Mapped[float | None] = mapped_column(Float)
    aragonite_sat: Mapped[float | None] = mapped_column(Float)
    data_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
