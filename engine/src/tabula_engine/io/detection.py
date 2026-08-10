"""Where-is-the-table detection, kept separate from the mechanical cell-reading
in ``xlsx_reader``/``csv_reader``.

This is the extension point for the hard, open-ended part of principle 5
(offset headers, merged cells, multiple tables per sheet). The baseline
strategy here is intentionally naive — one table, header on the first
non-empty row, data filling the used range — so the rest of the I/O layer has
something to compile against. Swap in a smarter ``TableDetectionStrategy``
without touching ``XlsxReader``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from openpyxl.worksheet.worksheet import Worksheet


@dataclass(frozen=True)
class DetectedTable:
    """A rectangular region of a worksheet identified as one table, in
    0-based, end-exclusive coordinates."""

    header_row: int
    start_col: int
    end_col: int
    data_start_row: int
    data_end_row: int


class TableDetectionStrategy(Protocol):
    def detect(self, sheet: Worksheet) -> list[DetectedTable]: ...


class SingleTableFromTopLeft:
    """Baseline strategy: the sheet's used range is one table, header on its
    first row. Does not attempt to handle merged cells, blank leading rows,
    or multiple tables — see module docstring."""

    def detect(self, sheet: Worksheet) -> list[DetectedTable]:
        if sheet.max_row < 1 or sheet.max_column < 1:
            return []
        return [
            DetectedTable(
                header_row=0,
                start_col=0,
                end_col=sheet.max_column,
                data_start_row=1,
                data_end_row=sheet.max_row,
            )
        ]
