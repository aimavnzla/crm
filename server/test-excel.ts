import ExcelJS from 'exceljs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const EXCEL_PATH = join(__dirname, '..', '..', 'CRM_LLAMADAS_por_pais definitivo.xlsx');
console.log('Excel path:', EXCEL_PATH);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(EXCEL_PATH);
console.log('Hojas:', workbook.worksheets.map(w => w.name));

for (const ws of workbook.worksheets) {
  console.log(`\n--- ${ws.name} (${ws.rowCount} filas) ---`);
  if (ws.rowCount > 1) {
    const header = ws.getRow(1).values;
    console.log('Headers:', header);
    const row2 = ws.getRow(2).values;
    console.log('Row 2:', row2);
  }
}