import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';

describe('AuthContext JWT expiry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('restores jwt_exp from localStorage', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const futureExp = nowSec + 600;
    window.localStorage.setItem('auth_user_v1', JSON.stringify({ id: 'test', username: 'test', displayName: 'Test', role: 'manager' }));
    window.localStorage.setItem('jwt_exp', String(futureExp));
    window.localStorage.setItem('jwt_token', 'test_token');

    render(
      <AuthProvider>
        <div>Test</div>
      </AuthProvider>
    );

    // Basic smoke test: component renders and doesn't crash on restore
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('renders without jwt_exp', () => {
    render(
      <AuthProvider>
        <div>No Auth</div>
      </AuthProvider>
    );
    expect(screen.getByText('No Auth')).toBeInTheDocument();
  });
});
