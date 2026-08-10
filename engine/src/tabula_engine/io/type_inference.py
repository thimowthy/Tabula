from __future__ import annotations

from datetime import date, datetime
from typing import Any

from tabula_engine.common.types import ColumnType


def infer_column_type(values: list[Any]) -> ColumnType:
    """Best-effort type inference from a sample of raw cell values. Mirrors the
    frontend's inferColumnType (model/factory.ts) so a workflow authored
    against an imported sheet sees the same inferred types the UI showed."""

    non_empty = [v for v in values if v is not None and v != ""]
    if not non_empty:
        return ColumnType.TEXT

    if all(isinstance(v, bool) for v in non_empty):
        return ColumnType.BOOLEAN

    if all(isinstance(v, (date, datetime)) for v in non_empty):
        return ColumnType.DATE

    def is_numeric(v: Any) -> bool:
        if isinstance(v, bool):
            return False
        if isinstance(v, (int, float)):
            return True
        if isinstance(v, str):
            try:
                float(v.strip())
                return True
            except ValueError:
                return False
        return False

    if all(is_numeric(v) for v in non_empty):
        return ColumnType.NUMBER

    return ColumnType.TEXT
