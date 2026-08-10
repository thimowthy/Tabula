"""Reference ``Executor`` implementation, backed by Polars.

Deliberately operates on an eager ``pl.DataFrame`` threaded through each
step rather than building one deferred ``LazyFrame`` plan: per-step
diagnostics (which exact cells failed a cast) are what the execution layer's
validation report needs, and that's much simpler to produce eagerly. Once
large files make that worth optimizing, this can move to LazyFrame with
issue-detection done differently (e.g. a single diff against the input at
the end) — swapping that in stays entirely inside this module.
"""

from __future__ import annotations

import re
from typing import Callable

import polars as pl

from tabula_engine.canonical.model import CanonicalColumn, CanonicalTable
from tabula_engine.common.types import ColumnType
from tabula_engine.definition.models import Step
from tabula_engine.definition.operations.base import OperationSpec
from tabula_engine.definition.operations.builtin import (
    AddColumnOp,
    CastColumnTypeOp,
    CastToDatetimeOp,
    CastToFloatOp,
    CastToIntegerOp,
    ConcatColumnsOp,
    DeduplicateOp,
    DropColumnsOp,
    ExtractOp,
    FillConstantOp,
    FillNullOp,
    FilterRowsOp,
    MapValuesOp,
    MathOperationOp,
    PadStringOp,
    RenameColumnOp,
    ReorderColumnOp,
    ReplaceOp,
    RoundOp,
    SplitColumnOp,
    TrimWhitespaceOp,
)
from tabula_engine.errors import NoCompilerForOperation

from .executor import ExecutionIssue, ExecutionOutcome
from .polars_types import POLARS_DTYPE

Compiler = Callable[[pl.DataFrame, OperationSpec, "str | None"], "tuple[pl.DataFrame, list[ExecutionIssue]]"]

_COMPILERS: dict[str, Compiler] = {}


def register_compiler(operation_type: str):
    """Registers a Polars compiler for ``operation_type``. Mirrors
    ``register_operation`` on the definition side: adding Polars support for
    an operation type is one function here, nothing else."""

    def decorator(fn: Compiler) -> Compiler:
        _COMPILERS[operation_type] = fn
        return fn

    return decorator


def _newly_null_issues(
    newly_null: pl.Series, column: str, type_label: str, step_id: str | None
) -> list[ExecutionIssue]:
    issues: list[ExecutionIssue] = []
    if newly_null.any():
        for row_index in newly_null.arg_true().to_list():
            issues.append(
                ExecutionIssue(
                    severity="warning",
                    message=f"Valor em {column!r} não pôde ser convertido para {type_label}; gravado como nulo.",
                    step_id=step_id,
                    row_index=row_index,
                    column_name=column,
                )
            )
    return issues


def _cast_column(
    df: pl.DataFrame, column: str, target_type: ColumnType, step_id: str | None
) -> tuple[pl.DataFrame, list[ExecutionIssue]]:
    dtype = POLARS_DTYPE[target_type]
    was_present = df[column].is_not_null()
    casted = df[column].cast(dtype, strict=False)
    newly_null = was_present & casted.is_null()
    return df.with_columns(casted), _newly_null_issues(newly_null, column, target_type.value, step_id)


@register_compiler("rename_column")
def _compile_rename_column(df: pl.DataFrame, spec: RenameColumnOp, step_id: str | None):
    return df.rename({spec.column: spec.new_name}), []


@register_compiler("cast_column_type")
def _compile_cast_column_type(df: pl.DataFrame, spec: CastColumnTypeOp, step_id: str | None):
    return _cast_column(df, spec.column, spec.target_type, step_id)


@register_compiler("drop_columns")
def _compile_drop_columns(df: pl.DataFrame, spec: DropColumnsOp, step_id: str | None):
    return df.drop(spec.columns), []


