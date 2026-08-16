import ExcelJS from 'exceljs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const EXCEL_PATH = join(__dirname, '..', '..', 'CRM_LLAMADAS_por_pais definitivo.xlsx');
console.log('Excel path:', EXCEL_PATH);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(EXCEL_PATH);

// Test Argentina
const ws = workbook.getWorksheet('Argentina');
if (!ws) throw new Error('Hoja Argentina no encontrada');
console.log('\n--- Argentina ---');
ws.eachRow((row, rowNumber) => {
  if (rowNumber === 1) return;
  if (rowNumber > 5) return;

  const nombre = row.getCell(1).value?.toString().trim() || '';
  const empresa = row.getCell(2).value?.toString().trim() || null;
  const website = row.getCell(3).value?.toString().trim() || null;
  const telefonoRaw = row.getCell(4).value;
  const telefono = normalizarTelefono(telefonoRaw);
  const contesto = parseBool(row.getCell(5).value);
  const no_contesto = parseBool(row.getCell(6).value);
  const interesado = parseBool(row.getCell(7).value);
  const agendo = parseBool(row.getCell(8).value);
  const cerrado = parseBool(row.getCell(9).value);
  const nota = row.getCell(11).value?.toString().trim() || null;

  console.log(`Row ${rowNumber}:`, { nombre, empresa, website, telefonoRaw, telefono, contesto, no_contesto, interesado, agendo, cerrado, nota });
});

function parseBool(val: any): 0 | 1 | null {
  if (val === true || val === 'TRUE' || val === 'True' || val === 'true' || val === 1 || val === '1') return 1;
  if (val === false || val === 'FALSE' || val === 'False' || val === 'false' || val === 0 || val === '0') return 0;
  return null;
}

function normalizarTelefono(tel: unknown): string | null {
  if (!tel) return null;
  const limpio = tel.toString().trim();
  if (!limpio || limpio.toLowerCase() === 'sin numero' || limpio.toLowerCase() === 'sin número') return null;
  return limpio;
}