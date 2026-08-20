from tabula_engine.canonical.model import CanonicalColumn, CanonicalTable, SourceRef
from tabula_engine.common.types import ColumnType
from tabula_engine.definition.models import Step
from tabula_engine.engine.polars_engine import PolarsExecutor


def _table(columns, rows) -> CanonicalTable:
    return CanonicalTable(columns=columns, rows=rows, source=SourceRef(file_name="t.csv", sheet_name="t"))


def test_cast_to_integer_and_float():
    table = _table(
        [CanonicalColumn(name="qtd", type=ColumnType.TEXT)],
        [{"qtd": "10.7"}, {"qtd": "abc"}],
    )
    outcome = PolarsExecutor().run(table, [Step(operation_type="cast_to_integer", params={"column": "qtd"})])
    assert outcome.table.rows[0]["qtd"] == 10
    assert outcome.table.rows[1]["qtd"] is None
    assert len(outcome.issues) == 1

    table2 = _table([CanonicalColumn(name="qtd", type=ColumnType.TEXT)], [{"qtd": "10.7"}])
    outcome2 = PolarsExecutor().run(table2, [Step(operation_type="cast_to_float", params={"column": "qtd"})])
    assert outcome2.table.rows[0]["qtd"] == 10.7


def test_cast_to_float_parses_brazilian_decimal_format():
    table = _table(
        [CanonicalColumn(name="preco", type=ColumnType.TEXT)],
        [{"preco": "1.234,56"}, {"preco": "12,5"}, {"preco": "3"}, {"preco": "abc"}],
    )
    outcome = PolarsExecutor().run(table, [Step(operation_type="cast_to_float", params={"column": "preco"})])
    assert outcome.table.rows[0]["preco"] == 1234.56
    assert outcome.table.rows[1]["preco"] == 12.5
    assert outcome.table.rows[2]["preco"] == 3
    assert outcome.table.rows[3]["preco"] is None
    assert len(outcome.issues) == 1


def test_cast_to_integer_parses_brazilian_decimal_format():
    table = _table(
        [CanonicalColumn(name="qtd", type=ColumnType.TEXT)],
        [{"qtd": "1.234,56"}],
    )
    outcome = PolarsExecutor().run(table, [Step(operation_type="cast_to_integer", params={"column": "qtd"})])
    assert outcome.table.rows[0]["qtd"] == 1234


def test_cast_to_datetime():
    table = _table(
        [CanonicalColumn(name="quando", type=ColumnType.TEXT)],
        [{"quando": "2024-01-15 10:30:00"}, {"quando": "not a date"}],
    )
    outcome = PolarsExecutor().run(table, [Step(operation_type="cast_to_datetime", params={"column": "quando"})])
    assert outcome.table.rows[0]["quando"] is not None
    assert outcome.table.rows[1]["quando"] is None
    assert len(outcome.issues) == 1
    assert outcome.table.columns[0].type == ColumnType.DATE


def test_split_column_drops_original_by_default_and_flags_overflow():
    table = _table(
        [CanonicalColumn(name="nome_completo", type=ColumnType.TEXT)],
        [{"nome_completo": "Ana Maria Silva"}, {"nome_completo": "Bruno"}],
    )
    outcome = PolarsExecutor().run(
        table,
        [
            Step(
                operation_type="split_column",
                params={"column": "nome_completo", "delimiter": " ", "into": ["primeiro", "segundo"]},
            )
        ],
    )
    assert outcome.table.column_names() == ["primeiro", "segundo"]
    assert outcome.table.rows[0] == {"primeiro": "Ana", "segundo": "Maria"}
    assert outcome.table.rows[1] == {"primeiro": "Bruno", "segundo": None}
    assert len(outcome.issues) == 1  # "Ana Maria Silva" overflowed into columns


def test_split_column_can_keep_original():
    table = _table([CanonicalColumn(name="tag", type=ColumnType.TEXT)], [{"tag": "a-b"}])
    outcome = PolarsExecutor().run(
        table,
        [
            Step(
                operation_type="split_column",
                params={"column": "tag", "delimiter": "-", "into": ["x", "y"], "keep_original": True},
            )
        ],
    )
    assert outcome.table.column_names() == ["tag", "x", "y"]


def test_fill_constant_overwrites_every_row():
    table = _table(
        [CanonicalColumn(name="status", type=ColumnType.TEXT)],
        [{"status": "ok"}, {"status": None}],
    )
    outcome = PolarsExecutor().run(
        table, [Step(operation_type="fill_constant", params={"column": "status", "value": "pendente"})]
    )
    assert [r["status"] for r in outcome.table.rows] == ["pendente", "pendente"]


