import pytest

from tabula_engine.canonical.model import CanonicalColumn, CanonicalTable, SourceRef
from tabula_engine.common.types import ColumnType
from tabula_engine.definition.models import Step
from tabula_engine.engine.polars_engine import PolarsExecutor
from tabula_engine.errors import SpecValidationError


def _table(columns, rows) -> CanonicalTable:
    return CanonicalTable(columns=columns, rows=rows, source=SourceRef(file_name="t.csv", sheet_name="t"))


def test_when_if_then_else():
    table = _table(
        [CanonicalColumn(name="tipo", type=ColumnType.TEXT), CanonicalColumn(name="preco", type=ColumnType.NUMBER)],
        [{"tipo": "A", "preco": 10.0}, {"tipo": "B", "preco": 10.0}],
    )
    steps = [
        Step(
            operation_type="when",
            params={
                "cases": [
                    {
                        "condition": {"column": "tipo", "operator": "eq", "value": "A"},
                        "operations": [
                            {
                                "operation_type": "math_operation",
                                "params": {"column": "preco", "operator": "multiply", "operand_type": "constant", "operand": 2},
                            }
                        ],
                    }
                ],
                "default": [
                    {
                        "operation_type": "math_operation",
                        "params": {"column": "preco", "operator": "multiply", "operand_type": "constant", "operand": 3},
                    }
                ],
            },
        )
    ]
    outcome = PolarsExecutor().run(table, steps)
    assert [r["preco"] for r in outcome.table.rows] == [20.0, 30.0]


def test_when_default_none_leaves_unmatched_rows_unchanged():
    table = _table(
        [CanonicalColumn(name="tipo", type=ColumnType.TEXT), CanonicalColumn(name="preco", type=ColumnType.NUMBER)],
        [{"tipo": "A", "preco": 10.0}, {"tipo": "B", "preco": 10.0}],
    )
    steps = [
        Step(
            operation_type="when",
            params={
                "cases": [
                    {
                        "condition": {"column": "tipo", "operator": "eq", "value": "A"},
                        "operations": [
                            {
                                "operation_type": "math_operation",
                                "params": {"column": "preco", "operator": "multiply", "operand_type": "constant", "operand": 2},
                            }
                        ],
                    }
                ],
                "default": None,
            },
        )
    ]
    outcome = PolarsExecutor().run(table, steps)
    assert [r["preco"] for r in outcome.table.rows] == [20.0, 10.0]


def test_when_switch_style_multi_case_first_match_wins():
    table = _table(
        [CanonicalColumn(name="tipo", type=ColumnType.TEXT), CanonicalColumn(name="preco", type=ColumnType.NUMBER)],
        [{"tipo": "A", "preco": 1.0}, {"tipo": "B", "preco": 1.0}, {"tipo": "C", "preco": 1.0}, {"tipo": "D", "preco": 1.0}],
    )

    def _mult(n):
        return {
            "operation_type": "math_operation",
            "params": {"column": "preco", "operator": "multiply", "operand_type": "constant", "operand": n},
        }

    steps = [
        Step(
            operation_type="when",
            params={
                "cases": [
                    {"condition": {"column": "tipo", "operator": "eq", "value": "A"}, "operations": [_mult(2)]},
                    {"condition": {"column": "tipo", "operator": "eq", "value": "B"}, "operations": [_mult(3)]},
                    {"condition": {"column": "tipo", "operator": "neq", "value": "D"}, "operations": [_mult(5)]},
                ],
                "default": [_mult(100)],
            },
        )
    ]
    outcome = PolarsExecutor().run(table, steps)
    # C matches neither A nor B but does match "neq D" (3rd case) -> *5, not the default.
    assert [r["preco"] for r in outcome.table.rows] == [2.0, 3.0, 5.0, 100.0]


