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
from tabula_engine.definition.condition import Condition, ConditionExpr, ConditionGroup, _num_or_str
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
    FixDecimalPlacesOp,
    MapValuesOp,
    MathOperationOp,
    PadStringOp,
    PromoteHeaderRowOp,
    RenameColumnOp,
    ReorderColumnOp,
    ReplaceOp,
    RoundOp,
    SplitColumnOp,
    TrimWhitespaceOp,
    WhenOp,
)
from tabula_engine.errors import NoCompilerForOperation, SpecValidationError

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
    "matches": lambda c, v: c.str.contains(str(v), literal=False),
    "is_null": lambda c, v: c.is_null(),
    "not_null": lambda c, v: c.is_not_null(),
}


_NUMERIC_COMPARISON_OPS = {"eq", "neq", "gt", "gte", "lt", "lte"}


def _condition_to_expr(condition: ConditionExpr, df: pl.DataFrame) -> pl.Expr:
    """The single place a ``Condition``/``ConditionGroup`` becomes a Polars
    expression — used by both ``filter_rows`` and ``when``, so operator
    semantics can't drift between the two.

    For eq/neq/gt/gte/lt/lte, if the comparison value parses as a number
    (``_num_or_str``, same coercion the pure-Python reference evaluator
    uses), the column is coerced to numeric too before comparing — a raw
    Polars `>` on a Utf8 column does lexicographic string comparison, which
    silently gives wrong answers for numeric-looking text (Brazilian-format
    decimals especially: "10,00" < "3,00" as strings).
    """

    if isinstance(condition, ConditionGroup):
        exprs = [_condition_to_expr(c, df) for c in condition.conditions]
        combined = exprs[0]
        for e in exprs[1:]:
            combined = (combined & e) if condition.logic == "and" else (combined | e)
        return combined
    assert isinstance(condition, Condition)
    col = pl.col(condition.column)

    if condition.operator in _NUMERIC_COMPARISON_OPS and condition.column in df.columns:
        numeric_target = _num_or_str(condition.value)
        if isinstance(numeric_target, (int, float)) and not isinstance(numeric_target, bool):
            if df.schema[condition.column].is_numeric():
                numeric_col = col.cast(pl.Float64, strict=False)
            else:
                # Mirrors _num_or_str's two-try coercion: attempt a plain
                # Float64 parse first (correct for "1234.56", "1000", ...);
                # only where that fails, retry with Brazilian formatting
                # (thousands "." stripped, decimal "," turned into ".").
                # Applying the Brazilian rewrite unconditionally — as this
                # used to — corrupts already-standard-format numbers, e.g.
                # "1234.56" -> "123456" (1234.56 becomes 123456.0).
                text_col = col.cast(pl.Utf8, strict=False).str.strip_chars()
                direct = text_col.cast(pl.Float64, strict=False)
                brazilian = (
                    text_col.str.replace_all(".", "", literal=True)
                    .str.replace(",", ".", literal=True)
                    .cast(pl.Float64, strict=False)
                )
                numeric_col = pl.when(direct.is_not_null()).then(direct).otherwise(brazilian)
            return _FILTER_EXPRS[condition.operator](numeric_col, float(numeric_target))

    return _FILTER_EXPRS[condition.operator](col, condition.value)


@register_compiler("filter_rows")
def _compile_filter_rows(df: pl.DataFrame, spec: FilterRowsOp, step_id: str | None):
    return df.filter(_condition_to_expr(spec.condition, df).fill_null(False)), []


@register_compiler("trim_whitespace")
def _compile_trim_whitespace(df: pl.DataFrame, spec: TrimWhitespaceOp, step_id: str | None):
    columns = spec.columns or [name for name, dtype in zip(df.columns, df.dtypes) if dtype == pl.Utf8]
    return df.with_columns([pl.col(c).str.strip_chars() for c in columns]), []


