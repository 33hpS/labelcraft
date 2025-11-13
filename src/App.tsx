import { HashRouter, Route, Routes, Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import HomePage from './pages/Home'
import ProductsPage from './pages/Products'
import TemplatesPage from './pages/Templates'
import OperatorPage from './pages/Operator'
import ScannerPage from './pages/Scanner'
import OrdersPage from './pages/Orders'
import WarehousePage from './pages/Warehouse'
import LoginPage from './pages/Login'
import AdminUsersPage from './pages/AdminUsers'
import SettingsPage from './pages/Settings'
import ProductionDashboard from './pages/ProductionDashboard'
import { AuthProvider, useAuth } from './context/AuthContext'
import { UserRole } from './types/auth'
import { Unauthorized } from './components/Unauthorized'

// Component to protect routes and enforce role requirements
function ProtectedRoute({ children, role }: { children: React.ReactElement; role?: UserRole | UserRole[] }) {
  const { user, isReady, hasRole } = useAuth();
  const { t } = useTranslation();

  if (!isReady) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <span>{t('auth.loadingSession')}</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && !hasRole(role)) {
    return <Unauthorized message={t('auth.permissionDenied')} />;
  }

  return children;
}

/**
 * Main application routing
 */
export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/products" element={
            <ProtectedRoute role="manager">
              <ProductsPage />
            </ProtectedRoute>
          } />
          <Route path="/templates" element={
            <ProtectedRoute role="manager">
              <TemplatesPage />
            </ProtectedRoute>
          } />
          <Route path="/orders" element={
            <ProtectedRoute role="assembler">
              <OrdersPage />
            </ProtectedRoute>
          } />
          <Route path="/warehouse" element={
            <ProtectedRoute role="warehouse">
              <WarehousePage />
            </ProtectedRoute>
          } />
          <Route path="/operator" element={
            <ProtectedRoute role="operator">
              <OperatorPage />
            </ProtectedRoute>
          } />
          <Route path="/scanner" element={
            <ProtectedRoute role="operator">
              <ScannerPage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute role="admin">
              <AdminUsersPage />
            </ProtectedRoute>
          } />
          <Route path="/production" element={
            <ProtectedRoute role={['admin', 'manager']}>
              <ProductionDashboard />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
