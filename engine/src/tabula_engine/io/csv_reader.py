from __future__ import annotations

import csv
from pathlib import Path

from tabula_engine.canonical.model import CanonicalColumn, CanonicalTable, SourceRef
from .detection import detect_header_row
from .type_inference import infer_column_type


class CsvReader:
    """CSV has no sheets/merged cells/multiple tables, so this is a lot
    simpler than XlsxReader: one file, one table. The header row isn't
    assumed to be row 0 though — exported reports often have a title or
    blank line above it — so it's picked with the same ``detect_header_row``
    heuristic used by ``XlsxReader``."""

    def read(self, path: str | Path) -> list[CanonicalTable]:
        path = Path(path)
        with path.open(newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            rows_raw = list(reader)

        if not rows_raw:
            return []

        header_row = detect_header_row(rows_raw)
        header = rows_raw[header_row]
        data_rows = rows_raw[header_row + 1 :]
        column_names = [h if h else f"Coluna {i + 1}" for i, h in enumerate(header)]

        columns: list[CanonicalColumn] = []
        for col_idx, name in enumerate(column_names):
            sample = [r[col_idx] if col_idx < len(r) else None for r in data_rows]
            columns.append(CanonicalColumn(name=name, type=infer_column_type(sample), source_column=col_idx))

        rows = [
            {col.name: (r[i] if i < len(r) and r[i] != "" else None) for i, col in enumerate(columns)} for r in data_rows
        ]

        source = SourceRef(file_name=path.name, sheet_name=path.stem, table_index=0, header_row=header_row)
        return [CanonicalTable(columns=columns, rows=rows, source=source, row_source_offset=header_row + 1)]