def test_fill_constant_from_another_column():
    table = _table(
        [CanonicalColumn(name="apelido", type=ColumnType.TEXT), CanonicalColumn(name="nome", type=ColumnType.TEXT)],
        [{"apelido": None, "nome": "Ana"}, {"apelido": "Bru", "nome": "Bruno"}],
    )
    outcome = PolarsExecutor().run(
        table,
        [
            Step(
                operation_type="fill_constant",
                params={"column": "apelido", "fill_type": "column", "source_column": "nome"},
            )
        ],
    )
    assert [r["apelido"] for r in outcome.table.rows] == ["Ana", "Bruno"]


def test_math_operation_constant_and_column_operands():
    table = _table(
        [CanonicalColumn(name="preco", type=ColumnType.NUMBER), CanonicalColumn(name="qtd", type=ColumnType.NUMBER)],
        [{"preco": 10.0, "qtd": 2.0}, {"preco": 5.0, "qtd": 3.0}],
    )
    outcome = PolarsExecutor().run(
        table,
        [
            Step(
                operation_type="math_operation",
                params={
                    "column": "preco",
                    "operator": "multiply",
                    "operand_type": "column",
                    "operand": "qtd",
                    "output_column": "total",
                },
            ),
            Step(
                operation_type="math_operation",
                params={"column": "total", "operator": "add", "operand_type": "constant", "operand": 1},
            ),
        ],
    )
    assert [r["total"] for r in outcome.table.rows] == [21.0, 16.0]
    assert outcome.table.column_names() == ["preco", "qtd", "total"]


def test_reorder_column_moves_before_target():
    table = _table(
        [
            CanonicalColumn(name="a", type=ColumnType.TEXT),
            CanonicalColumn(name="b", type=ColumnType.TEXT),
            CanonicalColumn(name="c", type=ColumnType.TEXT),
            CanonicalColumn(name="d", type=ColumnType.TEXT),
        ],
        [{"a": "1", "b": "2", "c": "3", "d": "4"}],
    )
    outcome = PolarsExecutor().run(
        table, [Step(operation_type="reorder_column", params={"column": "d", "before": "b"})]
    )
    assert outcome.table.column_names() == ["a", "d", "b", "c"]
    assert outcome.table.rows[0] == {"a": "1", "d": "4", "b": "2", "c": "3"}


def test_reorder_column_to_end_when_before_is_none():
    table = _table(
        [CanonicalColumn(name="a", type=ColumnType.TEXT), CanonicalColumn(name="b", type=ColumnType.TEXT)],
        [{"a": "1", "b": "2"}],
    )
    outcome = PolarsExecutor().run(table, [Step(operation_type="reorder_column", params={"column": "a", "before": None})])
    assert outcome.table.column_names() == ["b", "a"]


def test_add_column_fills_default_value_for_every_row():
    table = _table([CanonicalColumn(name="nome", type=ColumnType.TEXT)], [{"nome": "Ana"}, {"nome": "Bruno"}])
    outcome = PolarsExecutor().run(
        table,
        [
            Step(
                operation_type="add_column",
                params={"name": "ativo", "column_type": "boolean", "default_value": True},
            )
        ],
    )
    assert outcome.table.column_names() == ["nome", "ativo"]
    assert [r["ativo"] for r in outcome.table.rows] == [True, True]
    assert outcome.table.columns[1].type == ColumnType.BOOLEAN


def test_add_column_defaults_to_null_when_no_value_given():
    table = _table([CanonicalColumn(name="nome", type=ColumnType.TEXT)], [{"nome": "Ana"}])
    outcome = PolarsExecutor().run(
        table, [Step(operation_type="add_column", params={"name": "obs", "column_type": "text"})]
    )
    assert outcome.table.rows[0]["obs"] is None


def test_pad_string_keeps_column_as_text():
    table = _table([CanonicalColumn(name="cep", type=ColumnType.NUMBER)], [{"cep": "123"}, {"cep": "4"}])
    outcome = PolarsExecutor().run(
        table,
        [Step(operation_type="pad_string", params={"column": "cep", "length": 5, "pad_char": "0", "side": "left"})],
    )
    assert [r["cep"] for r in outcome.table.rows] == ["00123", "00004"]
    assert outcome.table.columns[0].type == ColumnType.TEXT


