import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate } from 'react-router';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, login, loginJwt } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Попытка серверного логина (JWT) с предположением роли менеджера как дефолт
      let ok = false;
      if (loginJwt) {
        ok = await loginJwt(username.trim(), password, 'manager');
      }
      if (!ok) {
        // Фоллбэк на локальную авторизацию
        ok = await login(username.trim(), password);
      }
      if (!ok) setError(t('login.invalidCredentials'));
    } catch (err) {
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  }

  const quickLogin = async (role: string) => {
    setError('');
    setLoading(true);
    try {
      const credentials: Record<string, { username: string; password: string }> = {
        admin: { username: 'admin', password: 'admin123' },
        manager: { username: 'manager', password: 'manager123' },
        operator: { username: 'operator', password: 'operator123' },
        warehouse: { username: 'zavsklad', password: 'zavsklad123' },
        assembler: { username: 'assembler', password: 'assembler123' },
        'assembler-lux': { username: 'assembler-lux', password: 'lux123' },
        'assembler-econom': { username: 'assembler-econom', password: 'econom123' },
      };
      const cred = credentials[role];
      if (cred) {
        let ok = false;
        if (loginJwt) {
          // Пытаемся отдать роль из выбранного пресета
          const roleMap: Record<string, string> = {
            admin: 'admin',
            manager: 'manager',
            operator: 'operator',
            warehouse: 'warehouse',
            assembler: 'assembler',
            'assembler-lux': 'assembler',
            'assembler-econom': 'assembler',
          };
          const r = roleMap[role] as any;
          ok = await loginJwt(cred.username, cred.password, r ?? 'manager');
        }
        if (!ok) ok = await login(cred.username, cred.password);
        if (!ok) setError(t('login.error'));
      }
    } catch (err) {
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="pt-6 pb-8 px-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-medium text-foreground">
                {t('login.username')}
              </Label>
              <Input
                id="email"
                name="username"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t('login.usernamePlaceholder', 'user@factory.com')}
                className="h-12 text-base"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base font-medium text-foreground">
                {t('login.password')}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder', 'Введите пароль')}
                  className="h-12 pr-12 text-base"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold"
            >
              {loading ? t('common.loading') : t('login.loginButton')}
            </Button>

            <div className="border-t pt-6 mt-6">
              <p className="text-center text-sm text-muted-foreground mb-4">
                {t('login.demoAccounts')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => quickLogin('admin')}
                  disabled={loading}
                  className="h-11 font-medium"
                >
                  {t('roles.admin')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => quickLogin('manager')}
                  disabled={loading}
                  className="h-11 font-medium"
                >
                  {t('roles.manager')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => quickLogin('operator')}
                  disabled={loading}
                  className="h-11 font-medium"
                >
                  {t('roles.operator')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => quickLogin('warehouse')}
                  disabled={loading}
                  className="h-11 font-medium"
                >
                  {t('roles.warehouse', 'Завсклад')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => quickLogin('assembler')}
                  disabled={loading}
                  className="h-11 font-medium"
                >
                  {t('roles.assembler')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => quickLogin('assembler-lux')}
                  disabled={loading}
                  className="h-11 font-medium"
                >
                  {t('roles.assemblerLux', 'Сборщик (Люкс)')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => quickLogin('assembler-econom')}
                  disabled={loading}
                  className="h-11 font-medium"
                >
                  {t('roles.assemblerEconom', 'Сборщик (Эконом)')}
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">
                {t('login.passwordFormat')}
              </p>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {t('login.rolesInfo')}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
