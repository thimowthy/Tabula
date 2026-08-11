"""A declarative, reusable condition: the same shape backs ``filter_rows``
and the row-wise branching of ``when`` (see ``operations.builtin.WhenOp``).
There is exactly one evaluator for "does this row match this condition" —
a pure-Python reference (``evaluate_condition``, used by tests and as the
canonical semantics) and a Polars compiler (``_condition_to_expr`` in
``engine.polars_engine``) — so operator semantics can't drift between the
two call sites.
"""

from __future__ import annotations

import re
from typing import Any, Literal, Union

from pydantic import BaseModel, ConfigDict

ConditionOperator = Literal[
    "eq", "neq", "gt", "gte", "lt", "lte", "contains", "matches", "is_null", "not_null"
]


class Condition(BaseModel):
    """One leaf comparison: ``column`` <op> ``value``."""

    column: str
    operator: ConditionOperator
    value: Any | None = None
    """Ignored for is_null/not_null."""

    model_config = ConfigDict(frozen=True)


class ConditionGroup(BaseModel):
    """AND/OR combination of nested conditions (leaves or further groups)."""

    logic: Literal["and", "or"]
    conditions: list[ConditionExpr]

    model_config = ConfigDict(frozen=True)


ConditionExpr = Union[Condition, ConditionGroup]
ConditionGroup.model_rebuild()


def _num_or_str(value: Any) -> Any:
    """Coerces to a number when possible, trying a plain parse first and then
    Brazilian formatting (``.`` thousands separator, ``,`` decimal separator —
    e.g. ``"1.234,56"``); returns the value unchanged otherwise. Without the
    Brazilian fallback, comparisons like ``gt``/``lt`` on a text column full
    of values like ``"10,00"``/``"3,00"`` silently fall back to lexicographic
    string ordering ("10,00" < "3,00", since '1' < '3'), which is virtually
    never what a numeric comparison operator is meant to do."""

    if isinstance(value, bool) or isinstance(value, (int, float)) or value is None:
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped == "":
            return value
        try:
            return float(stripped)
        except ValueError:
            pass
        try:
            return float(stripped.replace(".", "").replace(",", "."))
        except ValueError:
            return value
    return value


def _evaluate_leaf(value: Any, operator: ConditionOperator, target: Any) -> bool:
    if operator == "is_null":
        return value is None or value == ""
    if operator == "not_null":
        return not (value is None or value == "")
    if operator == "contains":
        return value is not None and str(target) in str(value)
    if operator == "matches":
        return value is not None and re.search(str(target), str(value)) is not None

    a, b = _num_or_str(value), _num_or_str(target)
    if operator == "eq":
        return a == b
    if operator == "neq":
        return a != b
    if a is None or b is None:
        return False
    if operator == "gt":
        return a > b
    if operator == "gte":
        return a >= b
    if operator == "lt":
        return a < b
    if operator == "lte":
        return a <= b
    raise ValueError(f"Unknown condition operator: {operator!r}")


def evaluate_condition(row: dict[str, Any], condition: ConditionExpr) -> bool:
    """Pure-Python reference evaluator — engine-agnostic, no Polars. Used by
    tests and as the canonical description of what a condition means; the
    Polars-vectorized path in polars_engine.py must agree with this."""

    if isinstance(condition, ConditionGroup):
        results = (evaluate_condition(row, c) for c in condition.conditions)
        return all(results) if condition.logic == "and" else any(results)
    return _evaluate_leaf(row.get(condition.column), condition.operator, condition.value)