@register_compiler("fill_null")
def _compile_fill_null(df: pl.DataFrame, spec: FillNullOp, step_id: str | None):
    if spec.fill_type == "column" and spec.source_column is not None:
        return df.with_columns(pl.col(spec.column).fill_null(pl.col(spec.source_column))), []
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


@register_compiler("fix_decimal_places")
def _compile_fix_decimal_places(df: pl.DataFrame, spec: FixDecimalPlacesOp, step_id: str | None):
    was_present = df[spec.column].is_not_null()
    numeric = df[spec.column].cast(pl.Float64, strict=False)
    newly_null = was_present & numeric.is_null()
    formatted = numeric.map_elements(
        lambda v: None if v is None else f"{v:.{spec.decimals}f}".replace(".", ","),
        return_dtype=pl.Utf8,
    )
    return df.with_columns(formatted.alias(spec.column)), _newly_null_issues(newly_null, spec.column, "número", step_id)


@register_compiler("deduplicate")
def _compile_deduplicate(df: pl.DataFrame, spec: DeduplicateOp, step_id: str | None):
    subset = spec.columns or None
    return df.unique(subset=subset, keep="first", maintain_order=True), []


@register_compiler("add_column")
def _compile_add_column(df: pl.DataFrame, spec: AddColumnOp, step_id: str | None):
    dtype = POLARS_DTYPE[spec.column_type]
    literal = pl.lit(spec.default_value).cast(dtype, strict=False)
    return df.with_columns(literal.alias(spec.name)), []


@register_compiler("promote_header_row")
def _compile_promote_header_row(df: pl.DataFrame, spec: PromoteHeaderRowOp, step_id: str | None):
    if spec.row_index < 0 or spec.row_index >= df.height:
        issue = ExecutionIssue(
            severity="warning",
            message=f"Linha {spec.row_index} não existe; nenhum ajuste de cabeçalho foi aplicado.",
            step_id=step_id,
        )
        return df, [issue]
    header = df.row(spec.row_index, named=True)
    rename_map = {
        col: str(header[col]).strip() for col in df.columns if header[col] is not None and str(header[col]).strip() != ""
    }
    return df.rename(rename_map).slice(spec.row_index + 1), []


def _update_types(
    spec: OperationSpec, pre_columns: list[str], post_columns: list[str], current_types: dict[str, ColumnType]
) -> None:
    """Keeps ``current_types`` (name -> declared type) in sync as steps run,
    for the handful of operation kinds that change a column's type or name.
    Extracted out of the run loop so ``_run_steps`` can call it for both the
    top-level pipeline and a ``when`` branch."""

    if isinstance(spec, PromoteHeaderRowOp):
        # Renames are positional here (df.rename keeps column order), so
        # zipping old/new column lists is safe even though current_types'
        # own key order doesn't always track df's physical column order.
        for old, new in zip(pre_columns, post_columns):
            if old != new and old in current_types:
                current_types[new] = current_types.pop(old)
    elif isinstance(spec, RenameColumnOp) and spec.column in current_types:
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
    elif isinstance(spec, FixDecimalPlacesOp):
        # Zero-padded fraction digits are formatting, not a numeric value — text preserves them.
        current_types[spec.column] = ColumnType.TEXT
    elif isinstance(spec, AddColumnOp):
        current_types[spec.name] = spec.column_type


def _run_steps(
    df: pl.DataFrame, steps: list[Step], current_types: dict[str, ColumnType]
) -> tuple[pl.DataFrame, list[ExecutionIssue]]:
    """Runs ``steps`` against ``df`` in order, dispatching each to its
    registered compiler — the top-level pipeline and each branch of a
    ``when`` both go through this same loop, so a branch's operations are
    compiled identically to a top-level step; they never know they're
    conditional. Mutates ``current_types`` in place."""

    issues: list[ExecutionIssue] = []
    for step in steps:
        spec = step.operation()
        compiler = _COMPILERS.get(step.operation_type)
        if compiler is None:
            raise NoCompilerForOperation(step.operation_type, "polars")
        pre_columns = df.columns
        df, step_issues = compiler(df, spec, step.id)
        issues.extend(step_issues)
        _update_types(spec, pre_columns, df.columns, current_types)
    return df, issues


