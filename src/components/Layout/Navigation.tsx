import { Link, useLocation, Navigate } from 'react-router';
import { Package, LayoutTemplate, User, Home, Scan, ClipboardList, LogOut, LogIn, Menu, X, Warehouse, Shield, KeyRound, Sun, Moon, Monitor, Settings as SettingsIcon, Factory } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import { useIsMobile } from '../../hooks/use-mobile';
import InfoWidget from './InfoWidget';
import LanguageSwitcher from './LanguageSwitcher';
import ChangeOwnPasswordDialog from '../ChangeOwnPasswordDialog';
import SessionBadge from '../SessionBadge';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

/**
 * Main navigation component
 */
export default function Navigation() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const { t } = useTranslation();
  const { theme, resolved, setTheme, toggle } = useTheme();

  const navItems = [
    { path: '/', label: t('common.home'), icon: Home, minRole: 'assembler' },
    { path: '/products', label: t('common.products'), icon: Package, minRole: 'manager' },
    { path: '/templates', label: t('common.templates'), icon: LayoutTemplate, minRole: 'manager' },
    { path: '/orders', label: t('common.orders'), icon: ClipboardList, minRole: 'assembler' },
    { path: '/warehouse', label: t('warehouse.title', 'Склад'), icon: Warehouse, minRole: 'warehouse' },
    { path: '/operator', label: t('common.operator'), icon: User, minRole: 'operator' },
    { path: '/scanner', label: t('common.scanner'), icon: Scan, minRole: 'operator' },
    { path: '/production', label: 'Производство', icon: Factory, minRole: 'manager' },
    { path: '/settings', label: t('common.settings', 'Настройки'), icon: SettingsIcon, minRole: 'assembler' },
    { path: '/admin/users', label: t('common.adminPanel'), icon: Shield, minRole: 'admin' },
  ] as const;

  const order = ['assembler','operator','warehouse','manager','admin'];
  const canSee = (minRole: string) => {
    if (!user) return false;
    return order.indexOf(user.role) >= order.indexOf(minRole);
  };

  return (
    <nav className="bg-background text-foreground shadow-sm border-b border-border">
      <div className="mx-auto w-full max-w-full lg:max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold">
              {t('nav.title')}
            </h1>
            <div className="hidden md:flex space-x-4">
              {user && navItems.filter(item => canSee(item.minRole)).map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {!user && (
              <Link to="/login" className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground">
                <LogIn size={16} /> <span className="hidden sm:inline">{t('common.login')}</span>
              </Link>
            )}
            {user && (
              <>
                {/* Переключатель языка */}
                <LanguageSwitcher />
                
                {/* Виджет с временем, погодой и курсами */}
                <InfoWidget variant="desktop" />
                
                {/* Session expiry badge */}
                <SessionBadge />
                
                <div className="hidden sm:flex text-sm px-3 py-1 bg-accent text-foreground/90 rounded-md">
                  {user.displayName} <span className="text-muted-foreground">({t(`roles.${user.role}`, user.role)})</span>
                </div>
                {/* Theme menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="hidden sm:flex items-center justify-center w-9 h-9 rounded-md border border-border hover:bg-accent transition-colors"
                      title={resolved === 'dark' ? t('common.dark') : resolved === 'light' ? t('common.light') : t('common.system')}
                    >
                      {resolved === 'dark' ? <Moon size={16} /> : resolved === 'light' ? <Sun size={16} /> : <Monitor size={16} />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>{t('settings.appearance', 'Оформление')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={theme} onValueChange={(val) => setTheme(val as any)}>
                      <DropdownMenuRadioItem value="light">
                        <Sun className="mr-2" /> {t('common.light')}
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="dark">
                        <Moon className="mr-2" /> {t('common.dark')}
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="system">
                        <Monitor className="mr-2" /> {t('common.system')}
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={() => setPwdOpen(true)}
                  className="hidden sm:flex items-center space-x-1 text-sm text-muted-foreground hover:text-foreground"
                  title={t('profile.changePassword.action')}
                >
                  <KeyRound size={16} /> <span>{t('profile.changePassword.action')}</span>
                </button>
                <button
                  onClick={logout}
                  className="hidden sm:flex items-center space-x-1 text-sm text-destructive hover:text-destructive/90"
                >
                  <LogOut size={16} /> <span>{t('common.logout')}</span>
                </button>
                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </>
            )}
          </div>
        </div>

        {user && (
          <div className="lg:hidden px-4 pb-3">
            <InfoWidget variant="mobile" />
          </div>
        )}

        {/* Mobile menu */}
        {user && mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-4">
            <div className="flex flex-col space-y-2">
              {navItems.filter(item => canSee(item.minRole)).map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-md text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="px-4 py-2 text-sm">
                <div className="font-medium">{user.displayName}</div>
                <div className="text-muted-foreground">{t(`roles.${user.role}`, user.role)}</div>
              </div>
              <button
                onClick={toggle}
                className="flex items-center space-x-2 w-full px-4 py-3 text-left text-base font-medium hover:bg-accent rounded-md transition-colors"
              >
                {resolved === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                <span>{resolved === 'dark' ? t('common.light','Светлая тема') : t('common.dark','Тёмная тема')}</span>
              </button>
              <button
                onClick={() => setPwdOpen(true)}
                className="flex items-center space-x-2 w-full px-4 py-3 text-left text-base font-medium hover:bg-accent rounded-md transition-colors"
              >
                <KeyRound size={20} />
                <span>{t('profile.changePassword.action')}</span>
              </button>
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2 w-full px-4 py-3 text-left text-base font-medium hover:bg-accent rounded-md transition-colors"
              >
                <SettingsIcon size={20} />
                <span>{t('common.settings','Настройки')}</span>
              </Link>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full px-4 py-3 text-left text-base font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              >
                <LogOut size={20} />
                <span>{t('common.logout')}</span>
              </button>
            </div>
          </div>
        )}
        {/* Change password dialog */}
        {user && (
          <div className="hidden">
            {/* placeholder to keep components mounted contextually */}
          </div>
        )}
      </div>
      {/* Mount dialog at nav level */}
      {user ? (
        <ChangeOwnPasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
      ) : null}
    </nav>
  );
}
