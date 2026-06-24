from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class AlertHistory(Base):
    __tablename__ = "alert_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    reef_site_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    alert_level: Mapped[int] = mapped_column(Integer, nullable=False)
    alert_label: Mapped[str] = mapped_column(String(50), nullable=False)
    sst_c: Mapped[float | None] = mapped_column(Float)
    dhw: Mapped[float | None] = mapped_column(Float)
    hotspot: Mapped[float | None] = mapped_column(Float)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
