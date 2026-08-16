import { Request, Response, NextFunction } from 'express';
import { db, usuarioRepo } from './db.js';
import { createHash } from 'crypto';

export interface AuthUser {
  id: number;
  username: string;
  password_hash: string;
  nombre: string;
  rol: 'admin' | 'agente';
}

// Hash de contraseña simple (SHA-256) - en producción usar bcrypt
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Middleware de autenticación Basic Auth
export function basicAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="AIMA CRM"');
    return res.status(401).json({ error: 'Autenticación requerida' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (!username || !password) {
    res.setHeader('WWW-Authenticate', 'Basic realm="AIMA CRM"');
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const user = usuarioRepo.findByUsername.get(username) as AuthUser | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="AIMA CRM"');
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  // Adjuntar usuario al request
  (req as any).user = user;
  next();
}

// Middleware opcional - no falla si no hay auth, pero adjunta usuario si existe
export function optionalBasicAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return next();
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (!username || !password) {
    return next();
  }

  const user = usuarioRepo.findByUsername.get(username) as AuthUser | undefined;

  if (user && verifyPassword(password, user.password_hash)) {
    (req as any).user = user;
  }

  next();
}

// Helper para obtener usuario autenticado del request
export function getAuthUser(req: Request): AuthUser | null {
  return (req as any).user || null;
}

// Helper para requerir usuario autenticado
export function requireAuth(req: Request, res: Response): AuthUser | null {
  const user = getAuthUser(req);
  if (!user) {
    res.setHeader('WWW-Authenticate', 'Basic realm="AIMA CRM"');
    res.status(401).json({ error: 'Autenticación requerida' });
    return null;
  }
  return user;
}

// Crear usuario inicial (solo para setup)
export function createInitialUsers() {
  const existing = usuarioRepo.findAll.all() as AuthUser[];
  if (existing.length > 0) return;

  const users = [
    { username: 'anthoni', password: 'anthoni123', nombre: 'Anthoni', rol: 'agente' as const },
    { username: 'rafael', password: 'rafael123', nombre: 'Rafael', rol: 'agente' as const },
    { username: 'santiago', password: 'santiago123', nombre: 'Santiago', rol: 'admin' as const },
  ];

  for (const u of users) {
    const hash = hashPassword(u.password);
    usuarioRepo.insert.run(u.username, hash, u.nombre, u.rol);
    console.log(`Usuario creado: ${u.username} / ${u.password}`);
  }
}