def test_when_composite_and_or_condition():
    table = _table(
        [
            CanonicalColumn(name="tipo", type=ColumnType.TEXT),
            CanonicalColumn(name="regiao", type=ColumnType.TEXT),
            CanonicalColumn(name="preco", type=ColumnType.NUMBER),
        ],
        [
            {"tipo": "A", "regiao": "sul", "preco": 1.0},
            {"tipo": "A", "regiao": "norte", "preco": 1.0},
            {"tipo": "B", "regiao": "sul", "preco": 1.0},
        ],
    )
    steps = [
        Step(
            operation_type="when",
            params={
                "cases": [
                    {
                        "condition": {
                            "logic": "and",
                            "conditions": [
                                {"column": "tipo", "operator": "eq", "value": "A"},
                                {"column": "regiao", "operator": "eq", "value": "sul"},
                            ],
                        },
                        "operations": [
                            {"operation_type": "fill_constant", "params": {"column": "preco", "value": 99.0}}
                        ],
                    }
                ],
                "default": None,
            },
        )
    ]
    outcome = PolarsExecutor().run(table, steps)
    assert [r["preco"] for r in outcome.table.rows] == [99.0, 1.0, 1.0]


def test_when_matches_operator():
    table = _table(
        [CanonicalColumn(name="codigo", type=ColumnType.TEXT), CanonicalColumn(name="valido", type=ColumnType.BOOLEAN)],
        [{"codigo": "AB123", "valido": False}, {"codigo": "xyz", "valido": False}],
    )
    steps = [
        Step(
            operation_type="when",
            params={
                "cases": [
                    {
                        "condition": {"column": "codigo", "operator": "matches", "value": r"^[A-Z]+\d+$"},
                        "operations": [{"operation_type": "fill_constant", "params": {"column": "valido", "value": True}}],
                    }
                ],
                "default": None,
            },
        )
    ]
    outcome = PolarsExecutor().run(table, steps)
    assert [r["valido"] for r in outcome.table.rows] == [True, False]


def test_when_nested_when_in_branch():
    table = _table(
        [
            CanonicalColumn(name="tipo", type=ColumnType.TEXT),
            CanonicalColumn(name="sub", type=ColumnType.TEXT),
            CanonicalColumn(name="preco", type=ColumnType.NUMBER),
        ],
        [
            {"tipo": "A", "sub": "x", "preco": 1.0},
            {"tipo": "A", "sub": "y", "preco": 1.0},
            {"tipo": "B", "sub": "x", "preco": 1.0},
        ],
    )
    inner_when = {
        "operation_type": "when",
        "params": {
            "cases": [
                {
                    "condition": {"column": "sub", "operator": "eq", "value": "x"},
                    "operations": [{"operation_type": "fill_constant", "params": {"column": "preco", "value": 10.0}}],
                }
            ],
            "default": [{"operation_type": "fill_constant", "params": {"column": "preco", "value": 20.0}}],
        },
    }
    steps = [
        Step(
            operation_type="when",
            params={
                "cases": [{"condition": {"column": "tipo", "operator": "eq", "value": "A"}, "operations": [inner_when]}],
                "default": [{"operation_type": "fill_constant", "params": {"column": "preco", "value": 0.0}}],
            },
        )
    ]
    outcome = PolarsExecutor().run(table, steps)
    assert [r["preco"] for r in outcome.table.rows] == [10.0, 20.0, 0.0]


def test_when_branch_changing_row_count_raises():
    table = _table(
        [CanonicalColumn(name="tipo", type=ColumnType.TEXT)],
        [{"tipo": "A"}, {"tipo": "B"}],
    )
    steps = [
        Step(
            operation_type="when",
            params={
                "cases": [
                    {
                        "condition": {"column": "tipo", "operator": "eq", "value": "A"},
                        "operations": [
                            {"operation_type": "filter_rows", "params": {"condition": {"column": "tipo", "operator": "eq", "value": "A"}}}
                        ],
                    }
                ],
                "default": None,
            },
        )
    ]
    with pytest.raises(SpecValidationError):
        PolarsExecutor().run(table, steps)


def test_when_branch_changing_column_set_raises():
    table = _table(
        [CanonicalColumn(name="tipo", type=ColumnType.TEXT)],
        [{"tipo": "A"}, {"tipo": "B"}],
    )
    steps = [
        Step(
            operation_type="when",
            params={
                "cases": [
                    {
                        "condition": {"column": "tipo", "operator": "eq", "value": "A"},
                        "operations": [
                            {
                                "operation_type": "add_column",
                                "params": {"name": "extra", "column_type": "text", "default_value": "x"},
                            }
                        ],
                    }
                ],
                "default": None,
            },
        )
    ]
    with pytest.raises(SpecValidationError):
        PolarsExecutor().run(table, steps)


