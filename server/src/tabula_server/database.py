from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.environ.get("TABULA_DB_URL", "sqlite:///./tabula.db")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from . import models  # noqa: F401  (registers models on Base.metadata before create_all)

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """``create_all`` only creates tables that don't exist yet — it never
    alters an existing one, so a column added to a model after its table was
    first created (e.g. ``workflows.version``, ``users.role``) never reaches
    a database that predates it. There's no Alembic here (small app, one
    dev), so this patches those columns in by hand instead; additive-only
    and safe to run on every startup."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                col_type = column.type.compile(dialect=engine.dialect)
                ddl = f"ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}"
                if column.server_default is not None:
                    value = column.server_default.arg
                    if column.type.python_type is str:
                        value = "'" + str(value).replace("'", "''") + "'"
                    ddl += f" DEFAULT {value}"
                conn.execute(text(ddl))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