_FILTER_EXPRS: dict[str, Callable[[pl.Expr, object], pl.Expr]] = {
    "eq": lambda c, v: c == v,
    "neq": lambda c, v: c != v,
    "gt": lambda c, v: c > v,
    "gte": lambda c, v: c >= v,
    "lt": lambda c, v: c < v,
    "lte": lambda c, v: c <= v,
    "contains": lambda c, v: c.str.contains(str(v), literal=True),
    "is_null": lambda c, v: c.is_null(),
    "not_null": lambda c, v: c.is_not_null(),
}


@register_compiler("filter_rows")
def _compile_filter_rows(df: pl.DataFrame, spec: FilterRowsOp, step_id: str | None):
    expr_fn = _FILTER_EXPRS[spec.operator]
    return df.filter(expr_fn(pl.col(spec.column), spec.value)), []


@register_compiler("trim_whitespace")
def _compile_trim_whitespace(df: pl.DataFrame, spec: TrimWhitespaceOp, step_id: str | None):
    columns = spec.columns or [name for name, dtype in zip(df.columns, df.dtypes) if dtype == pl.Utf8]
    return df.with_columns([pl.col(c).str.strip_chars() for c in columns]), []


@register_compiler("fill_null")
def _compile_fill_null(df: pl.DataFrame, spec: FillNullOp, step_id: str | None):
    return df.with_columns(pl.col(spec.column).fill_null(spec.value)), []


@register_compiler("cast_to_integer")
def _compile_cast_to_integer(df: pl.DataFrame, spec: CastToIntegerOp, step_id: str | None):
    was_present = df[spec.column].is_not_null()
    # Route through Float64 first: a bare Utf8 -> Int64 cast rejects decimal-looking
    # strings like "10.7" outright, but "cast to integer" should truncate them, not
    # fail them.
    casted = df[spec.column].cast(pl.Float64, strict=False).cast(pl.Int64, strict=False)
    newly_null = was_present & casted.is_null()
    return df.with_columns(casted), _newly_null_issues(newly_null, spec.column, "número inteiro", step_id)


@register_compiler("cast_to_float")
def _compile_cast_to_float(df: pl.DataFrame, spec: CastToFloatOp, step_id: str | None):
    was_present = df[spec.column].is_not_null()
    casted = df[spec.column].cast(pl.Float64, strict=False)
    newly_null = was_present & casted.is_null()
    return df.with_columns(casted), _newly_null_issues(newly_null, spec.column, "número decimal", step_id)


@register_compiler("cast_to_datetime")
def _compile_cast_to_datetime(df: pl.DataFrame, spec: CastToDatetimeOp, step_id: str | None):
    was_present = df[spec.column].is_not_null()
    if df[spec.column].dtype == pl.Utf8:
        casted = df[spec.column].str.to_datetime(spec.format, strict=False)
    else:
        casted = df[spec.column].cast(pl.Datetime, strict=False)
    newly_null = was_present & casted.is_null()
    return df.with_columns(casted), _newly_null_issues(newly_null, spec.column, "data e hora", step_id)


@register_compiler("split_column")
def _compile_split_column(df: pl.DataFrame, spec: SplitColumnOp, step_id: str | None):
    parts = df[spec.column].cast(pl.Utf8, strict=False).str.split(spec.delimiter)
    new_series = [parts.list.get(i, null_on_oob=True).alias(name) for i, name in enumerate(spec.into)]
    df = df.with_columns(new_series)

    issues: list[ExecutionIssue] = []
    overflow = parts.list.len() > len(spec.into)
    if overflow.any():
        for row_index in overflow.arg_true().to_list():
            issues.append(
                ExecutionIssue(
                    severity="warning",
                    message=(
                        f"Divisão de {spec.column!r} gerou mais partes do que colunas de destino "
                        f"({len(spec.into)}); o excedente foi descartado."
                    ),
                    step_id=step_id,
                    row_index=row_index,
                    column_name=spec.column,
                )
            )
    if not spec.keep_original:
        df = df.drop(spec.column)
    return df, issues


@register_compiler("fill_constant")
def _compile_fill_constant(df: pl.DataFrame, spec: FillConstantOp, step_id: str | None):
    return df.with_columns(pl.lit(spec.value).alias(spec.column)), []


