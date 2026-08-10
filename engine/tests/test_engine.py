from tabula_engine.canonical.model import CanonicalColumn, CanonicalTable, SourceRef
from tabula_engine.common.types import ColumnType
from tabula_engine.definition.models import Step
from tabula_engine.engine.polars_engine import PolarsExecutor


def _table() -> CanonicalTable:
    return CanonicalTable(
        columns=[
            CanonicalColumn(name="Nome ", type=ColumnType.TEXT),
            CanonicalColumn(name="Idade", type=ColumnType.TEXT),
        ],
        rows=[
            {"Nome ": " Ana ", "Idade": "30"},
            {"Nome ": " Bruno", "Idade": "não é número"},
        ],
        source=SourceRef(file_name="t.csv", sheet_name="t"),
    )


def test_polars_executor_runs_pipeline_and_reports_cast_issue():
    steps = [
        Step(operation_type="trim_whitespace", params={"columns": []}),
        Step(operation_type="rename_column", params={"column": "Nome ", "new_name": "nome"}),
        Step(operation_type="cast_column_type", params={"column": "Idade", "target_type": "number"}),
    ]

    outcome = PolarsExecutor().run(_table(), steps)

    assert outcome.table.column_names() == ["nome", "Idade"]
    assert outcome.table.rows[0]["nome"] == "Ana"
    assert outcome.table.rows[1]["nome"] == "Bruno"
    assert outcome.table.rows[1]["Idade"] is None  # "não é número" couldn't cast

    assert len(outcome.issues) == 1
    assert outcome.issues[0].column_name == "Idade"
    assert outcome.issues[0].row_index == 1
    assert outcome.issues[0].severity == "warning"


def test_filter_and_fill_null():
    table = CanonicalTable(
        columns=[CanonicalColumn(name="qtd", type=ColumnType.NUMBER)],
        rows=[{"qtd": 1}, {"qtd": None}, {"qtd": 3}],
        source=SourceRef(file_name="t.csv", sheet_name="t"),
    )
    steps = [
        Step(operation_type="fill_null", params={"column": "qtd", "value": 0}),
        Step(operation_type="filter_rows", params={"column": "qtd", "operator": "gt", "value": 0}),
    ]
    outcome = PolarsExecutor().run(table, steps)
    assert [r["qtd"] for r in outcome.table.rows] == [1.0, 3.0]


def test_unknown_operation_type_raises():
    from tabula_engine.errors import NoCompilerForOperation, UnknownOperationType

    steps = [Step(operation_type="does_not_exist", params={})]
    try:
        PolarsExecutor().run(_table(), steps)
        assert False, "expected an error"
    except (UnknownOperationType, NoCompilerForOperation):
        pass
