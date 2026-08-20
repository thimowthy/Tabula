from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import get_current_user
from .database import SessionLocal, get_db, init_db
from .security import create_access_token, hash_password, verify_password


def _seed_admin() -> None:
    """Grants the "admin" role (the only role that can delete workflows it
    didn't create) to one account named by TABULA_ADMIN_USERNAME/PASSWORD.
    There's deliberately no API endpoint that grants this role — the only
    ways to become admin are this env-seeded account or a direct DB edit."""
    username = os.environ.get("TABULA_ADMIN_USERNAME")
    password = os.environ.get("TABULA_ADMIN_PASSWORD")
    if not username or not password:
        return

    db = SessionLocal()
    try:
        user = db.execute(select(models.User).where(models.User.username == username)).scalar_one_or_none()
        if user is None:
            password_hash, salt = hash_password(password)
            db.add(models.User(username=username, password_hash=password_hash, password_salt=salt, role="admin"))
        elif user.role != "admin":
            user.role = "admin"
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    init_db()
    _seed_admin()
    yield


app = FastAPI(title="Tabula Server", description="Accounts and workflow catalog for Tabula", lifespan=_lifespan)

# Dev-friendly default: the Vite dev server's port varies (5173, 5174, ...)
# when several instances run, so any localhost origin is allowed here rather
# than hardcoding one. Restrict this before deploying anywhere beyond a
# developer's own machine.
_allowed_origins = os.environ.get("TABULA_CORS_ORIGINS")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins.split(",") if _allowed_origins else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/auth/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCredentials, db: Session = Depends(get_db)) -> schemas.Token:
    existing = db.execute(select(models.User).where(models.User.username == payload.username)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esse nome de usuário já está em uso.")

    password_hash, salt = hash_password(payload.password)
    user = models.User(username=payload.username, password_hash=password_hash, password_salt=salt)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id)
    return schemas.Token(access_token=token, user=schemas.UserPublic.model_validate(user))


@app.post("/auth/login", response_model=schemas.Token)
def login(payload: schemas.UserCredentials, db: Session = Depends(get_db)) -> schemas.Token:
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha inválidos.")
    user = db.execute(select(models.User).where(models.User.username == payload.username)).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash, user.password_salt):
        raise invalid

    token = create_access_token(subject=user.id)
    return schemas.Token(access_token=token, user=schemas.UserPublic.model_validate(user))


@app.get("/auth/me", response_model=schemas.UserPublic)
def me(current_user: models.User = Depends(get_current_user)) -> schemas.UserPublic:
    return schemas.UserPublic.model_validate(current_user)


@app.get("/workflows", response_model=list[schemas.WorkflowPublic])
def list_workflows(tag: str | None = None, db: Session = Depends(get_db)) -> list[models.Workflow]:
    """Public read — browsing/running the catalog needs no login, only
    publishing to it does. Filters client-side-friendly: pass ``tag`` to get
    just the workflows carrying it, or omit it to list everything (the
    frontend groups the full list by tag itself)."""
    stmt = select(models.Workflow).order_by(models.Workflow.created_at.desc())
    workflows = db.execute(stmt).scalars().all()
    if tag:
        workflows = [w for w in workflows if tag in w.tags]
    return list(workflows)


@app.get("/workflows/{workflow_id}", response_model=schemas.WorkflowPublic)
def get_workflow(workflow_id: str, db: Session = Depends(get_db)) -> models.Workflow:
    workflow = db.get(models.Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow não encontrado.")
    return workflow


@app.post("/workflows", response_model=schemas.WorkflowPublic, status_code=status.HTTP_201_CREATED)
def create_workflow(
    payload: schemas.WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Workflow:
    steps = [step.model_dump() for step in payload.steps]
    workflow = models.Workflow(
        name=payload.name,
        tags=payload.tags,
        steps=steps,
        version=1,
        creator_id=current_user.id,
    )
    db.add(workflow)
    db.flush()
    db.add(
        models.WorkflowVersion(
            workflow_id=workflow.id,
            version=1,
            name=payload.name,
            tags=payload.tags,
            steps=steps,
            changelog=None,
            editor_id=current_user.id,
        )
    )
    db.commit()
    db.refresh(workflow)
    return workflow


@app.put("/workflows/{workflow_id}", response_model=schemas.WorkflowPublic)
def update_workflow(
    workflow_id: str,
    payload: schemas.WorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Workflow:
    """Any signed-in user may edit any workflow — editing appends a new
    ``WorkflowVersion`` snapshot (never overwrites history) and advances the
    workflow's current state to it. Only deleting is creator/admin-only."""
    workflow = db.get(models.Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow não encontrado.")

    steps = [step.model_dump() for step in payload.steps]
    next_version = workflow.version + 1
    db.add(
        models.WorkflowVersion(
            workflow_id=workflow.id,
            version=next_version,
            name=payload.name,
            tags=payload.tags,
            steps=steps,
            changelog=payload.changelog,
            editor_id=current_user.id,
        )
    )
    workflow.name = payload.name
    workflow.tags = payload.tags
    workflow.steps = steps
    workflow.version = next_version
    db.commit()
    db.refresh(workflow)
    return workflow


@app.get("/workflows/{workflow_id}/versions", response_model=list[schemas.WorkflowVersionPublic])
def list_workflow_versions(workflow_id: str, db: Session = Depends(get_db)) -> list[models.WorkflowVersion]:
    workflow = db.get(models.Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow não encontrado.")
    stmt = (
        select(models.WorkflowVersion)
        .where(models.WorkflowVersion.workflow_id == workflow_id)
        .order_by(models.WorkflowVersion.version.desc())
    )
    return list(db.execute(stmt).scalars().all())


@app.get("/workflows/{workflow_id}/versions/{version}", response_model=schemas.WorkflowVersionPublic)
def get_workflow_version(workflow_id: str, version: int, db: Session = Depends(get_db)) -> models.WorkflowVersion:
    stmt = select(models.WorkflowVersion).where(
        models.WorkflowVersion.workflow_id == workflow_id, models.WorkflowVersion.version == version
    )
    workflow_version = db.execute(stmt).scalar_one_or_none()
    if workflow_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Versão não encontrada.")
    return workflow_version


@app.delete("/workflows/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> None:
    workflow = db.get(models.Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow não encontrado.")
    if workflow.creator_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Só quem criou o workflow ou um Admin pode excluí-lo."
        )
    db.delete(workflow)
    db.commit()