_MATH_OPS: dict[str, Callable[[pl.Expr, pl.Expr], pl.Expr]] = {
    "add": lambda a, b: a + b,
    "subtract": lambda a, b: a - b,
    "multiply": lambda a, b: a * b,
    "divide": lambda a, b: a / b,
}


@register_compiler("math_operation")
def _compile_math_operation(df: pl.DataFrame, spec: MathOperationOp, step_id: str | None):
    left = pl.col(spec.column).cast(pl.Float64, strict=False)
    right = (
        pl.col(spec.operand).cast(pl.Float64, strict=False)
        if spec.operand_type == "column"
        else pl.lit(float(spec.operand))
    )
    target = spec.output_column or spec.column
    df = df.with_columns(_MATH_OPS[spec.operator](left, right).alias(target))

    was_source_present = df[spec.column].is_not_null()
    newly_null = was_source_present & df[target].is_null()
    return df, _newly_null_issues(newly_null, target, "resultado numérico", step_id)


@register_compiler("pad_string")
def _compile_pad_string(df: pl.DataFrame, spec: PadStringOp, step_id: str | None):
    src = df[spec.column]
    if src.dtype.is_numeric():
        # A code like CEP/CPF stored as a number has already lost its leading
        # zeros; round-trip through Int64 so padding starts from "123", not "123.0".
        src = src.cast(pl.Int64, strict=False)
    col = src.cast(pl.Utf8, strict=False)
    padded = col.str.pad_start(spec.length, spec.pad_char) if spec.side == "left" else col.str.pad_end(spec.length, spec.pad_char)
    return df.with_columns(padded), []


@register_compiler("reorder_column")
def _compile_reorder_column(df: pl.DataFrame, spec: ReorderColumnOp, step_id: str | None):
    if spec.column not in df.columns:
        return df, []
    remaining = [c for c in df.columns if c != spec.column]
    insert_at = remaining.index(spec.before) if spec.before is not None and spec.before in remaining else len(remaining)
    new_order = remaining[:insert_at] + [spec.column] + remaining[insert_at:]
    return df.select(new_order), []


_TEMPLATE_TOKEN = re.compile(r"\{([^{}]+)\}")


@register_compiler("concat_columns")
def _compile_concat_columns(df: pl.DataFrame, spec: ConcatColumnsOp, step_id: str | None):
    parts: list[pl.Expr] = []
    pos = 0
    for m in _TEMPLATE_TOKEN.finditer(spec.template):
        literal = spec.template[pos : m.start()]
        if literal:
            parts.append(pl.lit(literal))
        col_name = m.group(1)
        if col_name in df.columns:
            parts.append(pl.col(col_name).cast(pl.Utf8, strict=False).fill_null(""))
        else:
            parts.append(pl.lit(""))
        pos = m.end()
    trailing = spec.template[pos:]
    if trailing:
        parts.append(pl.lit(trailing))
    expr = pl.concat_str(parts, separator="") if parts else pl.lit("")
    return df.with_columns(expr.alias(spec.output_column)), []


@register_compiler("replace")
def _compile_replace(df: pl.DataFrame, spec: ReplaceOp, step_id: str | None):
    col = df[spec.column].cast(pl.Utf8, strict=False)
    if spec.regex:
        pattern = spec.find if spec.match_case else f"(?i){spec.find}"
    else:
        escaped = re.escape(spec.find)
        pattern = escaped if spec.match_case else f"(?i){escaped}"
    replaced = col.str.replace_all(pattern, spec.replace, literal=False)
    return df.with_columns(replaced.alias(spec.column)), []


@register_compiler("extract")
def _compile_extract(df: pl.DataFrame, spec: ExtractOp, step_id: str | None):
    target = spec.output_column or spec.column
    extracted = df[spec.column].cast(pl.Utf8, strict=False).str.extract(spec.pattern, spec.group)
    return df.with_columns(extracted.alias(target)), []


@register_compiler("map_values")
def _compile_map_values(df: pl.DataFrame, spec: MapValuesOp, step_id: str | None):
    col = df[spec.column].cast(pl.Utf8, strict=False)
    mapped = col.replace(spec.mapping)
    return df.with_columns(mapped.alias(spec.column)), []


