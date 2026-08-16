import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ApiProvider, useApi } from './lib/api-context';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { CallQueue } from './components/CallQueue';
import { ContactsTable } from './components/ContactsTable';
import { SinNumeroView } from './components/SinNumeroView';
import { FijosView } from './components/FijosView';
import { Dashboard } from './components/Dashboard';
import { SeguimientoView } from './components/SeguimientoView';

type Vista = 'hoy' | 'contactos' | 'sin-numero' | 'fijos' | 'seguimiento' | 'dashboard';

function AppContent() {
  const { user, loading, logout } = useAuth();
  const api = useApi();

  if (loading) {
    return (
      <div className="min-h-screen aima-bg flex items-center justify-center">
        <div className="animate-pulse text-aima-primary">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const [vista, setVista] = useState<Vista>('hoy');
  const [importando, setImportando] = useState(false);
  const [mensajeImport, setMensajeImport] = useState('');

  const handleImportarExcel = async (file: File) => {
    setImportando(true);
    setMensajeImport('');

    try {
      setMensajeImport('Importando contactos...');
      const resultado = await api.importarExcel(file);

      if (resultado.error) {
        setMensajeImport(`Error: ${resultado.error}`);
      } else {
        setMensajeImport(`✅ Importados: ${resultado.inserted} nuevos, ${resultado.updated} actualizados`);
        window.location.reload();
      }
    } catch (err: any) {
      setMensajeImport(`Error: ${err.message}`);
    } finally {
      setImportando(false);
      setTimeout(() => setMensajeImport(''), 5000);
    }
  };

  return (
    <div className="min-h-screen aima-bg">
      <div className="flex">
        <Sidebar vistaActual={vista} onCambioVista={setVista} onImportarExcel={handleImportarExcel} user={user} onLogout={logout} />

        <main className="flex-1 min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          {/* Mensaje de importación (toast simple) */}
          {mensajeImport && (
            <div className="fixed top-4 right-4 z-50 aima-card border-aima-border rounded-xl p-4 max-w-md shadow-aima-lg animate-slide-in">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-aima-text">{mensajeImport}</span>
                <button
                  onClick={() => setMensajeImport('')}
                  className="text-aima-textMuted hover:text-aima-text"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
              {importando && (
                <div className="mt-2 h-1 bg-aima-border rounded-full overflow-hidden">
                  <div className="h-full bg-aima-primary animate-pulse" style={{ width: '100%' }} />
                </div>
              )}
            </div>
          )}

          <div key={vista} className="view-enter">
            {vista === 'hoy' && <CallQueue />}
            {vista === 'contactos' && <ContactsTable />}
            {vista === 'sin-numero' && <SinNumeroView />}
            {vista === 'fijos' && <FijosView />}
            {vista === 'seguimiento' && <SeguimientoView />}
            {vista === 'dashboard' && <Dashboard />}
          </div>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ApiProvider>
        <AppContent />
      </ApiProvider>
    </AuthProvider>
  );
}

export default App;