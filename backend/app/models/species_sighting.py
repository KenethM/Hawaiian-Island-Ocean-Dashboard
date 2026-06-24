from datetime import datetime
from sqlalchemy import String, Integer, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class SpeciesSighting(Base):
    __tablename__ = "species_sightings"

    id: Mapped[int] = mapped_column(primary_key=True)
    diver_log_id: Mapped[int] = mapped_column(
        ForeignKey("diver_logs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    species_name: Mapped[str] = mapped_column(String(200), nullable=False)
    count: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
