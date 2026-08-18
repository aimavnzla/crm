import { useState, FormEvent, ChangeEvent } from 'react';
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Card, Input, Button } from './ui';

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen aima-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo-horizontal.png" alt="AIMA CRM" className="mx-auto h-16 w-auto mb-4" />
          <h1 className="text-2xl font-bold text-aima-text">AIMA CRM</h1>
          <p className="text-aima-textMuted mt-1">Inicia sesión para continuar</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-aima-danger/10 border border-aima-danger/20 text-aima-danger text-sm flex items-center gap-2" role="alert">
            <Lock size={16} aria-hidden="true" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="label">Usuario</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-aima-textMuted" aria-hidden="true" />
              <Input
                id="username"
                type="text"
                placeholder="anthoni, rafael o santiago"
                value={username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                className="pl-10"
                autoComplete="username"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="label">Contraseña</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-aima-textMuted" aria-hidden="true" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-aima-textMuted hover:text-aima-text"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading} loading={loading}>
            <Loader2 size={18} className="mr-2 animate-spin" aria-hidden="true" />
            Iniciar sesión
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-aima-border">
          <p className="text-xs text-aima-textMuted text-center">
            Usuarios de prueba: anthoni/anthoni123 · rafael/rafael123 · santiago/santiago123
          </p>
        </div>
      </Card>
    </div>
  );
}