"""``Step`` lives in its own leaf module, separate from ``models.py``, so that
operation specs (``operations/builtin.py``) can reference it — e.g. ``WhenOp``
holding nested ``list[Step]`` branches — without a circular import: loading
``operations/builtin.py`` is itself triggered *from within* ``models.py``'s
own import chain (``models`` -> ``operations.base`` -> ``operations/__init__``
-> ``operations.builtin``), so ``builtin.py`` importing ``Step`` back out of
``models.py`` at module scope would try to pull a name out of a module that
hasn't finished executing yet. ``parse_operation`` is imported lazily inside
``operation()`` for the same reason ``operations/base.py`` lazily imports
``errors`` — this module has zero top-level dependency on ``operations``.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    from .operations.base import OperationSpec


class Step(BaseModel):
    """One entry in a workflow version's pipeline (or in a ``when`` branch).

    ``operation_type`` + ``params`` is the wire format (plain string + dict),
    kept deliberately generic so ``Step`` never has to know about every
    concrete ``OperationSpec`` subclass that exists — new operation types
    don't require touching this model. Call ``.operation()`` to resolve and
    validate it against the registry on demand.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operation_type: str
    params: dict[str, Any] = Field(default_factory=dict)
    label: str | None = None

    model_config = ConfigDict(frozen=True)

    def operation(self) -> "OperationSpec":
        from .operations.base import parse_operation

        return parse_operation(self.operation_type, self.params)