def test_when_issues_are_filtered_per_branch():
    table = _table(
        [CanonicalColumn(name="tipo", type=ColumnType.TEXT), CanonicalColumn(name="qtd", type=ColumnType.TEXT)],
        [{"tipo": "A", "qtd": "abc"}, {"tipo": "B", "qtd": "5"}],
    )
    steps = [
        Step(
            operation_type="when",
            params={
                "cases": [
                    {
                        "condition": {"column": "tipo", "operator": "eq", "value": "A"},
                        "operations": [{"operation_type": "cast_to_integer", "params": {"column": "qtd"}}],
                    }
                ],
                "default": [{"operation_type": "cast_to_integer", "params": {"column": "qtd"}}],
            },
        )
    ]
    outcome = PolarsExecutor().run(table, steps)
    # Row 0 ("abc") goes through the case branch and fails to cast -> null + one issue for row 0.
    # Row 1 ("5") goes through default and casts fine -> no issue for row 1.
    assert outcome.table.rows[0]["qtd"] is None
    assert outcome.table.rows[1]["qtd"] == 5
    assert len(outcome.issues) == 1
    assert outcome.issues[0].row_index == 0


def test_filter_rows_gt_on_text_column_compares_numerically_not_lexicographically():
    # Regression: a raw Polars `>` on a Utf8 column does string comparison,
    # where "10,00" < "3,00" (since '1' < '3') — wrong for a numeric operator.
    table = _table(
        [CanonicalColumn(name="taxa", type=ColumnType.TEXT)],
        [{"taxa": "10,00"}, {"taxa": "3,00"}, {"taxa": "2,50"}],
    )
    steps = [Step(operation_type="filter_rows", params={"condition": {"column": "taxa", "operator": "gt", "value": "3,00"}})]
    outcome = PolarsExecutor().run(table, steps)
    assert [r["taxa"] for r in outcome.table.rows] == ["10,00"]


def test_when_case_condition_on_brazilian_decimal_text_column():
    table = _table(
        [CanonicalColumn(name="bonus_bruto", type=ColumnType.TEXT)],
        [{"bonus_bruto": "10,00"}, {"bonus_bruto": "3,00"}, {"bonus_bruto": "2,50"}],
    )
    steps = [
        Step(
            operation_type="when",
            params={
                "cases": [
                    {
                        "condition": {"column": "bonus_bruto", "operator": "gt", "value": "3,00"},
                        "operations": [{"operation_type": "fill_constant", "params": {"column": "bonus_bruto", "value": "acima"}}],
                    }
                ],
                "default": [{"operation_type": "fill_constant", "params": {"column": "bonus_bruto", "value": "abaixo"}}],
            },
        )
    ]
    outcome = PolarsExecutor().run(table, steps)
    assert [r["bonus_bruto"] for r in outcome.table.rows] == ["acima", "abaixo", "abaixo"]


def test_filter_rows_with_composite_condition_via_engine():
    table = _table(
        [CanonicalColumn(name="tipo", type=ColumnType.TEXT), CanonicalColumn(name="regiao", type=ColumnType.TEXT)],
        [{"tipo": "A", "regiao": "sul"}, {"tipo": "A", "regiao": "norte"}, {"tipo": "B", "regiao": "sul"}],
    )
    steps = [
        Step(
            operation_type="filter_rows",
            params={
                "condition": {
                    "logic": "and",
                    "conditions": [
                        {"column": "tipo", "operator": "eq", "value": "A"},
                        {"column": "regiao", "operator": "eq", "value": "sul"},
                    ],
                }
            },
        )
    ]
    outcome = PolarsExecutor().run(table, steps)
    assert len(outcome.table.rows) == 1
    assert outcome.table.rows[0] == {"tipo": "A", "regiao": "sul"}
