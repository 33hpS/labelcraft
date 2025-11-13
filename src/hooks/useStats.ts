import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export interface DashboardStats {
  products: number;
  templates: number;
  orders: number;
  todayActivity: number;
}

export interface ActivityLog {
  action_type: string;
  target_type: string;
  target_id: string;
  target_name: string;
  user_name: string;
  user_role: string;
  metadata: string | null;
  created_at: string;
}

/**
 * Hook for fetching dashboard statistics
 */
export function useStats() {
  const [stats, setStats] = useState<DashboardStats>({
    products: 0,
    templates: 0,
    orders: 0,
    todayActivity: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<DashboardStats>('/api/stats');
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}

/**
 * Hook for fetching activity logs
 */
export function useActivityLogs(limit: number = 10) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<any>(`/api/activity-logs?limit=${limit}`);
        const nextLogs: ActivityLog[] = Array.isArray(data?.logs)
          ? data.logs
          : Array.isArray(data)
            ? data
            : [];
        setLogs(nextLogs);
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch activity logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [limit]);

  return { logs, loading, error };
}
