from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("username", name="uq_users_username"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    password_salt: Mapped[str] = mapped_column(String, nullable=False)
    # "user" (default, self-registered) or "admin" — admins are seeded at
    # startup from TABULA_ADMIN_USERNAME/TABULA_ADMIN_PASSWORD (see main.py),
    # there is no API path that lets a user promote themselves or anyone else.
    role: Mapped[str] = mapped_column(String, nullable=False, default="user", server_default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    workflows: Mapped[list["Workflow"]] = relationship(back_populates="creator")


class Workflow(Base):
    """A named, tagged, attributed workflow — the steps themselves are stored
    opaquely (same {id, operation_type, params} shape the frontend already
    uses for WorkflowOperation) since this service only needs to catalog and
    hand them back, never execute them; execution happens client-side.

    ``name``/``tags``/``steps``/``version`` mirror the current (latest)
    version so reads that only need the current state can skip the join —
    the append-only history itself lives in ``versions``."""

    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    steps: Mapped[list[dict]] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(default=1, server_default="1")
    creator_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    creator: Mapped["User"] = relationship(back_populates="workflows")
    versions: Mapped[list["WorkflowVersion"]] = relationship(
        back_populates="workflow", order_by="WorkflowVersion.version", cascade="all, delete-orphan"
    )


class WorkflowVersion(Base):
    """An immutable snapshot of a workflow, appended every time someone edits
    it — never updated or deleted once written. Editing a workflow is "anyone
    signed in may do it" (see main.py:update_workflow), so this is what lets
    a creator see who changed what and revert if needed; it mirrors the
    append-only ``Workflow``/``WorkflowVersion`` pattern already used in
    ``tabula_engine.definition.models`` for the same reason."""

    __tablename__ = "workflow_versions"
    __table_args__ = (
        UniqueConstraint("workflow_id", "version", name="uq_workflow_versions_workflow_id_version"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id"), nullable=False)
    version: Mapped[int] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    steps: Mapped[list[dict]] = mapped_column(JSON, default=list)
    changelog: Mapped[str | None] = mapped_column(String, nullable=True)
    editor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    workflow: Mapped["Workflow"] = relationship(back_populates="versions")
    editor: Mapped["User"] = relationship()


class WorkflowFavorite(Base):
    """A user's personal bookmark on a workflow — purely a per-user marker,
    doesn't affect the workflow itself or anyone else's view of it."""

    __tablename__ = "workflow_favorites"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