def test_promote_header_row_renames_columns_and_drops_rows_above():
    table = _table(
        [CanonicalColumn(name="col_0", type=ColumnType.TEXT), CanonicalColumn(name="col_1", type=ColumnType.TEXT)],
        [
            {"col_0": "Relatório mensal", "col_1": None},
            {"col_0": "nome", "col_1": "idade"},
            {"col_0": "Ana", "col_1": "30"},
            {"col_0": "Bruno", "col_1": "25"},
        ],
    )
    outcome = PolarsExecutor().run(
        table, [Step(operation_type="promote_header_row", params={"row_index": 1})]
    )
    assert outcome.table.column_names() == ["nome", "idade"]
    assert outcome.table.rows == [{"nome": "Ana", "idade": "30"}, {"nome": "Bruno", "idade": "25"}]


def test_fill_null_from_another_column():
    table = _table(
        [CanonicalColumn(name="apelido", type=ColumnType.TEXT), CanonicalColumn(name="nome", type=ColumnType.TEXT)],
        [{"apelido": None, "nome": "Ana"}, {"apelido": "Bru", "nome": "Bruno"}],
    )
    outcome = PolarsExecutor().run(
        table,
        [
            Step(
                operation_type="fill_null",
                params={"column": "apelido", "fill_type": "column", "source_column": "nome"},
            )
        ],
    )
    assert [r["apelido"] for r in outcome.table.rows] == ["Ana", "Bru"]


def test_fill_null_constant_still_works_without_fill_type():
    table = _table([CanonicalColumn(name="status", type=ColumnType.TEXT)], [{"status": None}])
    outcome = PolarsExecutor().run(
        table, [Step(operation_type="fill_null", params={"column": "status", "value": "pendente"})]
    )
    assert outcome.table.rows[0]["status"] == "pendente"


def test_fix_decimal_places_pads_and_uses_comma():
    table = _table([CanonicalColumn(name="preco", type=ColumnType.NUMBER)], [{"preco": 5.0}, {"preco": 3.14159}])
    outcome = PolarsExecutor().run(
        table, [Step(operation_type="fix_decimal_places", params={"column": "preco", "decimals": 2})]
    )
    assert [r["preco"] for r in outcome.table.rows] == ["5,00", "3,14"]
    assert outcome.table.columns[0].type == ColumnType.TEXT


def test_change_case_upper_lower_and_title():
    table = _table([CanonicalColumn(name="nome", type=ColumnType.TEXT)], [{"nome": "ana maria silva"}, {"nome": None}])
    outcome_upper = PolarsExecutor().run(
        table, [Step(operation_type="change_case", params={"column": "nome", "case_type": "upper"})]
    )
    assert [r["nome"] for r in outcome_upper.table.rows] == ["ANA MARIA SILVA", None]

    outcome_lower = PolarsExecutor().run(
        _table([CanonicalColumn(name="nome", type=ColumnType.TEXT)], [{"nome": "ANA MARIA SILVA"}]),
        [Step(operation_type="change_case", params={"column": "nome", "case_type": "lower"})],
    )
    assert outcome_lower.table.rows[0]["nome"] == "ana maria silva"

    outcome_title = PolarsExecutor().run(
        _table([CanonicalColumn(name="nome", type=ColumnType.TEXT)], [{"nome": "ana maria silva"}]),
        [Step(operation_type="change_case", params={"column": "nome", "case_type": "title"})],
    )
    assert outcome_title.table.rows[0]["nome"] == "Ana Maria Silva"


def test_change_case_casts_numeric_column_to_text():
    table = _table([CanonicalColumn(name="cod", type=ColumnType.NUMBER)], [{"cod": 123}])
    outcome = PolarsExecutor().run(
        table, [Step(operation_type="change_case", params={"column": "cod", "case_type": "upper"})]
    )
    assert outcome.table.rows[0]["cod"] == "123.0"
    assert outcome.table.columns[0].type == ColumnType.TEXT


def test_promote_header_row_out_of_range_is_a_noop_warning():
    table = _table([CanonicalColumn(name="a", type=ColumnType.TEXT)], [{"a": "1"}])
    outcome = PolarsExecutor().run(table, [Step(operation_type="promote_header_row", params={"row_index": 5})])
    assert outcome.table.column_names() == ["a"]
    assert outcome.table.rows == [{"a": "1"}]
    assert len(outcome.issues) == 1
    assert outcome.issues[0].severity == "warning"