@register_compiler("round")
def _compile_round(df: pl.DataFrame, spec: RoundOp, step_id: str | None):
    was_present = df[spec.column].is_not_null()
    casted = df[spec.column].cast(pl.Float64, strict=False)
    newly_null = was_present & casted.is_null()
    rounded = casted.round(spec.decimals)
    return df.with_columns(rounded.alias(spec.column)), _newly_null_issues(newly_null, spec.column, "número", step_id)


@register_compiler("deduplicate")
def _compile_deduplicate(df: pl.DataFrame, spec: DeduplicateOp, step_id: str | None):
    subset = spec.columns or None
    return df.unique(subset=subset, keep="first", maintain_order=True), []


@register_compiler("add_column")
def _compile_add_column(df: pl.DataFrame, spec: AddColumnOp, step_id: str | None):
    dtype = POLARS_DTYPE[spec.column_type]
    literal = pl.lit(spec.default_value).cast(dtype, strict=False)
    return df.with_columns(literal.alias(spec.name)), []


class PolarsExecutor:
    """Swapping engines later means writing a new class implementing the same
    ``Executor`` protocol with its own compiler registry — ``Step`` and
    ``OperationSpec`` never change."""

    name = "polars"

    def run(self, table: CanonicalTable, steps: list[Step]) -> ExecutionOutcome:
        if table.rows:
            df = pl.DataFrame(table.rows)
        else:
            df = pl.DataFrame({c.name: [] for c in table.columns})

        issues: list[ExecutionIssue] = []

        # Align with the canonical types declared by the reader before running
        # any step, via the same coercion-with-issue-tracking path a cast
        # operation uses.
        for col in table.columns:
            if col.name in df.columns:
                df, cast_issues = _cast_column(df, col.name, col.type, step_id=None)
                issues.extend(cast_issues)

        current_types = {c.name: c.type for c in table.columns}

        for step in steps:
            spec = step.operation()
            compiler = _COMPILERS.get(step.operation_type)
            if compiler is None:
                raise NoCompilerForOperation(step.operation_type, self.name)
            df, step_issues = compiler(df, spec, step.id)
            issues.extend(step_issues)

            if isinstance(spec, RenameColumnOp) and spec.column in current_types:
                current_types[spec.new_name] = current_types.pop(spec.column)
            elif isinstance(spec, CastColumnTypeOp):
                current_types[spec.column] = spec.target_type
            elif isinstance(spec, DropColumnsOp):
                for c in spec.columns:
                    current_types.pop(c, None)
            elif isinstance(spec, (CastToIntegerOp, CastToFloatOp)):
                current_types[spec.column] = ColumnType.NUMBER
            elif isinstance(spec, CastToDatetimeOp):
                current_types[spec.column] = ColumnType.DATE
            elif isinstance(spec, SplitColumnOp):
                if not spec.keep_original:
                    current_types.pop(spec.column, None)
                for name in spec.into:
                    current_types[name] = ColumnType.TEXT
            elif isinstance(spec, MathOperationOp):
                current_types[spec.output_column or spec.column] = ColumnType.NUMBER
            elif isinstance(spec, PadStringOp):
                # A zero-padded ID etc. must stay text — a numeric type would strip the padding.
                current_types[spec.column] = ColumnType.TEXT
            elif isinstance(spec, ConcatColumnsOp):
                current_types[spec.output_column] = ColumnType.TEXT
            elif isinstance(spec, ExtractOp):
                current_types[spec.output_column or spec.column] = ColumnType.TEXT
            elif isinstance(spec, RoundOp):
                current_types[spec.column] = ColumnType.NUMBER
            elif isinstance(spec, AddColumnOp):
                current_types[spec.name] = spec.column_type

        out_columns = [CanonicalColumn(name=name, type=current_types.get(name, ColumnType.TEXT)) for name in df.columns]
        out_table = table.model_copy(update={"columns": out_columns, "rows": df.to_dicts()})
        return ExecutionOutcome(table=out_table, issues=issues)
