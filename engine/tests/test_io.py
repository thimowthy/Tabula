from pathlib import Path

import openpyxl

from tabula_engine.common.types import ColumnType
from tabula_engine.io.csv_reader import CsvReader
from tabula_engine.io.xlsx_reader import XlsxReader


def test_xlsx_reader_infers_types_and_preserves_source(tmp_path: Path):
    wb = openpyxl.Workbook()
    sheet = wb.active
    sheet.title = "Clientes"
    sheet.append(["Nome", "Idade", "Ativo"])
    sheet.append(["Ana", 30, True])
    sheet.append(["Bruno", 41, False])
    path = tmp_path / "clientes.xlsx"
    wb.save(path)

    tables = XlsxReader().read(path)
    assert len(tables) == 1
    table = tables[0]

    assert table.column_names() == ["Nome", "Idade", "Ativo"]
    assert table.columns[0].type == ColumnType.TEXT
    assert table.columns[1].type == ColumnType.NUMBER
    assert table.columns[2].type == ColumnType.BOOLEAN

    assert table.source.file_name == "clientes.xlsx"
    assert table.source.sheet_name == "Clientes"
    assert table.rows == [
        {"Nome": "Ana", "Idade": 30, "Ativo": True},
        {"Nome": "Bruno", "Idade": 41, "Ativo": False},
    ]


def test_csv_reader_handles_missing_header_names_and_blanks(tmp_path: Path):
    path = tmp_path / "dados.csv"
    path.write_text("Nome,\nAna,10\nBruno,\n", encoding="utf-8")

    tables = CsvReader().read(path)
    assert len(tables) == 1
    table = tables[0]

    assert table.columns[1].name == "Coluna 2"
    assert table.rows[1]["Coluna 2"] is None
