"""A small starter set of operation types. Each is intentionally engine-agnostic:
no Polars/SQL/etc. ever appears here, only the intent and its typed parameters.
See ``tabula_engine.engine.polars_engine`` for how each of these is compiled."""

from __future__ import annotations

from typing import Any, Literal

from tabula_engine.common.types import ColumnType
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


FilterOperator = Literal["eq", "neq", "gt", "gte", "lt", "lte", "contains", "is_null", "not_null"]


@register_operation("filter_rows")
class FilterRowsOp(OperationSpec):
    column: str
    operator: FilterOperator
    value: Any | None = None


@register_operation("trim_whitespace")
class TrimWhitespaceOp(OperationSpec):
    columns: list[str]
    """Leading/trailing whitespace strip. Empty list means "all text columns"."""


@register_operation("fill_null")
class FillNullOp(OperationSpec):
    column: str
    value: Any


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
    column: str
    value: Any
    """Overwrites every row, unlike fill_null which only touches empty cells."""


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
