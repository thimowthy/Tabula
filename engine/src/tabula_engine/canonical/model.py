"""Layer 2 — Canonical: the clean, typed tabular representation that flows
through execution, independent of the messy source file that produced it.

Provenance is tracked cheaply for the common case (a column/row maps 1:1 to a
source column/row) via ``SourceRef``/``source_row``, and richly *only* where
something unusual happened (a coercion, a merged-cell fill, a validation
failure) via ``CellNote``. Tracking full per-cell origin for every cell in
every table would be expensive and almost entirely redundant with the
row/column mapping — the exceptions are what error messages actually need to
point at.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from tabula_engine.common.types import ColumnType


class SourceRef(BaseModel):
    """Which file/sheet/region a CanonicalTable was extracted from."""

    file_name: str
    sheet_name: str
    table_index: int = 0
    """0-based index of this table within the sheet, for the multi-table-per-sheet case."""
    header_row: int | None = None
    """0-based row index (in the source sheet) the header was read from, if any."""

    model_config = ConfigDict(frozen=True)


class CellOrigin(BaseModel):
    """A specific cell in the *original* source file."""

    sheet: str
    row: int
    column: int

    model_config = ConfigDict(frozen=True)


CellNoteKind = Literal["type_coercion", "merged_cell_fill", "validation_error", "truncated_header"]


class CellNote(BaseModel):
    """A provenance/quality annotation for one cell, kept only when something
    noteworthy happened to it — see module docstring for why this is sparse
    rather than exhaustive."""

    row_index: int
    """Row index within the CanonicalTable (not the source file)."""
    column_name: str
    kind: CellNoteKind
    message: str
    origin: CellOrigin | None = None

    model_config = ConfigDict(frozen=True)


class CanonicalColumn(BaseModel):
    name: str
    type: ColumnType
    source_column: int | None = None
    """0-based column index in the source sheet this column was read from."""

    model_config = ConfigDict(frozen=True)


class CanonicalTable(BaseModel):
    """A single clean table. A source file can yield more than one of these
    (multiple sheets, or multiple tables detected within one sheet)."""

    columns: list[CanonicalColumn]
    rows: list[dict[str, Any]]
    """Each row is {column_name: typed_value}, keyed by CanonicalColumn.name."""
    source: SourceRef
    row_source_offset: int | None = None
    """Source row index (0-based) that CanonicalTable row 0 came from, when rows
    map 1:1 and contiguously onto source rows. None if the mapping is irregular
    enough that per-row source indices should be read from ``notes`` instead."""
    notes: list[CellNote] = []

    model_config = ConfigDict(frozen=True)

    def column_names(self) -> list[str]:
        return [c.name for c in self.columns]
