"""A small starter set of operation types. Each is intentionally engine-agnostic:
no Polars/SQL/etc. ever appears here, only the intent and its typed parameters.
See ``tabula_engine.engine.polars_engine`` for how each of these is compiled."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, model_validator

from tabula_engine.common.types import ColumnType
from ..condition import ConditionExpr
from ..step import Step
from .base import OperationSpec, register_operation


@register_operation("rename_column")
class RenameColumnOp(OperationSpec):
    column: str
    new_name: str


@register_operation("cast_column_type")
class CastColumnTypeOp(OperationSpec):
    column: str
    target_type: ColumnType
    """When a value can't be coerced, the engine records a ValidationIssue for
    that cell and writes null rather than raising — keeps a single bad row from
    aborting an otherwise-good run."""


@register_operation("drop_columns")
class DropColumnsOp(OperationSpec):
    columns: list[str]


@register_operation("filter_rows")
class FilterRowsOp(OperationSpec):
    condition: ConditionExpr

    @model_validator(mode="before")
    @classmethod
    def _migrate_legacy_shape(cls, data: Any) -> Any:
        """Steps recorded before filter_rows gained AND/OR used a flat
        {column, operator, value} shape — wrap it into ``condition`` on read
        so workflow .json files exported before this change keep working."""
        if isinstance(data, dict) and "condition" not in data and "column" in data:
            return {
                "condition": {
                    "column": data["column"],
                    "operator": data.get("operator"),
                    "value": data.get("value"),
                }
            }
        return data


@register_operation("trim_whitespace")
class TrimWhitespaceOp(OperationSpec):
    columns: list[str]
    """Leading/trailing whitespace strip. Empty list means "all text columns"."""


FillSource = Literal["constant", "column"]


@register_operation("fill_null")
class FillNullOp(OperationSpec):
    column: str
    fill_type: FillSource = "constant"
    value: Any = None
    """Used when fill_type == 'constant'."""
    source_column: str | None = None
    """Used when fill_type == 'column' — the same-row value of this column
    fills each null in ``column`` instead of a fixed ``value``."""


@register_operation("cast_to_integer")
class CastToIntegerOp(OperationSpec):
    column: str


@register_operation("cast_to_float")
class CastToFloatOp(OperationSpec):
    column: str


@register_operation("cast_to_datetime")
class CastToDatetimeOp(OperationSpec):
    column: str
    format: str | None = None
    """strptime-style pattern (e.g. '%d/%m/%Y %H:%M'). None means best-effort parse."""


@register_operation("split_column")
class SplitColumnOp(OperationSpec):
    column: str
    delimiter: str
    into: list[str]
    """Names for the resulting columns, in order. Extra pieces beyond len(into) are
    dropped; missing pieces are filled with null."""
    keep_original: bool = False


@register_operation("fill_constant")
class FillConstantOp(OperationSpec):
    """Overwrites every row, unlike fill_null which only touches empty cells."""

    column: str
    fill_type: FillSource = "constant"
    value: Any = None
    """Used when fill_type == 'constant'."""
    source_column: str | None = None
    """Used when fill_type == 'column' — the same-row value of this column
    overwrites every row of ``column`` instead of a fixed ``value``."""


MathOperator = Literal["add", "subtract", "multiply", "divide"]


@register_operation("math_operation")
class MathOperationOp(OperationSpec):
    column: str
    operator: MathOperator
    operand_type: Literal["constant", "column"]
    operand: float | str
    """A number when operand_type is 'constant', a column name when it's 'column'."""
    output_column: str | None = None
    """Writes to a new column with this name; None overwrites ``column`` in place."""


@register_operation("pad_string")
class PadStringOp(OperationSpec):
    column: str
    length: int
    pad_char: str = "0"
    side: Literal["left", "right"] = "left"


CaseType = Literal["upper", "lower", "title"]


