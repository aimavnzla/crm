# AIMA CRM - Cold Calling App

Aplicación web local para gestionar llamadas de cold calling inmobiliario. Reemplaza el Excel con una interfaz optimizada para 80 llamadas diarias respetando horarios por país (zona horaria Venezuela).

## Características

- **Cola diaria automática**: 80 llamadas distribuidas en 9 bloques horarios según país y tipo de teléfono
- **One-click logging**: Botones/toggles para registrar resultado de llamada instantáneamente
- **Dashboard con métricas**: Hoy / Semana / Mes con desglose por país y gráficos
- **Importación Excel**: Upsert por teléfono, preserva historial de eventos
- **Tema oscuro AIMA**: Colores corporativos, accesible
- **Single-user local**: SQLite + Express + React, sin autenticación

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Recharts
- **Backend**: Express + better-sqlite3 (WAL mode, FK constraints)
- **Base de datos**: SQLite con event sourcing (`eventos_llamada`)

## Estructura del proyecto

```
aima-crm/
├── package.json              # Scripts raíz (dev, build, import)
├── README.md
├── server/
│   ├── index.ts              # Express API
│   ├── db.ts                 # SQLite, migraciones, repos
│   ├── scheduler.ts          # Lógica cola diaria (80 llamadas)
│   ├── metrics.ts            # Métricas dashboard
│   └── import-excel.ts       # Importación ExcelJS
├── client/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── api.ts            # Fetch wrappers tipados
│       ├── types.ts          # Interfaces compartidas
│       ├── utils/
│       │   ├── schedule.ts   # Config horarios (single source)
│       │   └── date.ts       # Helpers zona horaria Venezuela
│       └── components/
│           ├── Header.tsx
│           ├── CallQueue.tsx     # Vista "Hoy" - cola 80 llamadas
│           ├── CallCard.tsx      # Tarjeta con botones 1-clic
│           ├── ContactsTable.tsx # Vista "Contactos" filtrable
│           ├── SinNumeroView.tsx # Contactos sin teléfono
│           └── Dashboard.tsx     # Métricas + gráficos
└── data/
    └── aima.db               # SQLite (gitignored)
```

## Configuración de horarios (`client/src/utils/schedule.ts`)

```typescript
export const HORARIOS_LLAMADAS = [
  { inicio: "03:00", fin: "05:00", paises: ["España"], tipo: "movil+fijo", cantidad: 18, nombre: "España mañana" },
  { inicio: "08:00", fin: "10:00", paises: ["Argentina", "Uruguay"], tipo: "movil", cantidad: 18, nombre: "Arg/Ury mañana" },
  { inicio: "10:00", fin: "10:30", paises: ["Colombia", "Panama"], tipo: "movil", cantidad: 4, nombre: "Col/Pan apertura" },
  { inicio: "10:30", fin: "11:30", paises: ["España"], tipo: "movil+fijo", cantidad: 8, nombre: "España tarde" },
  { inicio: "11:30", fin: "12:00", paises: ["Colombia", "Panama"], tipo: "movil", cantidad: 4, nombre: "Col/Pan cierre" },
  { inicio: "12:00", fin: "13:00", paises: ["Costa Rica", "Mexico"], tipo: "movil", cantidad: 8, nombre: "CR/Mex mañana" },
  { inicio: "16:00", fin: "16:30", paises: ["Argentina", "Uruguay"], tipo: "movil", cantidad: 4, nombre: "Arg/Ury tarde" },
  { inicio: "17:30", fin: "18:30", paises: ["Colombia", "Panama"], tipo: "movil", cantidad: 8, nombre: "Col/Pan tarde" },
  { inicio: "18:30", fin: "19:30", paises: ["Costa Rica", "Mexico"], tipo: "movil", cantidad: 8, nombre: "CR/Mex tarde" },
];
export const TOTAL_DIARIO = 80;
export const ZONA_HORARIA = "America/Caracas";
```

## Instalación

```bash
cd aima-crm

# Instalar dependencias del servidor
npm install

# Instalar dependencias del cliente
cd client && npm install && cd ..
```

## Uso

### 1. Importar el Excel inicial

Coloca el archivo `CRM_LLAMADAS_por_pais definitivo.xlsx` en la raíz del proyecto (un nivel arriba de `aima-crm/`):

