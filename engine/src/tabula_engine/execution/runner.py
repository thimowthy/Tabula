"""Ties all three layers together: definition -> I/O -> engine -> execution
record. This is the one place in the codebase that needs to know how the
pieces fit; everything upstream (readers, executors, repositories) only
knows its own Protocol.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tabula_engine.definition.models import Workflow
from tabula_engine.engine.executor import Executor
from tabula_engine.io.reader import SpreadsheetReader

from .models import OutputPointer, Run, RunStatus, ValidationIssue, ValidationReport
from .repository import RunRepository


def _now() -> datetime:
    return datetime.now(timezone.utc)


class WorkflowRunner:
    def __init__(self, reader: SpreadsheetReader, executor: Executor, repository: RunRepository):
        self._reader = reader
        self._executor = executor
        self._repository = repository

    def run(
        self,
        workflow: Workflow,
        version: int,
        input_path: str | Path,
        params: dict[str, Any] | None = None,
    ) -> Run:
        workflow_version = workflow.get_version(version)

        run = Run(workflow_id=workflow.id, workflow_version=version, status=RunStatus.PENDING, params=params or {})
        self._repository.append(run)

        run = run.as_update(status=RunStatus.RUNNING)
        self._repository.append(run)

        try:
            tables = self._reader.read(input_path)
        except Exception as exc:  # I/O failure: nothing to validate, the run just failed
            return self._fail(run, str(exc))

        if not tables:
            return self._fail(run, "Nenhuma tabela encontrada no arquivo de entrada.")

        # v0: single-table workflows. Multi-table fan-out (one workflow run per
        # detected table, or steps addressing a specific table) is a natural
        # extension point once there's a concrete need for it.
        table = tables[0]
        run = run.as_update(input_source=table.source)

        try:
            outcome = self._executor.run(table, workflow_version.steps)
        except Exception as exc:
            return self._fail(run, str(exc))

        report = ValidationReport(issues=[ValidationIssue.from_execution_issue(i) for i in outcome.issues])
        status = RunStatus.FAILED if report.has_errors else RunStatus.SUCCEEDED
        output = OutputPointer(kind="inline", inline_row_count=len(outcome.table.rows))

        run = run.as_update(status=status, validation_report=report, output=output, finished_at=_now())
        self._repository.append(run)
        return run

    def _fail(self, run: Run, message: str) -> Run:
        run = run.as_update(status=RunStatus.FAILED, error_message=message, finished_at=_now())
        self._repository.append(run)
        return run
