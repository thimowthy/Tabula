"""Extension point for operation types.

Adding a new operation kind is a two-step, additive change:

1. Subclass ``OperationSpec`` with the operation's typed parameters and decorate
   it with ``@register_operation("my_operation")``.
2. Give the engine(s) that need to support it a matching compiler
   (see ``tabula_engine.engine.executor.register_compiler``).

Nothing else in the definition layer, ``Step``, or ``Workflow`` needs to change —
they only ever refer to operations by their string ``type``. This is what keeps
operations decoupled from any particular engine (principle 4).
"""

from __future__ import annotations

from typing import Any, ClassVar

from pydantic import BaseModel

_OPERATION_REGISTRY: dict[str, type["OperationSpec"]] = {}


class OperationSpec(BaseModel):
    """Base class for a declarative, typed operation. Instances are immutable
    descriptions of *intent* ("rename column X to Y"), never of a UI gesture."""

    type: ClassVar[str]

    model_config = {"frozen": True}


def register_operation(type_name: str):
    """Class decorator that registers an OperationSpec subclass under ``type_name``.

    Raises at import time (not at runtime) if the name is already taken, so
    registration collisions surface immediately rather than as a confusing
    runtime dispatch bug.
    """

    def decorator(cls: type[OperationSpec]) -> type[OperationSpec]:
        if type_name in _OPERATION_REGISTRY:
            raise ValueError(f"Operation type {type_name!r} is already registered to {_OPERATION_REGISTRY[type_name]!r}")
        cls.type = type_name
        _OPERATION_REGISTRY[type_name] = cls
        return cls

    return decorator


def parse_operation(operation_type: str, params: dict[str, Any]) -> OperationSpec:
    """Look up ``operation_type`` in the registry and validate ``params`` into it.

    Raises ``UnknownOperationType`` if nothing is registered under that name —
    imported lazily to avoid a definition -> errors -> definition cycle.
    """

    from tabula_engine.errors import UnknownOperationType

    cls = _OPERATION_REGISTRY.get(operation_type)
    if cls is None:
        raise UnknownOperationType(operation_type)
    return cls.model_validate(params)


def known_operation_types() -> list[str]:
    return sorted(_OPERATION_REGISTRY)
