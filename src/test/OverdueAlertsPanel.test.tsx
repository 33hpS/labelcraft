import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OverdueAlertsPanel from '../components/OverdueAlertsPanel';

describe('OverdueAlertsPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.setItem('jwt_token', 'test_token');
    (global as any).fetch = vi.fn(async (url: string) => {
      if (url.startsWith('/api/production/alerts')) {
        return {
          ok: true,
          json: async () => ({
            overdue: [
              { id: 'a1', order_id: 'ORDER-1', stage_name: 'Этап 1', overdue_minutes: 15, estimated_duration: 10, status: 'new', started_at: new Date().toISOString() },
              { id: 'a2', order_id: 'ORDER-2', stage_name: 'Этап 2', overdue_minutes: 5, estimated_duration: 4, status: 'ack', started_at: new Date().toISOString() }
            ],
            total: 2,
            page: 1,
            page_size: 50,
            total_pages: 1,
            stats: { total: 2, new_count: 1, ack_count: 1, closed_count: 0 }
          })
        } as any;
      }
      return { ok: false, json: async () => ({}) } as any;
    });
  });

  it('renders alerts and stats', async () => {
    render(<OverdueAlertsPanel stages={[{ id: 's1', name: 'Этап 1' }]} />);
    expect(screen.getByText(/Просрочки/)).toBeInTheDocument();
    await waitFor(() => {
      const stage1Elements = screen.getAllByText('Этап 1');
      expect(stage1Elements.length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.getByText('Этап 2')).toBeInTheDocument();
    });
  });

  it('filters by status', async () => {
    render(<OverdueAlertsPanel stages={[]} />);
    await waitFor(() => expect(screen.getByText(/Просрочки/)).toBeInTheDocument());
    
    const allSelects = screen.getAllByRole('combobox');
    // First combobox is status
    fireEvent.change(allSelects[0], { target: { value: 'ack' } });
    
    await waitFor(() => {
      const calls = ((global as any).fetch as any).mock.calls;
      const hasAckCall = calls.some((c: any[]) => c[0]?.includes('status=ack'));
      expect(hasAckCall).toBe(true);
    });
  });

  it('exports CSV link builds correctly', () => {
    render(<OverdueAlertsPanel stages={[]} />);
    const csvLink = screen.getByText('CSV');
    expect(csvLink.getAttribute('href')).toMatch(/export=csv/);
  });

  it('handles empty results gracefully', async () => {
    (global as any).fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ overdue: [], total: 0, stats: { total: 0, new_count: 0, ack_count: 0, closed_count: 0 } })
    }));
    render(<OverdueAlertsPanel stages={[]} />);
    await waitFor(() => {
      expect(screen.getByText(/Нет просрочек/)).toBeInTheDocument();
    });
  });

  it('disables pagination buttons at boundaries', async () => {
    render(<OverdueAlertsPanel stages={[]} />);
    await waitFor(() => {
      const backBtn = screen.getByText('Назад');
      const fwdBtn = screen.getByText('Вперёд');
      expect(backBtn).toBeDisabled(); // page 1
      expect(fwdBtn).toBeDisabled(); // no more pages
    });
  });

  it('handles ack action', async () => {
    const mockAck = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    (global as any).fetch = vi.fn(async (url: string, opts?: any) => {
      if (url.includes('/ack')) return mockAck();
      return {
        ok: true,
        json: async () => ({
          overdue: [{ id: 'a1', order_id: 'ORDER-1', stage_name: 'Этап 1', overdue_minutes: 15, estimated_duration: 10, status: 'new', started_at: new Date().toISOString() }],
          total: 1,
          page: 1,
          page_size: 50,
          total_pages: 1,
          stats: { total: 1, new_count: 1, ack_count: 0, closed_count: 0 }
        })
      } as any;
    });
    render(<OverdueAlertsPanel stages={[]} />);
    
    await waitFor(() => {
      const stage1Elements = screen.getAllByText('Этап 1');
      expect(stage1Elements.length).toBeGreaterThan(0);
    });
    
    const ackBtn = screen.getByText('Ack');
    fireEvent.click(ackBtn);
    await waitFor(() => expect(mockAck).toHaveBeenCalled());
  });
});
