from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field

Affiliation = Literal["recreational", "researcher", "educator", "professional", "community"]
CertLevel = Literal["none", "open_water", "advanced", "rescue", "divemaster", "instructor"]


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None
    affiliation: Affiliation | None = None
    cert_level: CertLevel | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    email: str
    full_name: str | None
    affiliation: str | None
    cert_level: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
