from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class DiverLogPhoto(Base):
    __tablename__ = "diver_log_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    diver_log_id: Mapped[int] = mapped_column(
        ForeignKey("diver_logs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_name: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
