import pytest
from pydantic import ValidationError

from tabula_engine.definition.models import Step, TargetColumn, TargetSchema, Workflow
from tabula_engine.common.types import ColumnType


def _schema() -> TargetSchema:
    return TargetSchema(columns=[TargetColumn(name="nome", type=ColumnType.TEXT)])


def test_with_new_version_does_not_mutate_original():
    workflow = Workflow(name="Clientes")
    assert workflow.latest_version is None

    step = Step(operation_type="rename_column", params={"column": "Nome ", "new_name": "nome"})
    v1 = workflow.with_new_version(steps=[step], target_schema=_schema())

    assert workflow.latest_version is None, "original Workflow must be untouched"
    assert v1.latest_version.version == 1

    v2 = v1.with_new_version(steps=[step, step], target_schema=_schema(), changelog="added a step")
    assert v1.latest_version.version == 1, "v1 snapshot must be untouched by building v2"
    assert v2.latest_version.version == 2
    assert len(v2.versions) == 2
    assert v2.get_version(1).version == 1


def test_workflow_version_is_frozen():
    workflow = Workflow(name="Clientes").with_new_version(steps=[], target_schema=_schema())
    with pytest.raises(ValidationError):
        workflow.latest_version.version = 99
