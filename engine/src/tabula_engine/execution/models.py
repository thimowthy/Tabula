"""Layer 3 — Execution: an immutable, append-only record of each run.

``Run`` instances are never mutated. "Updating" a run's status means building
a new ``Run`` with the same ``id`` and appending it to the repository — the
repository is the append-only log; "the current state of a run" is just its
latest snapshot. See ``tabula_engine.execution.repository``.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from tabula_engine.canonical.model import CellOrigin, SourceRef
from tabula_engine.engine.executor import ExecutionIssue


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class ValidationIssue(BaseModel):
    """An ExecutionIssue promoted into the run's permanent record, plus
    whatever source-file provenance we could resolve for it."""

    severity: Literal["error", "warning"]
    message: str
    step_id: str | None = None
    origin: CellOrigin | None = None

    model_config = ConfigDict(frozen=True)

    @classmethod
    def from_execution_issue(cls, issue: ExecutionIssue, origin: CellOrigin | None = None) -> "ValidationIssue":
        return cls(severity=issue.severity, message=issue.message, step_id=issue.step_id, origin=origin)


class ValidationReport(BaseModel):
    issues: list[ValidationIssue] = Field(default_factory=list)

    model_config = ConfigDict(frozen=True)

    @property
    def has_errors(self) -> bool:
        return any(i.severity == "error" for i in self.issues)


class OutputPointer(BaseModel):
    """Where the run's output table can be retrieved. Concrete storage
    (filesystem, object storage, DB blob) is deliberately not decided here —
    this is a stub for that future integration."""

    kind: Literal["file", "inline"]
    uri: str | None = None
    inline_row_count: int | None = None

    model_config = ConfigDict(frozen=True)


class Run(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    workflow_version: int
    input_source: SourceRef | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    status: RunStatus
    validation_report: ValidationReport | None = None
    output: OutputPointer | None = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: datetime | None = None
    error_message: str | None = None

    model_config = ConfigDict(frozen=True)

    def as_update(self, **changes: Any) -> "Run":
        """Returns a new Run snapshot with ``changes`` applied, same id. Never
        mutates ``self`` — callers append the result to the repository rather
        than replacing anything in place."""

        return self.model_copy(update=changes)
