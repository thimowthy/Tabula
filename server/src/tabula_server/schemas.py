from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserCredentials(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=8, max_length=200)

    @field_validator("username")
    @classmethod
    def _strip_username(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("username cannot be blank")
        return v


class UserPublic(BaseModel):
    id: str
    username: str

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class WorkflowStep(BaseModel):
    """Mirrors the frontend's WorkflowOperation shape ({id, type, params}) —
    named ``operation_type`` here to match the wire format tabula_engine's
    Step model already uses, so a stored workflow is directly compatible
    with the engine if it's ever run server-side."""

    id: str
    operation_type: str
    params: dict[str, Any] = Field(default_factory=dict)


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    tags: list[str] = Field(default_factory=list)
    steps: list[WorkflowStep] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be blank")
        return v

    @field_validator("tags")
    @classmethod
    def _normalize_tags(cls, tags: list[str]) -> list[str]:
        seen: dict[str, None] = {}
        for tag in tags:
            cleaned = tag.strip()
            if cleaned:
                seen.setdefault(cleaned, None)
        return list(seen.keys())


class WorkflowPublic(BaseModel):
    id: str
    name: str
    tags: list[str]
    steps: list[WorkflowStep]
    creator: UserPublic
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
