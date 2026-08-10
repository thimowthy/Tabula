"""Layer 1 — Definition: the declarative, versioned workflow spec.

Everything here is a plain, JSON-serializable description of *what* should
happen to the data. Nothing here knows how to actually do it — that's the
engine's job (see ``tabula_engine.engine``).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from tabula_engine.common.types import ColumnType
from .operations.base import OperationSpec, parse_operation


class TargetColumn(BaseModel):
    """A column the published workflow output is expected to contain."""

    name: str
    type: ColumnType
    required: bool = True

    model_config = ConfigDict(frozen=True)


class TargetSchema(BaseModel):
    """The shape the canonical output table must conform to once all steps run."""

    columns: list[TargetColumn]

    model_config = ConfigDict(frozen=True)


class Step(BaseModel):
    """One entry in a workflow version's pipeline.

    ``operation_type`` + ``params`` is the wire format (plain string + dict),
    kept deliberately generic so ``Step`` never has to know about every
    concrete ``OperationSpec`` subclass that exists — new operation types
    don't require touching this model. Call ``.operation()`` to resolve and
    validate it against the registry on demand.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operation_type: str
    params: dict[str, Any] = Field(default_factory=dict)
    label: str | None = None

    model_config = ConfigDict(frozen=True)

    def operation(self) -> OperationSpec:
        return parse_operation(self.operation_type, self.params)


class WorkflowVersion(BaseModel):
    """An immutable, published snapshot of a workflow's pipeline.

    Once created it is never mutated — editing means building a new
    ``WorkflowVersion`` and appending it via ``Workflow.with_new_version``.
    """

    version: int
    steps: list[Step]
    target_schema: TargetSchema
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    changelog: str | None = None

    model_config = ConfigDict(frozen=True)


class Workflow(BaseModel):
    """A named workflow and its append-only history of published versions."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    versions: list[WorkflowVersion] = Field(default_factory=list)

    model_config = ConfigDict(frozen=True)

    @property
    def latest_version(self) -> WorkflowVersion | None:
        return self.versions[-1] if self.versions else None

    def get_version(self, version: int) -> WorkflowVersion:
        for v in self.versions:
            if v.version == version:
                return v
        raise ValueError(f"Workflow {self.id!r} has no version {version}")

    def with_new_version(self, steps: list[Step], target_schema: TargetSchema, changelog: str | None = None) -> "Workflow":
        """Returns a *new* Workflow with one more version appended. Never mutates
        ``self`` or any existing WorkflowVersion — this is what "versions are
        immutable / append-only" means in practice."""

        next_version = (self.latest_version.version + 1) if self.latest_version else 1
        new_version = WorkflowVersion(
            version=next_version,
            steps=steps,
            target_schema=target_schema,
            changelog=changelog,
        )
        return self.model_copy(update={"versions": [*self.versions, new_version]})
