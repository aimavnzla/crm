import { useEffect, useState, type ComponentType } from 'react';
import { Phone, Users, UserX, PhoneCall, Send, LayoutDashboard, Upload, LogOut, User, type LucideProps } from 'lucide-react';

type Vista = 'hoy' | 'contactos' | 'sin-numero' | 'fijos' | 'seguimiento' | 'dashboard';

interface User {
  id: number;
  username: string;
  nombre: string;
  rol: 'admin' | 'agente';
}

interface SidebarProps {
  vistaActual: Vista;
  onCambioVista: (vista: Vista) => void;
  onImportarExcel?: (file: File) => void;
  user?: User;
  onLogout?: () => void;
}

type Icono = ComponentType<LucideProps>;

const ICONOS: Record<Vista, Icono> = {
  hoy: Phone,
  contactos: Users,
  'sin-numero': UserX,
  fijos: PhoneCall,
  seguimiento: Send,
  dashboard: LayoutDashboard,
};

const VISTAS: Array<{ id: Vista; label: string }> = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'contactos', label: 'Contactos' },
  { id: 'sin-numero', label: 'Sin Número' },
  { id: 'fijos', label: 'Fijos' },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'dashboard', label: 'Dashboard' },
];

export function Sidebar({ vistaActual, onCambioVista, onImportarExcel, user, onLogout }: SidebarProps) {
  const [fechaHoy, setFechaHoy] = useState('');

  useEffect(() => {
    const actualizarFecha = () => {
      const formatter = new Intl.DateTimeFormat('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      });
      setFechaHoy(formatter.format(new Date()));
    };
    actualizarFecha();
    const interval = setInterval(actualizarFecha, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-14 sm:w-52 shrink-0 sticky top-0 h-screen flex flex-col aima-bgCard border-r border-aima-border">
      {/* Logo */}
      <div className="flex items-center justify-center sm:justify-start gap-2.5 h-14 px-2 sm:px-4 border-b border-aima-border shrink-0">
        <img src="/logo.png" alt="AIMA" className="h-6 w-auto" />
        <span className="hidden sm:inline text-sm font-semibold tracking-tight text-aima-text">AIMA CRM</span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 flex flex-col gap-1 p-2 sm:p-3 overflow-y-auto scrollbar-thin" role="tablist" aria-label="Vistas principales">
        {VISTAS.map((v) => {
          const activo = vistaActual === v.id;
          const Icon = ICONOS[v.id];
          return (
            <button
              key={v.id}
              role="tab"
              aria-selected={activo}
              aria-controls={`${v.id}-panel`}
              onClick={() => onCambioVista(v.id)}
              title={v.label}
              className={`relative flex items-center justify-center sm:justify-start gap-2.5 px-2 sm:px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-150 ${
                activo
                  ? 'bg-aima-primary/15 text-aima-primary'
                  : 'text-aima-textMuted hover:text-aima-text hover:bg-aima-border/50'
              }`}
            >
              {activo && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-aima-primary" aria-hidden="true" />
              )}
              <Icon size={18} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          );
        })}

        {/* Botón Importar Excel */}
        {onImportarExcel && (
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImportarExcel(e.target.files[0])}
            />
            <div
              className="flex items-center justify-center sm:justify-start gap-2.5 px-2 sm:px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-150 text-aima-textMuted hover:text-aima-primary hover:bg-aima-primary/10"
              title="Importar contactos desde Excel"
            >
              <Upload size={18} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Importar Excel</span>
            </div>
          </label>
        )}
      </nav>

      {/* Fecha */}
      <div className="hidden sm:block px-4 py-3 border-t border-aima-border text-xs text-aima-textMuted capitalize">
        {fechaHoy}
      </div>

      {/* Usuario y Logout */}
      {user && (
        <div className="shrink-0 p-3 border-t border-aima-border">
          <div className="flex items-center gap-2.5 px-2 py-2 text-sm text-aima-textMuted">
            <User size={16} aria-hidden="true" />
            <div className="flex-1 min-w-0 hidden sm:block">
              <p className="font-medium text-aima-text truncate">{user.nombre}</p>
              <p className="text-xs text-aima-textMuted truncate">@{user.username}</p>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-aima-textMuted hover:text-aima-danger hover:bg-aima-danger/10 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} strokeWidth={1.7} aria-hidden="true" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