```bash
npm run import:excel
```

Esto creará `data/aima.db` con ~3,300 contactos y sus eventos históricos.

### 2. Desarrollo (frontend + backend simultáneo)

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### 3. Producción

```bash
npm run build
npm start
```

Sirve el frontend compilado desde Express en puerto 3001.

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check + zona horaria |
| GET | `/api/contactos` | Lista paginada con filtros |
| GET | `/api/contactos/sin-numero` | Contactos sin teléfono |
| GET | `/api/cola-hoy` | 80 contactos del día con bloque |
| PATCH | `/api/contactos/:id` | Actualizar + registrar evento |
| POST | `/api/importar-excel` | Subir .xlsx y procesar |
| GET | `/api/metricas?periodo=hoy\|semana\|mes` | Métricas dashboard |
| GET | `/api/metricas/serie` | Llamadas por día (14 días) |

## Modelo de datos

### `contactos`
- `id`, `nombre`, `empresa`, `website`, `telefono` (NULL = sin número)
- `pais`: Argentina, Colombia, Costa Rica, España, Mexico, Panama, Uruguay
- `tipo_telefono`: movil, fijo, sin_numero
- Booleanos: `contesto`, `no_contesto`, `interesado`, `rechazado`, `agendo`, `cerrado`, `info_enviada_email`, `info_enviada_whatsapp`
- `clasificacion`: Bien / Normal / Mal (nueva, independiente del Excel original)
- `nota`, `fecha_ultimo_contacto`

### `eventos_llamada` (event sourcing)
- `contacto_id`, `tipo`, `valor` (0/1), `timestamp`
- Permite métricas históricas precisas sin perder datos al actualizar contactos

## Lógica de priorización cola diaria

Para cada bloque horario:
1. Filtrar contactos del país/es y tipo de teléfono
2. Excluir: `contesto = 1` (ya contactados), `tipo_telefono = 'sin_numero'`
3. **Prioridad 1**: Nunca contactados (`contesto=0 AND no_contesto=0 AND fecha_ultimo_contacto IS NULL`)
4. **Prioridad 2**: Reintentos (`no_contesto=1`), ordenados por `fecha_ultimo_contacto` ASC (más antiguos primero)
5. Tomar `cantidad` contactos por bloque
6. No repetir contactos entre bloques del mismo día

## Re-importar Excel

```bash
npm run import:excel
```
- **Upsert por teléfono**: actualiza existentes, inserta nuevos
- **No borra** contactos ni eventos históricos
- **No duplica** por teléfono

## Reset completo de BD

```bash
npm run db:reset
```
Borra `data/aima.db` y re-importa el Excel.

## Scripts disponibles

```json
{
  "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
  "dev:server": "tsx watch server/index.ts",
  "dev:client": "vite",
  "build": "npm run build:client && npm run build:server",
  "build:client": "vite build",
  "build:server": "tsc -p server/tsconfig.json",
  "start": "node dist/server/index.js",
  "import:excel": "tsx server/import-excel.ts",
  "db:reset": "rm -f data/aima.db && npm run import:excel"
}
```

## Notas importantes

- **Zona horaria**: El servidor fuerza `process.env.TZ = 'America/Caracas'` al arrancar
- **Logo**: `client/public/logo.png` (archivo `group 3 (1) - copia.png` renombrado)
- **Clasificación llamada**: Bien/Normal/Mal es NUEVA, independiente de la columna original (Tradicional/Lujo). Empieza vacía.
- **Booleanos Excel**: Celdas vacías = NULL, solo `TRUE` explícito = 1
- **Fecha último contacto**: Se setea al marcar `contesto=1` O `no_contesto=1` primera vez en el día
- **Reintentos**: Contactos con `contesto=1` NUNCA vuelven a la cola automática

## Verificación rápida

1. `npm run import:excel` → BD creada con ~3300 contactos
2. `npm run dev` → Abre http://localhost:5173
3. Vista **Hoy**: 80 contactos en 9 bloques horarios
4. Click botones en tarjeta → Persiste en BD + crea evento
5. **Dashboard**: Números coinciden con conteo manual en BD
6. Re-importar Excel → No duplica, actualiza datos
7. Filtros en **Contactos** funcionan (país, tipo España móvil/fijo, estado)