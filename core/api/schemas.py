"""Request/response models for the core HTTP API.

Interactive clients (extension, Android, desktop) are lenient at the edges:
`context` accepts a canonical `FormSnapshot`, a raw bridge payload (CORE-004
normalizes it), or the `{"FormSnapshot": {...}}` envelope from the CORE-001 spec.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_serializer


class ParseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sessionId: str = Field(min_length=1)
    transcript: str = Field(min_length=1)
    context: dict[str, Any] | None = None
    history: list[dict[str, Any]] = Field(default_factory=list)

    @field_validator("context", mode="before")
    @classmethod
    def _unwrap_context(cls, value: Any) -> Any:
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                return None
        if isinstance(value, dict) and set(value) <= {"FormSnapshot", "formSnapshot"}:
            inner = value.get("FormSnapshot", value.get("formSnapshot"))
            if isinstance(inner, str):
                try:
                    inner = json.loads(inner)
                except json.JSONDecodeError:
                    return None
            return inner if isinstance(inner, dict) else None
        return value

    @field_validator("transcript")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()


class ClarifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sessionId: str = Field(min_length=1)
    clarificationText: str | None = None
    clarification: str | None = None  # alias tolerated for client convenience
    context: dict[str, Any] | None = None

    @property
    def text(self) -> str:
        return (self.clarificationText or self.clarification or "").strip()


class ClarifyResponse(BaseModel):
    sessionId: str
    commands: list[dict[str, Any]] = Field(default_factory=list)
    needsClarification: bool = False
    clarificationQuestion: str | None = None
    clarification: dict[str, Any] | None = None
    model: str | None = None


class ParseResponse(ClarifyResponse):
    pass


class SessionStateResponse(BaseModel):
    """`SessionState` (CONTRACT-001).

    `currentActiveNodeId` is omitted while unset instead of serialized as null,
    because the contract types it as a string; `currentContextSnapshot` stays
    explicit (`null`) because the contract requires the key.
    """

    model_config = ConfigDict(extra="allow")

    sessionId: str
    currentContextSnapshot: dict[str, Any] | None = None
    history: list[dict[str, Any]] = Field(default_factory=list)
    currentActiveNodeId: str | None = None
    formSteps: list[str] = Field(default_factory=list)

    @model_serializer(mode="wrap")
    def _omit_unset_active_node(self, handler):
        data = handler(self)
        if data.get("currentActiveNodeId") is None:
            data.pop("currentActiveNodeId", None)
        return data


class NormalizeResponse(BaseModel):
    snapshot: dict[str, Any]


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    provider: str
    sessionBackend: str
