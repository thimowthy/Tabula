from pathlib import Path

from tabula_engine.common.types import ColumnType
from tabula_engine.definition.models import Step, TargetColumn, TargetSchema, Workflow
from tabula_engine.engine.polars_engine import PolarsExecutor
from tabula_engine.execution.models import RunStatus
from tabula_engine.execution.repository import InMemoryRunRepository
from tabula_engine.execution.runner import WorkflowRunner
from tabula_engine.io.csv_reader import CsvReader


def test_end_to_end_run_succeeds_with_warning(tmp_path: Path):
    csv_path = tmp_path / "clientes.csv"
    csv_path.write_text("Nome, Idade\n Ana ,30\nBruno,não é número\n", encoding="utf-8")

    workflow = Workflow(name="Padronizar clientes").with_new_version(
        steps=[
            Step(operation_type="trim_whitespace", params={"columns": []}),
            Step(operation_type="cast_column_type", params={"column": " Idade", "target_type": "number"}),
        ],
        target_schema=TargetSchema(columns=[TargetColumn(name="Nome", type=ColumnType.TEXT)]),
    )

    repository = InMemoryRunRepository()
    runner = WorkflowRunner(reader=CsvReader(), executor=PolarsExecutor(), repository=repository)
    run = runner.run(workflow, version=1, input_path=csv_path)

    assert run.status == RunStatus.SUCCEEDED
    assert run.validation_report is not None
    assert len(run.validation_report.issues) == 1
    assert run.validation_report.issues[0].severity == "warning"
    assert run.output.inline_row_count == 2

    history = repository.history(run.id)
    assert [r.status for r in history] == [RunStatus.PENDING, RunStatus.RUNNING, RunStatus.SUCCEEDED]
    # append-only: the run object returned is a distinct snapshot from earlier ones
    assert history[0] is not history[-1]


def test_run_fails_cleanly_on_unknown_operation(tmp_path: Path):
    csv_path = tmp_path / "clientes.csv"
    csv_path.write_text("Nome\nAna\n", encoding="utf-8")

    workflow = Workflow(name="Quebrado").with_new_version(
        steps=[Step(operation_type="does_not_exist", params={})],
        target_schema=TargetSchema(columns=[TargetColumn(name="Nome", type=ColumnType.TEXT)]),
    )

    repository = InMemoryRunRepository()
    runner = WorkflowRunner(reader=CsvReader(), executor=PolarsExecutor(), repository=repository)
    run = runner.run(workflow, version=1, input_path=csv_path)

    assert run.status == RunStatus.FAILED
    assert run.error_message is not None
