"""Guards that the Polars-vectorized condition compiler (_condition_to_expr)
agrees, cell by cell, with the pure-Python reference (evaluate_condition) —
the property the "preview in the browser == real execution" premise of the
project depends on. Regression coverage for the bug where a numeric target
compared against a text column unconditionally rewrote the cell as Brazilian
formatting (thousands "." stripped, "," turned into ".") before every
comparison, corrupting already-standard-format numbers, e.g. "1234.56"
became "123456" (1234.56 -> 123456.0)."""

import polars as pl
import pytest

from tabula_engine.canonical.model import CanonicalColumn, CanonicalTable, SourceRef
from tabula_engine.common.types import ColumnType
from tabula_engine.definition.condition import Condition, evaluate_condition
from tabula_engine.definition.models import Step
from tabula_engine.engine.polars_engine import PolarsExecutor, _condition_to_expr

# US format, Brazilian format, plain integer, and non-numeric text, all in
# one text column — the exact mix the reported bug diverged on.
MIXED_VALUES = ["1234.56", "1.234,56", "1000", "abc"]


def _mask(condition: Condition, values: list[str]) -> list[bool]:
    df = pl.DataFrame({"valor": values})
    return df.select(_condition_to_expr(condition, df).fill_null(False).alias("m")).to_series().to_list()


def _reference_mask(condition: Condition, values: list[str]) -> list[bool]:
    return [evaluate_condition({"valor": v}, condition) for v in values]


def test_condition_polars_matches_reference_eq_mixed_formats():
    # eq never raises on a str-vs-float comparison in the reference (unlike
    # gt/lt), so this is safe to run across the full mixed set, non-numeric
    # text included.
    condition = Condition(column="valor", operator="eq", value=1000)
    assert _mask(condition, MIXED_VALUES) == _reference_mask(condition, MIXED_VALUES)


@pytest.mark.parametrize("operator", ["neq", "gt", "gte", "lt", "lte"])
def test_condition_polars_matches_reference_ordering_numeric_formats(operator):
    # Restricted to the numeric-parseable subset. Two unrelated, pre-existing
    # quirks of the two evaluators — out of scope for this fix — are why
    # non-numeric text ("abc") is excluded here: comparing a non-numeric
    # string with a float via gt/lt raises TypeError in the pure-Python
    # reference, and neq against an unparseable cell diverges too (Polars'
    # null propagation forces `null != x` to False via fill_null(False),
    # while the reference says True since "abc" != 1000.0 in Python).
    numeric_values = ["1234.56", "1.234,56", "1000"]
    condition = Condition(column="valor", operator=operator, value=1000)
    assert _mask(condition, numeric_values) == _reference_mask(condition, numeric_values)


def test_condition_polars_does_not_corrupt_us_formatted_decimal():
    # The literal reported symptom: "1234.56" must compare as 1234.56, not
    # as 123456 (which the old unconditional Brazilian rewrite produced).
    eq_condition = Condition(column="valor", operator="eq", value=1234.56)
    assert _mask(eq_condition, ["1234.56"]) == [True]
    assert _reference_mask(eq_condition, ["1234.56"]) == [True]

    # A threshold that only a *correct* parse of "1234.56" satisfies —
    # the corrupted 123456.0 would fail this and flip the outcome.
    lt_condition = Condition(column="valor", operator="lt", value=2000)
    assert _mask(lt_condition, ["1234.56"]) == [True]
    assert _reference_mask(lt_condition, ["1234.56"]) == [True]


def test_condition_polars_still_applies_brazilian_fallback():
    # "1.234,56" fails a plain float() parse, so both evaluators must fall
    # back to Brazilian formatting and agree it equals 1234.56.
    condition = Condition(column="valor", operator="eq", value=1234.56)
    assert _mask(condition, ["1.234,56"]) == [True]
    assert _reference_mask(condition, ["1.234,56"]) == [True]


def test_filter_rows_end_to_end_matches_reference_row_survival():
    rows = [{"valor": v} for v in ["1234.56", "1.234,56", "1000", "abc"]]
    table = CanonicalTable(
        columns=[CanonicalColumn(name="valor", type=ColumnType.TEXT)],
        rows=rows,
        source=SourceRef(file_name="t.csv", sheet_name="t"),
    )
    condition = Condition(column="valor", operator="eq", value=1000)
    steps = [Step(operation_type="filter_rows", params={"condition": condition.model_dump()})]

    outcome = PolarsExecutor().run(table, steps)
    surviving = {r["valor"] for r in outcome.table.rows}

    expected = {row["valor"] for row in rows if evaluate_condition(row, condition)}
    assert surviving == expected
    assert surviving == {"1000"}
