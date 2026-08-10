from __future__ import annotations

import csv
from pathlib import Path

from tabula_engine.canonical.model import CanonicalColumn, CanonicalTable, SourceRef
from .type_inference import infer_column_type


class CsvReader:
    """CSV has no sheets/merged cells/multiple tables, so this is a lot
    simpler than XlsxReader: one file, one table, header on row 0."""

    def read(self, path: str | Path) -> list[CanonicalTable]:
        path = Path(path)
        with path.open(newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            rows_raw = list(reader)

        if not rows_raw:
            return []

        header, *data_rows = rows_raw
        column_names = [h if h else f"Coluna {i + 1}" for i, h in enumerate(header)]

        columns: list[CanonicalColumn] = []
        for col_idx, name in enumerate(column_names):
            sample = [r[col_idx] if col_idx < len(r) else None for r in data_rows]
            columns.append(CanonicalColumn(name=name, type=infer_column_type(sample), source_column=col_idx))

        rows = [
            {col.name: (r[i] if i < len(r) and r[i] != "" else None) for i, col in enumerate(columns)} for r in data_rows
        ]

        source = SourceRef(file_name=path.name, sheet_name=path.stem, table_index=0, header_row=0)
        return [CanonicalTable(columns=columns, rows=rows, source=source, row_source_offset=1)]
