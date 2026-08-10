import { useRef } from 'react';
import { FileText } from 'lucide-react';
import { useActiveSheet, useWorkbookStore } from '../../store/useWorkbookStore';
import { createEmptyWorkbook } from '../../model/factory';
import { exportSheetToCsv, exportWorkbookToXlsx, importWorkbookFile } from '../../io/xlsxIO';
import { downloadWorkflow } from '../../workflow/exportWorkflow';
import { DropdownMenu } from '../ui/DropdownMenu';

export function FileMenu() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const sheet = useActiveSheet();
  const documentName = useWorkbookStore((s) => s.documentName);
  const loadWorkbook = useWorkbookStore((s) => s.loadWorkbook);
  const setDocumentName = useWorkbookStore((s) => s.setDocumentName);
  const dispatch = useWorkbookStore((s) => s.dispatch);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const wb = await importWorkbookFile(file);
      loadWorkbook(wb, file.name.replace(/\.(xlsx|csv)$/i, ''));
    } catch {
      window.alert('Não foi possível importar o arquivo. Verifique se é um .xlsx ou .csv válido.');
    }
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileSelected} />
      <DropdownMenu
        trigger={
          <span className="flex items-center gap-1.5">
            <FileText size={16} />
            <span>Arquivo</span>
          </span>
        }
        items={[
          { label: 'Abrir / Importar (.xlsx, .csv)', onSelect: () => fileInputRef.current?.click() },
          { label: '', separator: true },
          {
            label: 'Salvar workflow (.json)',
            onSelect: () => downloadWorkflow(sheet, `${documentName}-${sheet.name}-workflow`),
            disabled: sheet.workflowSteps.length === 0,
          },
          { label: '', separator: true },
          {
            label: 'Exportar planilha como .xlsx (validar formatação)',
            onSelect: () => exportWorkbookToXlsx(workbook, documentName),
          },
          {
            label: 'Exportar aba atual como .csv (validar formatação)',
            onSelect: () => exportSheetToCsv(sheet, `${documentName}-${sheet.name}`),
          },
          { label: '', separator: true },
          {
            label: 'Novo',
            onSelect: () => {
              if (window.confirm('Criar uma nova planilha? As alterações não salvas serão perdidas.')) {
                loadWorkbook(createEmptyWorkbook());
                setDocumentName('Sem título');
              }
            },
          },
          {
            label: 'Limpar aba atual',
            onSelect: () => {
              if (window.confirm(`Limpar todos os dados da aba "${sheet.name}"?`)) {
                dispatch({ type: 'CLEAR_SHEET', payload: { sheetId: sheet.id } });
              }
            },
          },
        ]}
      />
    </>
  );
}