def _validate_branch_shape(
    branch_df: pl.DataFrame, base_row_count: int, base_columns: set[str], step_id: str | None
) -> None:
    """A ``when`` merges its branches row-by-row and column-by-column, which
    only makes sense if every branch (each ``case`` plus ``default``) ends up
    with the same row count and the same column names it started with — this
    is what lets ANY catalog operation appear inside a branch (no whitelist)
    while still rejecting the genuinely ambiguous combinations (a branch that
    filters/deduplicates rows, or adds/drops/renames columns differently from
    another branch) with a clear error instead of silently producing a
    malformed table."""

    if branch_df.height != base_row_count:
        raise SpecValidationError(
            f"Ramo de 'when' (step {step_id!r}) alterou a quantidade de linhas "
            f"({base_row_count} -> {branch_df.height}); operações como filter_rows/deduplicate "
            "não são permitidas dentro de um ramo de 'when'."
        )
    if set(branch_df.columns) != base_columns:
        raise SpecValidationError(
            f"Ramo de 'when' (step {step_id!r}) alterou o conjunto de colunas "
            f"({sorted(base_columns)} -> {sorted(branch_df.columns)}); todos os ramos de um 'when' "
            "precisam terminar com o mesmo conjunto de colunas."
        )


def _issues_for_mask(issues: list[ExecutionIssue], mask: pl.Series) -> list[ExecutionIssue]:
    """Keeps only the issues that belong to rows this branch actually won —
    a cast failure recorded while computing a branch that a row *didn't* end
    up using isn't relevant to the final table."""

    matching_rows = set(mask.arg_true().to_list())
    return [i for i in issues if i.row_index is None or i.row_index in matching_rows]


@register_compiler("when")
def _compile_when(df: pl.DataFrame, spec: WhenOp, step_id: str | None):
    base_row_count = df.height
    base_columns = set(df.columns)
    column_order = df.columns

    masks: list[pl.Series] = []
    branch_dfs: list[pl.DataFrame] = []
    issues: list[ExecutionIssue] = []
    matched_by_any_case = pl.Series([False] * base_row_count, dtype=pl.Boolean)

    for case in spec.cases:
        mask = df.select(_condition_to_expr(case.condition, df).fill_null(False).alias("_mask")).to_series()
        masks.append(mask)
        matched_by_any_case = matched_by_any_case | mask

        branch_df, branch_issues = _run_steps(df, case.operations, {})
        _validate_branch_shape(branch_df, base_row_count, base_columns, step_id)
        branch_dfs.append(branch_df.select(column_order))
        issues.extend(_issues_for_mask(branch_issues, mask))

    if spec.default is not None:
        default_df, default_issues = _run_steps(df, spec.default, {})
        _validate_branch_shape(default_df, base_row_count, base_columns, step_id)
        default_df = default_df.select(column_order)
        issues.extend(_issues_for_mask(default_issues, ~matched_by_any_case))
    else:
        default_df = df

    # First matching case wins: fold from the lowest-priority branch (default)
    # up to the first case, so the first case's zip_with is applied *last* and
    # overwrites whatever a later-folded (i.e. earlier, lower-priority) branch
    # put there wherever its own mask is true.
    result_df = default_df
    for mask, branch_df in reversed(list(zip(masks, branch_dfs))):
        result_df = pl.DataFrame({col: branch_df[col].zip_with(mask, result_df[col]) for col in column_order})

    return result_df, issues


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

        df, step_issues = _run_steps(df, steps, current_types)
        issues.extend(step_issues)

        out_columns = [CanonicalColumn(name=name, type=current_types.get(name, ColumnType.TEXT)) for name in df.columns]
        out_table = table.model_copy(update={"columns": out_columns, "rows": df.to_dicts()})
        return ExecutionOutcome(table=out_table, issues=issues)
