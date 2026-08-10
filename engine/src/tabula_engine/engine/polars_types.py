import polars as pl

from tabula_engine.common.types import ColumnType

POLARS_DTYPE: dict[ColumnType, pl.DataType] = {
    ColumnType.TEXT: pl.Utf8,
    ColumnType.NUMBER: pl.Float64,
    ColumnType.DATE: pl.Date,
    ColumnType.BOOLEAN: pl.Boolean,
}
