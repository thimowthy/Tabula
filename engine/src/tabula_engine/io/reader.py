from __future__ import annotations

from pathlib import Path
from typing import Protocol

from tabula_engine.canonical.model import CanonicalTable


class SpreadsheetReader(Protocol):
    """I/O boundary: turns a source file into one or more clean CanonicalTables.

    Deliberately the *only* thing that knows about file formats, cell grids,
    merged cells, etc. Everything past this point (engine, execution) only
    ever sees CanonicalTable. See ``tabula_engine.io.detection`` for the
    sub-boundary that isolates "where is the table in this messy sheet"
    heuristics from the mechanical cell-reading in this class.
    """

    def read(self, path: str | Path) -> list[CanonicalTable]: ...
