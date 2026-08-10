class TabulaEngineError(Exception):
    """Base class for all errors raised by tabula_engine."""


class UnknownOperationType(TabulaEngineError):
    """Raised when a Step references an operation_type with no registered OperationSpec."""

    def __init__(self, operation_type: str):
        super().__init__(f"Unknown operation type: {operation_type!r}. Is it registered?")
        self.operation_type = operation_type


class SpecValidationError(TabulaEngineError):
    """Raised when a workflow/step/operation spec fails structural validation."""


class NoCompilerForOperation(TabulaEngineError):
    """Raised when an engine has no compiler registered for a given operation type."""

    def __init__(self, operation_type: str, engine_name: str):
        super().__init__(f"Engine {engine_name!r} has no compiler registered for operation {operation_type!r}.")
        self.operation_type = operation_type
        self.engine_name = engine_name


class TableDetectionError(TabulaEngineError):
    """Raised when the I/O layer cannot locate a tabular region in a sheet."""
