import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { join } from 'path';
import { obtenerColaDelDia, obtenerFechaVenezuela } from './scheduler.js';
import { calcularMetricas, calcularSerieLlamadas } from './metrics.js';
import { importarExcel } from './import-excel.js';
import { db, contactoRepo, updateContactoWithEvento, usuarioRepo } from './db.js';
import { basicAuthMiddleware, getAuthUser, createInitialUsers, AuthUser } from './auth.js';
import { PROJECT_ROOT, CLIENT_DIST, EXCEL_PATH } from './paths.js';

// Configurar multer para upload de Excel
const upload = multer({ dest: join(PROJECT_ROOT, 'tmp') });

// Helper para obtener query param como string
function qp(val: unknown): string {
    return Array.isArray(val) ? val[0] : (val as string) || '';
}

// Función para crear la app Express (útil para Vercel)
export function createApp() {
    const app = express();

    // Forzar zona horaria Venezuela
    process.env.TZ = 'America/Caracas';

    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Crear usuarios iniciales si no existen (fire-and-forget, OK para init)
    createInitialUsers();

    // Servir archivos estáticos del frontend en producción
    app.use(express.static(CLIENT_DIST));

    // ==================== RUTAS API ====================
    // Health check (público)
    app.get('/api/health', (req, res) => {
        res.json({ ok: true, timestamp: new Date().toISOString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    });

    // Login - devuelve info del usuario autenticado
    app.post('/api/auth/login', basicAuthMiddleware, (req, res) => {
        const user = getAuthUser(req);
        if (user) {
            res.json({
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                rol: user.rol
            });
        } else {
            res.status(401).json({ error: 'No autenticado' });
        }
    });

    // Verificar sesión actual
    app.get('/api/auth/me', basicAuthMiddleware, (req, res) => {
        const user = getAuthUser(req);
        if (user) {
            res.json({
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                rol: user.rol
            });
        } else {
            res.status(401).json({ error: 'No autenticado' });
        }
    });

    // Middleware para todas las rutas protegidas
    const protectedRouter = express.Router();
    protectedRouter.use(basicAuthMiddleware);
    app.use('/api', protectedRouter);
    return app;
}

const app = createApp();
const PORT = process.env.PORT || 3001;

// GET /api/contactos - Lista paginada con filtros (BD compartida, todos ven todo)
app.get('/api/contactos', async (req, res) => {
    const pais = qp(req.query.pais);
    const tipo_telefono = qp(req.query.tipo_telefono);
    const estado = qp(req.query.estado);
    const busqueda = qp(req.query.busqueda);
    const con_whatsapp = qp(req.query.con_whatsapp);
    const page = qp(req.query.page) || '1';
    const limit = qp(req.query.limit) || '50';

    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (pais && pais !== 'todos') {
        where += ' AND pais = ?';
        params.push(pais);
    }
    if (tipo_telefono && tipo_telefono !== 'todos') {
        where += ' AND tipo_telefono = ?';
        params.push(tipo_telefono);
    }
    if (estado && estado !== 'todos') {
        switch (estado) {
            case 'contesto':
                where += ' AND contesto = 1';
                break;
            case 'no_contesto':
                where += ' AND no_contesto = 1';
                break;
            case 'interesado':
                where += ' AND interesado = 1';
                break;
            case 'sin_contactar':
                where += ' AND contesto = 0 AND no_contesto = 0';
                break;
        }
    }
    if (busqueda) {
        where += ' AND (nombre LIKE ? OR empresa LIKE ? OR telefono LIKE ?)';
        const searchTerm = '%' + busqueda + '%';
        params.push(searchTerm, searchTerm, searchTerm);
    }
    if (con_whatsapp === '1') {
        where += " AND whatsapp IS NOT NULL AND whatsapp != ''";
    }
    // Excluir sin_numero de la lista principal por defecto
    if (!tipo_telefono || tipo_telefono === 'todos') {
        where += " AND tipo_telefono != 'sin_numero'";
    }
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    // Contar total
    const totalRow = await db.execute({ sql: 'SELECT COUNT(*) as total FROM contactos ' + where, args: params });
    const total = (totalRow.rows[0] as { total: number } | undefined)?.total ?? 0;
    // Obtener datos
    const contactosResult = await db.execute({
        sql: `SELECT * FROM contactos ${where} ORDER BY pais, tipo_telefono, nombre LIMIT ? OFFSET ?`,
        args: [...params, limitNum, offset]
    });
    const contactos = contactosResult.rows;
    res.json({
        data: contactos,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
    });
});

// GET /api/contactos/sin-numero (BD compartida, todos ven todo)
app.get('/api/contactos/sin-numero', async (req, res) => {
    const contactos = await contactoRepo.findSinNumero.all();
    res.json({ data: contactos, total: contactos.length });
});

// GET /api/contactos/fijos/resumen - Resumen del apartado de fijos (BD compartida)
app.get('/api/contactos/fijos/resumen', async (req, res) => {
    const totalResult = await db.execute({ sql: "SELECT COUNT(*) as t FROM contactos WHERE tipo_telefono = 'fijo'", args: [] });
    const total = (totalResult.rows[0] as { t: number } | undefined)?.t ?? 0;
    const conWhatsappResult = await db.execute({ sql: "SELECT COUNT(*) as t FROM contactos WHERE tipo_telefono = 'fijo' AND whatsapp IS NOT NULL AND whatsapp != ''", args: [] });
    const conWhatsapp = (conWhatsappResult.rows[0] as { t: number } | undefined)?.t ?? 0;
    const conMovilResult = await db.execute({ sql: "SELECT COUNT(*) as t FROM contactos WHERE tipo_telefono = 'fijo' AND nota LIKE '%Móvil web:%'", args: [] });
    const conMovil = (conMovilResult.rows[0] as { t: number } | undefined)?.t ?? 0;
    res.json({ total, conWhatsapp, conMovil });
});

// GET /api/contactos/:id
app.get('/api/contactos/:id', async (req, res) => {
    const contacto = await contactoRepo.findById.get(req.params.id);
    if (!contacto) return res.status(404).json({ error: 'No encontrado' });
    res.json(contacto);
});

// PATCH /api/contactos/:id - Actualizar contacto + registrar eventos
app.patch('/api/contactos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await contactoRepo.findById.get(id);
        if (!existing) return res.status(404).json({ error: 'No encontrado' });

        const body = req.body;
        const fields: Record<string, unknown> = {};
        const eventos: Array<{ tipo: string; valor: number }> = [];

        // Campos booleanos: si cambiaron, registrar evento
        const booleanFields = ['contesto', 'no_contesto', 'interesado', 'rechazado', 'agendo', 'cerrado', 'info_enviada_email', 'info_enviada_whatsapp'] as const;
        const eventTypeMap: Record<string, string> = {
            contesto: 'contesto',
            no_contesto: 'no_contesto',
            interesado: 'interesado',
            rechazado: 'rechazado',
            agendo: 'agendo',
            cerrado: 'cerrado',
            info_enviada_email: 'email',
            info_enviada_whatsapp: 'whatsapp',
        };

        for (const campo of booleanFields) {
            if (body[campo] !== undefined) {
                const valor = body[campo] ? 1 : 0;
                fields[campo] = valor;
                // Solo registrar evento si el valor es 1 (cambio positivo)
                if (valor === 1) {
                    eventos.push({ tipo: eventTypeMap[campo], valor: 1 });
                }
            }
        }

        // Campos no booleanos
        if (body.clasificacion !== undefined) fields.clasificacion = body.clasificacion;
        if (body.nota !== undefined) fields.nota = body.nota;
        if (body.fecha_ultimo_contacto !== undefined) fields.fecha_ultimo_contacto = body.fecha_ultimo_contacto;

        await updateContactoWithEvento(id, fields, eventos);
        const updated = await contactoRepo.findById.get(id);
        res.json(updated);
    } catch (err) {
        console.error('Error actualizando contacto:', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Error desconocido' });
    }
});

// POST /api/contactos/:id/llamar
app.post('/api/contactos/:id/llamar', async (req, res) => {
    const { resultado, nota, whatsapp } = req.body as { resultado?: string; nota?: string; whatsapp?: string };
    const updateData: Record<string, unknown> = { ultima_llamada: new Date().toISOString() };
    if (resultado === 'contesto') updateData.contesto = 1;
    else if (resultado === 'no_contesto') updateData.no_contesto = 1;
    if (nota !== undefined) updateData.nota = nota;
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp;
    await updateContactoWithEvento(parseInt(req.params.id), updateData, [
        ...(resultado === 'contesto' ? [{ tipo: 'contesto', valor: 1 }] : []),
        ...(resultado === 'no_contesto' ? [{ tipo: 'no_contesto', valor: 1 }] : []),
        ...(nota !== undefined ? [{ tipo: 'contesto', valor: 1 }] : []),
    ]);
    const updated = await contactoRepo.findById.get(req.params.id);
    res.json(updated);
});

// GET /api/cola-hoy (cola personal del usuario autenticado)
app.get('/api/cola-hoy', async (req, res) => {
    const user = getAuthUser(req) as AuthUser;
    const ahora = obtenerFechaVenezuela();
    const cola = await obtenerColaDelDia(ahora, user.id);
    res.json(cola);
});

// GET /api/seguimiento - Contactos interesados o que agendaron (BD compartida)
app.get('/api/seguimiento', async (req, res) => {
    const contactos = await contactoRepo.findSeguimiento.all();
    res.json({ data: contactos, total: contactos.length });
});

// GET /api/metricas
app.get('/api/metricas', async (req, res) => {
    const periodo = qp(req.query.periodo) as 'hoy' | 'semana' | 'mes';
    const metrics = await calcularMetricas(periodo || 'hoy');
    res.json(metrics);
});

// GET /api/metricas/serie-llamadas
app.get('/api/metricas/serie-llamadas', async (req, res) => {
    const dias = qp(req.query.dias);
    const serie = await calcularSerieLlamadas(parseInt(dias) || 14);
    res.json(serie);
});

// POST /api/importar-excel
app.post('/api/importar-excel', upload.single('excel'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió archivo' });
        }
        // Copiar archivo a ubicación esperada por import-excel.ts
        const fs = await import('fs');
        fs.copyFileSync(req.file.path, EXCEL_PATH);
        fs.unlinkSync(req.file.path);
        const resultado = await importarExcel();
        res.json({ ok: true, ...resultado });
    }
    catch (err) {
        console.error('Error importando Excel:', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Error desconocido' });
    }
});

// Fallback para SPA en producción
app.get('*', (req, res) => {
    res.sendFile(join(CLIENT_DIST, 'index.html'));
});

// ============================================================
// EXPORT PARA INICIO DIRECTO
// ============================================================
export { app };

// Función para iniciar el servidor
export function startServer() {
    return app.listen(PORT, () => {
        console.log('Servidor corriendo en http://localhost:' + PORT);
        console.log('Zona horaria: ' + Intl.DateTimeFormat().resolvedOptions().timeZone);
    });
}

// Solo iniciar servidor si se ejecuta directamente (no importado)
const isMainModule = (() => {
    try {
        const mainPath = process.argv[1];
        if (mainPath) {
            const expectedUrl = 'file://' + mainPath;
            if (import.meta.url === expectedUrl) return true;
        }
        // @ts-ignore - import.meta.main existe en Node 20+
        if (typeof import.meta.main === 'boolean') {
            // @ts-ignore
            return import.meta.main;
        }
    } catch {}
    return false;
})();

if (isMainModule) {
    startServer();
}