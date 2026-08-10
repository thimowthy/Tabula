from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import get_current_user
from .database import get_db, init_db
from .security import create_access_token, hash_password, verify_password


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    init_db()
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
    workflow = models.Workflow(
        name=payload.name,
        tags=payload.tags,
        steps=[step.model_dump() for step in payload.steps],
        creator_id=current_user.id,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


@app.delete("/workflows/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> None:
    workflow = db.get(models.Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow não encontrado.")
    if workflow.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Só quem criou o workflow pode excluí-lo.")
    db.delete(workflow)
    db.commit()
