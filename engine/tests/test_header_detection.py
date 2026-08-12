from pathlib import Path

import openpyxl

from tabula_engine.io.csv_reader import CsvReader
from tabula_engine.io.detection import detect_header_row
from tabula_engine.io.xlsx_reader import XlsxReader


def test_detect_header_row_skips_blank_leading_rows():
    rows = [
        [None, None, None],
        [None, None, None],
        ["Nome", "Idade", "Ativo"],
        ["Ana", 30, True],
        ["Bruno", 41, False],
    ]
    assert detect_header_row(rows) == 2


def test_detect_header_row_skips_a_title_row():
    rows = [
        ["Relatório de Vendas", None, None],
        [None, None, None],
        ["Nome", "Idade", "Ativo"],
        ["Ana", 30, True],
        ["Bruno", 41, False],
    ]
    assert detect_header_row(rows) == 2


def test_detect_header_row_defaults_to_first_non_blank_row_when_ambiguous():
    rows = [["Nome", "Idade"], ["Ana", 30], ["Bruno", 41]]
    assert detect_header_row(rows) == 0


def test_detect_header_row_on_empty_input():
    assert detect_header_row([]) == 0


def test_xlsx_reader_finds_header_past_a_title_and_blank_row(tmp_path: Path):
    wb = openpyxl.Workbook()
    sheet = wb.active
    sheet.title = "Clientes"
    sheet.append(["Relatório de Clientes Ativos"])
    sheet.append([])
    sheet.append(["Nome", "Idade", "Ativo"])
    sheet.append(["Ana", 30, True])
    sheet.append(["Bruno", 41, False])
    path = tmp_path / "clientes.xlsx"
    wb.save(path)

    tables = XlsxReader().read(path)
    assert len(tables) == 1
    table = tables[0]

    assert table.column_names() == ["Nome", "Idade", "Ativo"]
    assert table.rows == [
        {"Nome": "Ana", "Idade": 30, "Ativo": True},
        {"Nome": "Bruno", "Idade": 41, "Ativo": False},
    ]
    assert table.source.header_row == 2
    assert table.row_source_offset == 3


def test_xlsx_reader_still_reads_header_on_row_zero(tmp_path: Path):
    wb = openpyxl.Workbook()
    sheet = wb.active
    sheet.append(["Nome", "Idade"])
    sheet.append(["Ana", 30])
    path = tmp_path / "simples.xlsx"
    wb.save(path)

    tables = XlsxReader().read(path)
    assert tables[0].source.header_row == 0
    assert tables[0].column_names() == ["Nome", "Idade"]


def test_csv_reader_finds_header_past_a_title_and_blank_line(tmp_path: Path):
    path = tmp_path / "relatorio.csv"
    path.write_text(
        "Relatório de Vendas\n\nNome,Idade,Ativo\nAna,30,true\nBruno,41,false\n",
        encoding="utf-8",
    )

    tables = CsvReader().read(path)
    assert len(tables) == 1
    table = tables[0]

    assert table.column_names() == ["Nome", "Idade", "Ativo"]
    assert table.rows == [
        {"Nome": "Ana", "Idade": "30", "Ativo": "true"},
        {"Nome": "Bruno", "Idade": "41", "Ativo": "false"},
    ]
    assert table.source.header_row == 2
    assert table.row_source_offset == 3
