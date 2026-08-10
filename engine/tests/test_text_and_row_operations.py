from tabula_engine.canonical.model import CanonicalColumn, CanonicalTable, SourceRef
from tabula_engine.common.types import ColumnType
from tabula_engine.definition.models import Step
from tabula_engine.engine.polars_engine import PolarsExecutor


def _table(columns, rows) -> CanonicalTable:
    return CanonicalTable(columns=columns, rows=rows, source=SourceRef(file_name="t.csv", sheet_name="t"))


def test_concat_columns_builds_string_from_template():
    table = _table(
        [CanonicalColumn(name="first", type=ColumnType.TEXT), CanonicalColumn(name="last", type=ColumnType.TEXT)],
        [{"first": "Ana", "last": "Silva"}, {"first": "Bruno", "last": None}],
    )
    outcome = PolarsExecutor().run(
        table,
        [
            Step(
                operation_type="concat_columns",
                params={"template": "{first} {last}", "output_column": "nome_completo"},
            )
        ],
    )
    assert outcome.table.rows[0]["nome_completo"] == "Ana Silva"
    assert outcome.table.rows[1]["nome_completo"] == "Bruno "
    assert outcome.table.columns[-1].name == "nome_completo"
    assert outcome.table.columns[-1].type == ColumnType.TEXT


def test_replace_supports_literal_and_regex():
    table = _table(
        [CanonicalColumn(name="tel", type=ColumnType.TEXT)],
        [{"tel": "(11) 91234-5678"}],
    )
    outcome = PolarsExecutor().run(
        table,
        [Step(operation_type="replace", params={"column": "tel", "find": r"[^\d]", "replace": "", "regex": True})],
    )
    assert outcome.table.rows[0]["tel"] == "11912345678"


def test_replace_literal_is_case_insensitive_when_match_case_false():
    table = _table([CanonicalColumn(name="s", type=ColumnType.TEXT)], [{"s": "Hello WORLD"}])
    outcome = PolarsExecutor().run(
        table,
        [
            Step(
                operation_type="replace",
                params={"column": "s", "find": "world", "replace": "there", "regex": False, "match_case": False},
            )
        ],
    )
    assert outcome.table.rows[0]["s"] == "Hello there"


def test_extract_pulls_capture_group_into_new_column():
    table = _table(
        [CanonicalColumn(name="email", type=ColumnType.TEXT)],
        [{"email": "ana@example.com"}, {"email": "sem-arroba"}],
    )
    outcome = PolarsExecutor().run(
        table,
        [
            Step(
                operation_type="extract",
                params={"column": "email", "pattern": r"^([^@]+)@", "group": 1, "output_column": "usuario"},
            )
        ],
    )
    assert outcome.table.rows[0]["usuario"] == "ana"
    assert outcome.table.rows[1]["usuario"] is None
    assert outcome.table.column_names() == ["email", "usuario"]


def test_map_values_leaves_unmapped_values_untouched():
    table = _table([CanonicalColumn(name="sexo", type=ColumnType.TEXT)], [{"sexo": "M"}, {"sexo": "F"}, {"sexo": "X"}])
    outcome = PolarsExecutor().run(
        table,
        [Step(operation_type="map_values", params={"column": "sexo", "mapping": {"M": "Masculino", "F": "Feminino"}})],
    )
    assert [r["sexo"] for r in outcome.table.rows] == ["Masculino", "Feminino", "X"]


def test_round_rounds_to_decimals():
    table = _table([CanonicalColumn(name="preco", type=ColumnType.NUMBER)], [{"preco": 10.567}, {"preco": "abc"}])
    outcome = PolarsExecutor().run(table, [Step(operation_type="round", params={"column": "preco", "decimals": 2})])
    assert outcome.table.rows[0]["preco"] == 10.57
    assert outcome.table.rows[1]["preco"] is None


def test_deduplicate_keeps_first_occurrence():
    table = _table(
        [CanonicalColumn(name="a", type=ColumnType.TEXT), CanonicalColumn(name="b", type=ColumnType.TEXT)],
        [{"a": "1", "b": "x"}, {"a": "1", "b": "x"}, {"a": "1", "b": "y"}, {"a": "2", "b": "z"}],
    )
    outcome = PolarsExecutor().run(table, [Step(operation_type="deduplicate", params={"columns": ["a", "b"]})])
    assert outcome.table.rows == [{"a": "1", "b": "x"}, {"a": "1", "b": "y"}, {"a": "2", "b": "z"}]


def test_deduplicate_with_no_columns_considers_whole_row():
    table = _table(
        [CanonicalColumn(name="a", type=ColumnType.TEXT)],
        [{"a": "1"}, {"a": "1"}, {"a": "2"}],
    )
    outcome = PolarsExecutor().run(table, [Step(operation_type="deduplicate", params={})])
    assert [r["a"] for r in outcome.table.rows] == ["1", "2"]