@register_operation("change_case")
class ChangeCaseOp(OperationSpec):
    column: str
    case_type: CaseType
    """'title' capitalizes the first letter of every word (like Excel's PROPER)."""


@register_operation("reorder_column")
class ReorderColumnOp(OperationSpec):
    column: str
    before: str | None = None
    """Moves ``column`` to sit immediately before this column name; None moves
    it to the end. Expressing a reorder as a single "move X before Y" — rather
    than a full column-order list — is what makes it replayable: it still
    makes sense on a table that gained or lost unrelated columns since the
    step was recorded."""


@register_operation("concat_columns")
class ConcatColumnsOp(OperationSpec):
    template: str
    """f-string-like template, e.g. "{first_name} {last_name}" — every
    ``{column_name}`` token is substituted with that column's value for each
    row; a missing/null value substitutes as an empty string."""
    output_column: str


@register_operation("replace")
class ReplaceOp(OperationSpec):
    column: str
    find: str
    replace: str
    regex: bool = False
    match_case: bool = True
    """Column-scoped find/replace with optional regex — distinct from a
    sheet-wide, non-regex find/replace, which is a direct-editing convenience
    rather than a recorded, replayable step."""


@register_operation("extract")
class ExtractOp(OperationSpec):
    column: str
    pattern: str
    group: int = 1
    """Which regex capture group to keep; 0 is the whole match."""
    output_column: str | None = None
    """Writes to a new column with this name; None overwrites ``column`` in place."""


@register_operation("map_values")
class MapValuesOp(OperationSpec):
    column: str
    mapping: dict[str, Any]
    """Exact-match lookup (a "de-para" table). Values not present in the
    mapping are left unchanged rather than becoming null — a lookup table
    that doesn't yet cover every case shouldn't destroy the values it
    doesn't recognize."""


@register_operation("round")
class RoundOp(OperationSpec):
    column: str
    decimals: int = 0


@register_operation("deduplicate")
class DeduplicateOp(OperationSpec):
    columns: list[str] = []
    """Empty list means consider all columns when detecting duplicate rows.
    Keeps the first occurrence of each duplicate."""


@register_operation("add_column")
class AddColumnOp(OperationSpec):
    name: str
    column_type: ColumnType
    default_value: Any = None
    """Creates a new column, filled with this value for every row (None means all-null)."""


@register_operation("fix_decimal_places")
class FixDecimalPlacesOp(OperationSpec):
    column: str
    decimals: int
    """Formats the column as text with exactly this many digits after the
    decimal separator (zero-padded), using a comma — unlike ``round``, which
    keeps the column numeric and so can't preserve trailing zeros."""


@register_operation("promote_header_row")
class PromoteHeaderRowOp(OperationSpec):
    row_index: int
    """0-based index into the current data rows. That row's values become the
    new column names; it and every row above it are dropped — a raw import
    often has title/blank rows above the real header, so promoting a row other
    than the first is what makes this a fix rather than just "use row 0"."""


class WhenCase(BaseModel):
    """One (condition -> branch) pair inside a ``when``. Not itself a
    registered operation — just the shape of one entry in ``WhenOp.cases``."""

    condition: ConditionExpr
    operations: list[Step]

    model_config = ConfigDict(frozen=True)


@register_operation("when")
class WhenOp(OperationSpec):
    """Row-wise control flow: every operation inside a branch is an ordinary,
    unmodified catalog operation — they don't know they're conditional. The
    first ``case`` whose condition a row satisfies wins; rows matching no
    case run ``default`` (or, if ``default`` is None, pass through
    unchanged). One shape covers if/then/else (a single case + default) and
    a switch (several cases + default), so there's never a need to nest
    ``when`` just to add another branch — nesting is still possible (a
    branch's ``operations`` can itself contain a ``when`` step) since
    branches are just ``list[Step]`` like any other pipeline."""

    cases: list[WhenCase]
    default: list[Step] | None = None
