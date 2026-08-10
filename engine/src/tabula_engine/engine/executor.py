"""The engine-neutral executor interface. Nothing in this module imports
Polars, DuckDB, or any other engine — that's the point: this is the seam
principle 4 asks for. A concrete engine (``tabula_engine.engine.polars_engine``)
implements ``Executor`` and owns its own operation-type -> native-call mapping.
Swapping engines means writing a new implementation of this Protocol; the
``Step``/``OperationSpec`` definitions above it never change.
"""

from __future__ import annotations

from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict

from tabula_engine.canonical.model import CanonicalTable
from tabula_engine.definition.models import Step

Severity = Literal["error", "warning"]


class ExecutionIssue(BaseModel):
    """One thing worth flagging that happened while compiling/running a step —
    e.g. a cell that couldn't be coerced to the target type. Rolled up into
    the execution layer's ValidationReport once a full run finishes."""

    severity: Severity
    message: str
    step_id: str | None = None
    row_index: int | None = None
    """Row index within the CanonicalTable being transformed, not the source file."""
    column_name: str | None = None

    model_config = ConfigDict(frozen=True)


class ExecutionOutcome(BaseModel):
    table: CanonicalTable
    issues: list[ExecutionIssue] = []

    model_config = ConfigDict(frozen=True)

    @property
    def has_errors(self) -> bool:
        return any(i.severity == "error" for i in self.issues)


class Executor(Protocol):
    """Runs a sequence of declarative Steps against a CanonicalTable."""

    name: str

    def run(self, table: CanonicalTable, steps: list[Step]) -> ExecutionOutcome: ...
