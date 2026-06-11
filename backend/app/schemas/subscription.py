from datetime import datetime
from pydantic import BaseModel


class SubscriptionCreate(BaseModel):
    reef_site_id: str


class SubscriptionRead(BaseModel):
    id: int
    reef_site_id: str
    created_at: datetime
    last_notified_at: datetime | None = None

    model_config = {"from_attributes": True}
