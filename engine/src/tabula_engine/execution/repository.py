"""Append-only storage for Run snapshots.

Only an in-memory reference implementation lives here — a real backend
(Postgres, etc.) is future work and out of scope for this skeleton. The
Protocol is what matters: anything that can append and read back snapshots
satisfies it, so swapping in a durable store later doesn't touch
``WorkflowRunner`` or anything upstream of it.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Protocol

from .models import Run


class RunRepository(Protocol):
    def append(self, run: Run) -> None:
        """Adds a new snapshot for ``run.id``. Never overwrites a previous one."""
        ...

    def get_latest(self, run_id: str) -> Run | None: ...

    def history(self, run_id: str) -> list[Run]:
        """All snapshots for ``run_id``, oldest first."""
        ...

    def list_runs(self, workflow_id: str) -> list[Run]:
        """Latest snapshot of every run belonging to ``workflow_id``."""
        ...


class InMemoryRunRepository:
    """Reference implementation. Process-lifetime only — fine for tests and
    local development, not for anything that needs to survive a restart."""

    def __init__(self) -> None:
        self._snapshots: dict[str, list[Run]] = defaultdict(list)

    def append(self, run: Run) -> None:
        self._snapshots[run.id].append(run)

    def get_latest(self, run_id: str) -> Run | None:
        snapshots = self._snapshots.get(run_id)
        return snapshots[-1] if snapshots else None

    def history(self, run_id: str) -> list[Run]:
        return list(self._snapshots.get(run_id, []))

    def list_runs(self, workflow_id: str) -> list[Run]:
        return [
            snapshots[-1]
            for snapshots in self._snapshots.values()
            if snapshots and snapshots[-1].workflow_id == workflow_id
        ]
