// Resolución de rutas del proyecto que funciona tanto en dev (tsx, desde server/)
// como en producción (compilado en dist/server/): busca el package.json más cercano
// hacia arriba para anclar la raíz del proyecto.
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findProjectRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('No se encontró package.json en el árbol de directorios');
    dir = parent;
  }
}

export const PROJECT_ROOT = findProjectRoot(__dirname);
export const DATA_DIR = join(PROJECT_ROOT, 'data');
export const CLIENT_DIST = join(PROJECT_ROOT, 'client', 'dist');
// El Excel vive un nivel arriba de la raíz del proyecto (ver README)
export const EXCEL_PATH = join(PROJECT_ROOT, '..', 'CRM_LLAMADAS_por_pais definitivo.xlsx');
