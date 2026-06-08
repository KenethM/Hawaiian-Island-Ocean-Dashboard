from datetime import datetime, date
from sqlalchemy import String, Float, Text, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class DiverLog(Base):
    __tablename__ = "diver_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    reef_site_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    diver_name: Mapped[str | None] = mapped_column(String(200))
    dive_date: Mapped[date] = mapped_column(Date, nullable=False)
    depth_m: Mapped[float | None] = mapped_column(Float)
    coral_cover_pct: Mapped[float | None] = mapped_column(Float)
    bleaching_pct: Mapped[float | None] = mapped_column(Float)
    bleaching_severity: Mapped[str | None] = mapped_column(String(20))
    water_temp_c: Mapped[float | None] = mapped_column(Float)
    visibility_m: Mapped[float | None] = mapped_column(Float)
    species_notes: Mapped[str | None] = mapped_column(Text)
    general_notes: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
