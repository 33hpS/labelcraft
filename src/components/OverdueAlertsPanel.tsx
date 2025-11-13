import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useMemo as useReactMemo } from 'react';

export interface StageOption { id: string; name: string }

interface AlertsResponse {
  overdue: any[];
  stats?: { total: number; new_count: number; ack_count: number; closed_count: number };
  page?: number;
  page_size?: number;
  total?: number;
  total_pages?: number;
}

interface Props {
  stages: StageOption[];
}

export default function OverdueAlertsPanel({ stages }: Props) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; new_count: number; ack_count: number; closed_count: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // filters
  const [status, setStatus] = useState<string>('new');
  const [stageId, setStageId] = useState<string>('');
  const [segment, setSegment] = useState<string>('');
  const [workshop, setWorkshop] = useState<string>('');
  const [minOverdue, setMinOverdue] = useState<string>('');
  const [fromTs, setFromTs] = useState<string>('');
  const [toTs, setToTs] = useState<string>('');

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const exportUrl = useReactMemo(() => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (stageId) qs.set('stage_id', stageId);
    if (segment) qs.set('segment', segment);
    if (workshop) qs.set('workshop', workshop);
    if (fromTs) qs.set('from', fromTs);
    if (toTs) qs.set('to', toTs);
    if (minOverdue) qs.set('min_overdue', String(Number(minOverdue)));
    qs.set('export','csv');
    return `/api/production/alerts?${qs.toString()}`;
  }, [status, stageId, segment, workshop, fromTs, toTs, minOverdue]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (stageId) qs.set('stage_id', stageId);
      if (segment) qs.set('segment', segment);
      if (workshop) qs.set('workshop', workshop);
      if (fromTs) qs.set('from', fromTs);
      if (toTs) qs.set('to', toTs);
      if (minOverdue) qs.set('min_overdue', String(Number(minOverdue)));
      qs.set('page', String(page));
      qs.set('page_size', String(pageSize));

      const res = await fetch(`/api/production/alerts?${qs.toString()}`);
      if (res.ok) {
        const data: AlertsResponse = await res.json();
        setAlerts(data.overdue || []);
        if (data.stats) setStats(data.stats);
        setTotal(data.total || 0);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, stageId, segment, workshop, minOverdue, fromTs, toTs, page, pageSize]);

  const handleAck = async (id: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('jwt_token') : null;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/production/alerts/${id}/ack`, { method: 'POST', headers, body: JSON.stringify({ user: 'manager-ui' }) });
      if (res.ok) load();
    } catch (e) { console.error('Ack failed', e); }
  };

  const handleClose = async (id: string) => {
    try {
      const headers: Record<string, string> = {};
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('jwt_token') : null;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/production/alerts/${id}/close`, { method: 'POST', headers });
      if (res.ok) load();
    } catch (e) { console.error('Close failed', e); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Просрочки (SLA)
          <a href={exportUrl} className="ml-auto mr-2 text-sm underline-offset-2 hover:underline">CSV</a>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>Управление и фильтрация</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Фильтры */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Статус</label>
              <select className="bg-secondary text-sm rounded px-2 py-1" value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}>
                <option value="">Все</option>
                <option value="new">Новые</option>
                <option value="ack">Подтверждённые</option>
                <option value="closed">Закрытые</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Этап</label>
              <select className="bg-secondary text-sm rounded px-2 py-1" value={stageId} onChange={e => { setPage(1); setStageId(e.target.value); }}>
                <option value="">Все</option>
                {stages.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Сегмент</label>
              <select className="bg-secondary text-sm rounded px-2 py-1" value={segment} onChange={e => { setPage(1); setSegment(e.target.value); }}>
                <option value="">Все</option>
                <option value="econom">Эконом</option>
                <option value="lux">Люкс</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Цех</label>
              <select className="bg-secondary text-sm rounded px-2 py-1" value={workshop} onChange={e => { setPage(1); setWorkshop(e.target.value); }}>
                <option value="">Все</option>
                <option value="main">Основной</option>
                <option value="paint">Покраска</option>
                <option value="assembly">Сборка</option>
                <option value="pack">Упаковка</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Мин. просрочка (мин)</label>
              <input type="number" className="bg-secondary text-sm rounded px-2 py-1" value={minOverdue} onChange={e => { setPage(1); setMinOverdue(e.target.value); }} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">От (время)</label>
              <input type="datetime-local" className="bg-secondary text-sm rounded px-2 py-1" value={fromTs} onChange={e => { setPage(1); setFromTs(e.target.value); }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">До (время)</label>
              <input type="datetime-local" className="bg-secondary text-sm rounded px-2 py-1" value={toTs} onChange={e => { setPage(1); setToTs(e.target.value); }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">На странице</label>
              <select className="bg-secondary text-sm rounded px-2 py-1" value={pageSize} onChange={e => { setPage(1); setPageSize(Number(e.target.value)); }}>
                {[20,50,100,200].map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Всего: {stats?.total ?? total}</span>
            <span>Новые: {stats?.new_count ?? 0} • Ack: {stats?.ack_count ?? 0} • Закр: {stats?.closed_count ?? 0}</span>
          </div>

          {/* Список */}
          <div className="border rounded-md max-h-80 overflow-auto divide-y">
            {loading && (<div className="p-3 text-center text-muted-foreground text-xs">Загрузка...</div>)}
            {!loading && alerts.length === 0 && (<div className="p-3 text-center text-muted-foreground text-xs">Нет просрочек по текущим фильтрам</div>)}
            {alerts.map(a => (
              <div key={a.id} className="p-2 text-xs flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium truncate" title={a.stage_name}>{a.stage_name}</span>
                  <Badge variant={a.status === 'new' ? 'destructive' : a.status === 'ack' ? 'outline' : 'default'}>
                    {a.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Просрочка: {a.overdue_minutes} мин</span>
                  <span className="text-muted-foreground">План: {a.estimated_duration} мин</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Начато: {new Date(a.started_at).toLocaleTimeString('ru-RU')}</span>
                  {a.segment && <span className="text-muted-foreground">{a.segment}</span>}
                </div>
                <div className="flex gap-2 mt-1">
                  {a.status === 'new' && (
                    <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => handleAck(a.id)}>Ack</Button>
                  )}
                  {a.status !== 'closed' && (
                    <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => handleClose(a.id)}>Закрыть</Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Пагинация */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">Стр. {page} / {totalPages}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}>Назад</Button>
              <Button size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}>Вперёд</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
