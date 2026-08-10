from enum import Enum


class ColumnType(str, Enum):
    """Canonical column types. Mirrors the frontend's ColumnDef['type'] so a target
    schema authored in the UI maps 1:1 onto canonical/engine typing with no translation
    table to keep in sync by hand."""

    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"
