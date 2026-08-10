import pytest

from tabula_engine.definition.operations import known_operation_types, parse_operation, register_operation
from tabula_engine.definition.operations.base import OperationSpec
from tabula_engine.errors import UnknownOperationType


def test_builtin_operations_are_registered():
    types = known_operation_types()
    assert "rename_column" in types
    assert "cast_column_type" in types
    assert "filter_rows" in types


def test_parse_unknown_operation_raises():
    with pytest.raises(UnknownOperationType):
        parse_operation("does_not_exist", {})


def test_registering_a_new_operation_type_requires_no_changes_elsewhere():
    @register_operation("test_only_uppercase_column")
    class UppercaseColumnOp(OperationSpec):
        column: str

    assert "test_only_uppercase_column" in known_operation_types()
    parsed = parse_operation("test_only_uppercase_column", {"column": "nome"})
    assert isinstance(parsed, UppercaseColumnOp)
    assert parsed.column == "nome"


def test_registering_duplicate_type_name_fails_fast():
    @register_operation("test_only_duplicate_guard")
    class First(OperationSpec):
        pass

    with pytest.raises(ValueError):

        @register_operation("test_only_duplicate_guard")
        class Second(OperationSpec):
            pass
