import type { ColumnType, WorkflowOperation } from '../model/types';
import { isConditionGroup, CONDITION_OPERATOR_LABEL, conditionOperatorNeedsValue, type ConditionExpr } from '../model/condition';

const TYPE_LABEL: Record<ColumnType, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  boolean: 'Booleano',
};

/** Shared by `filter_rows` and `when` — the one place a condition tree
 * becomes human-readable text. */
export function describeCondition(condition: ConditionExpr): string {
  if (isConditionGroup(condition)) {
    const parts = condition.conditions.map((c) => `(${describeCondition(c)})`);
    return parts.join(condition.logic === 'and' ? ' E ' : ' OU ');
  }
  const opLabel = CONDITION_OPERATOR_LABEL[condition.operator] ?? condition.operator;
  const needsValue = conditionOperatorNeedsValue(condition.operator);
  return `"${condition.column}" ${opLabel}${needsValue ? ` "${condition.value ?? ''}"` : ''}`;
}

const MATH_LABEL: Record<string, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
};

export const OPERATION_BADGE: Record<WorkflowOperation['type'], string> = {
  rename_column: 'REN',
  cast_column_type: 'TIPO',
  drop_columns: 'DEL',
  filter_rows: 'FILT',
  trim_whitespace: 'TRIM',
  fill_null: 'FILL',
  cast_to_integer: 'INT',
  cast_to_float: 'DEC',
  cast_to_datetime: 'DATA',
  split_column: 'SPLIT',
  fill_constant: 'CONST',
  math_operation: 'CALC',
  pad_string: 'PAD',
  reorder_column: 'MOVE',
  concat_columns: 'CONCAT',
  replace: 'SUBST',
  extract: 'EXTR',
  map_values: 'DE-PARA',
  round: 'ROUND',
  deduplicate: 'DEDUPE',
  add_column: 'COL+',
  promote_header_row: 'HEAD',
  fix_decimal_places: 'FIXDEC',
  when: 'SE',
};

export function describeOperation(op: WorkflowOperation): string {
  switch (op.type) {
    case 'rename_column':
      return `Renomear "${op.params.column}" → "${op.params.new_name}"`;
    case 'cast_column_type':
      return `Definir tipo de "${op.params.column}" como ${TYPE_LABEL[op.params.target_type]}`;
    case 'drop_columns':
      return `Remover coluna(s): ${op.params.columns.join(', ')}`;
    case 'filter_rows':
      return `Manter linhas onde ${describeCondition(op.params.condition)}`;
    case 'trim_whitespace':
      return `Remover espaços em excesso: ${op.params.columns.length ? op.params.columns.join(', ') : 'todas as colunas de texto'}`;
    case 'fill_null':
      return op.params.fill_type === 'column'
        ? `Preencher vazios de "${op.params.column}" com o valor de "${op.params.source_column ?? ''}"`
        : `Preencher vazios de "${op.params.column}" com "${op.params.value ?? ''}"`;
    case 'cast_to_integer':
      return `Converter "${op.params.column}" para número inteiro`;
    case 'cast_to_float':
      return `Converter "${op.params.column}" para número decimal`;
    case 'cast_to_datetime':
      return `Converter "${op.params.column}" para data e hora${op.params.format ? ` (formato: ${op.params.format})` : ''}`;
    case 'split_column':
      return `Dividir "${op.params.column}" por "${op.params.delimiter}" em: ${op.params.into.join(', ')}${op.params.keep_original ? ' (mantendo original)' : ''}`;
    case 'fill_constant':
      return `Preencher toda a coluna "${op.params.column}" com "${op.params.value ?? ''}"`;
    case 'math_operation': {
      const operand = op.params.operand_type === 'column' ? `"${op.params.operand}"` : op.params.operand;
      const target = op.params.output_column ? `"${op.params.output_column}"` : `"${op.params.column}"`;
      return `${target} = "${op.params.column}" ${MATH_LABEL[op.params.operator] ?? op.params.operator} ${operand}`;
    }
    case 'pad_string':
      return `Preencher "${op.params.column}" até ${op.params.length} caracteres com "${op.params.pad_char}" (${op.params.side === 'left' ? 'à esquerda' : 'à direita'})`;
    case 'reorder_column':
      return op.params.before
        ? `Mover "${op.params.column}" para antes de "${op.params.before}"`
        : `Mover "${op.params.column}" para o final`;
    case 'concat_columns':
      return `Concatenar em "${op.params.output_column}": "${op.params.template}"`;
    case 'replace':
      return `Substituir${op.params.regex ? ' (regex)' : ''} "${op.params.find}" → "${op.params.replace}" em "${op.params.column}"`;
    case 'extract': {
      const target = op.params.output_column ? `"${op.params.output_column}"` : `"${op.params.column}"`;
      return `Extrair padrão "${op.params.pattern}" de "${op.params.column}" para ${target}`;
    }
    case 'map_values': {
      const count = Object.keys(op.params.mapping).length;
      return `Substituir valores de "${op.params.column}" por de-para (${count} entrada${count === 1 ? '' : 's'})`;
    }
    case 'round':
      return `Arredondar "${op.params.column}" para ${op.params.decimals} casa(s) decimal(is)`;
    case 'deduplicate':
      return op.params.columns.length
        ? `Remover linhas duplicadas considerando: ${op.params.columns.join(', ')}`
        : 'Remover linhas duplicadas (todas as colunas)';
    case 'add_column':
      return `Adicionar coluna "${op.params.name}" (${TYPE_LABEL[op.params.column_type]})${op.params.default_value !== null ? ` com valor padrão "${op.params.default_value}"` : ''}`;
    case 'promote_header_row':
      return `Usar linha ${op.params.row_index + 1} como cabeçalho (remove as linhas até ela)`;
    case 'fix_decimal_places':
      return `Fixar "${op.params.column}" com ${op.params.decimals} casa(s) decimal(is)`;
    case 'when': {
      const casesDesc = op.params.cases
        .map((c, i) => `caso ${i + 1} (${describeCondition(c.condition)}): ${c.operations.length} operação(ões)`)
        .join('; ');
      const defaultDesc = op.params.default ? `; senão: ${op.params.default.length} operação(ões)` : '';
      return `Condicional — ${casesDesc}${defaultDesc}`;
    }
    default:
      return 'Operação';
  }
}
