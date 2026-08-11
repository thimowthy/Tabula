import pytest

from tabula_engine.definition.condition import Condition, ConditionGroup, evaluate_condition
from tabula_engine.definition.operations.builtin import FilterRowsOp


@pytest.mark.parametrize(
    "operator,value,target,expected",
    [
        ("eq", 10, 10, True),
        ("eq", 10, 5, False),
        ("neq", 10, 5, True),
        ("gt", 10, 5, True),
        ("gt", 5, 10, False),
        ("gte", 10, 10, True),
        ("lt", 5, 10, True),
        ("lte", 10, 10, True),
        ("contains", "hello world", "wor", True),
        ("contains", "hello world", "xyz", False),
        ("matches", "abc123", r"\d+", True),
        ("matches", "abcxyz", r"\d+", False),
        ("is_null", None, None, True),
        ("is_null", "x", None, False),
        ("not_null", "x", None, True),
        ("not_null", None, None, False),
    ],
)
def test_evaluate_condition_leaf_operators(operator, value, target, expected):
    condition = Condition(column="qtd", operator=operator, value=target)
    assert evaluate_condition({"qtd": value}, condition) is expected


def test_evaluate_condition_numeric_string_comparison():
    # Values coming out of a CSV/typed cell can be strings that look numeric.
    condition = Condition(column="qtd", operator="gt", value=5)
    assert evaluate_condition({"qtd": "10"}, condition) is True
    assert evaluate_condition({"qtd": "3"}, condition) is False


def test_evaluate_condition_brazilian_decimal_comparison():
    # "10,00" must compare as 10 > 3, not lose to "3,00" lexicographically
    # (which is what plain string ordering would give, since '1' < '3').
    condition = Condition(column="taxa", operator="gt", value="3,00")
    assert evaluate_condition({"taxa": "10,00"}, condition) is True
    assert evaluate_condition({"taxa": "2,50"}, condition) is False


def test_evaluate_condition_and_group():
    group = ConditionGroup(
        logic="and",
        conditions=[
            Condition(column="tipo", operator="eq", value="A"),
            Condition(column="regiao", operator="eq", value="sul"),
        ],
    )
    assert evaluate_condition({"tipo": "A", "regiao": "sul"}, group) is True
    assert evaluate_condition({"tipo": "A", "regiao": "norte"}, group) is False


def test_evaluate_condition_or_group():
    group = ConditionGroup(
        logic="or",
        conditions=[
            Condition(column="tipo", operator="eq", value="A"),
            Condition(column="tipo", operator="eq", value="B"),
        ],
    )
    assert evaluate_condition({"tipo": "A"}, group) is True
    assert evaluate_condition({"tipo": "B"}, group) is True
    assert evaluate_condition({"tipo": "C"}, group) is False


def test_evaluate_condition_nested_group():
    nested = ConditionGroup(
        logic="and",
        conditions=[
            Condition(column="ativo", operator="eq", value=True),
            ConditionGroup(
                logic="or",
                conditions=[
                    Condition(column="tipo", operator="eq", value="A"),
                    Condition(column="tipo", operator="eq", value="B"),
                ],
            ),
        ],
    )
    assert evaluate_condition({"ativo": True, "tipo": "B"}, nested) is True
    assert evaluate_condition({"ativo": False, "tipo": "B"}, nested) is False
    assert evaluate_condition({"ativo": True, "tipo": "C"}, nested) is False


def test_filter_rows_accepts_new_condition_shape():
    op = FilterRowsOp.model_validate({"condition": {"column": "qtd", "operator": "gt", "value": 5}})
    assert isinstance(op.condition, Condition)
    assert op.condition.column == "qtd"


def test_filter_rows_migrates_legacy_flat_shape():
    op = FilterRowsOp.model_validate({"column": "qtd", "operator": "gt", "value": 5})
    assert isinstance(op.condition, Condition)
    assert op.condition == Condition(column="qtd", operator="gt", value=5)


def test_filter_rows_accepts_composite_condition():
    op = FilterRowsOp.model_validate(
        {
            "condition": {
                "logic": "or",
                "conditions": [
                    {"column": "tipo", "operator": "eq", "value": "A"},
                    {"column": "tipo", "operator": "eq", "value": "B"},
                ],
            }
        }
    )
    assert isinstance(op.condition, ConditionGroup)
    assert op.condition.logic == "or"
    assert len(op.condition.conditions) == 2
