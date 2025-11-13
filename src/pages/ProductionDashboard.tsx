/**
 * Production Dashboard for managers
 * Real-time monitoring of all production stages
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '../components/Layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { 
  Factory, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  Users,
  Calendar,
  RefreshCw,
  ArrowRight,
  Play
} from 'lucide-react';
import OverdueAlertsPanel from '../components/OverdueAlertsPanel';

interface ProductionStage {
  id: string;
  name: string;
  sequence_order: number;
  department?: string;
  estimated_duration?: number;
}

interface OrderProgress {
  order_id: string;
  order_qr: string;
  customer_name?: string;
  current_stage: string;
  current_stage_id: string;
  status: 'started' | 'completed';
  start_time: string;
  operator_name: string;
  elapsed_minutes?: number;
  completed_stages: number;
  total_stages: number;
  progress_percentage: number;
}

interface StageStatistics {
  stage_name: string;
  avg_duration_minutes: number;
  total_completed: number;
  total_in_progress: number;
  estimated_duration: number;
  efficiency_percentage: number;
}

interface DashboardData {
  active_orders: OrderProgress[];
  stage_statistics: StageStatistics[];
  total_orders_today: number;
  completed_orders_today: number;
  in_progress_orders: number;
  total_operators: number;
  order_progress?: Array<{
    order_id: string;
    total_stages: number;
    completed_stages: number;
    progress_percentage: number;
  }>;
}

export default function ProductionDashboard() {
  const { t } = useTranslation();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('new');
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterSegment, setFilterSegment] = useState<string>('');
  const [filterWorkshop, setFilterWorkshop] = useState<string>('');
  const [alertsStats, setAlertsStats] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
    // Обновлять данные каждые 30 секунд
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Загрузить этапы
      const stagesResponse = await fetch('/api/production/stages');
      if (stagesResponse.ok) {
        const stagesData = await stagesResponse.json();
        setProductionStages(stagesData.stages || []);
      }

      // Загрузить данные дашборда
      const dashboardResponse = await fetch('/api/production/dashboard');
      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        setDashboardData(data);
        setLastUpdate(new Date());
      }

      // Отдельно получим просроченные этапы (SLA alerts)
      const alertsRes = await fetch('/api/production/alerts');
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setOverdueCount(Array.isArray(alertsData.overdue) ? alertsData.overdue.length : 0);
        setAlerts(alertsData.overdue || []);
        setAlertsStats(alertsData.stats || null);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  const loadFilteredAlerts = async () => {
    setAlertsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set('status', filterStatus);
      if (filterStage) qs.set('stage_id', filterStage);
      if (filterSegment) qs.set('segment', filterSegment);
      if (filterWorkshop) qs.set('workshop', filterWorkshop);
      qs.set('limit', '200');
      const res = await fetch(`/api/production/alerts?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.overdue || []);
        setAlertsStats(data.stats || null);
        setOverdueCount(Array.isArray(data.overdue) ? data.overdue.length : 0);
      }
    } catch (e) {
      console.error('Failed to load filtered alerts', e);
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleAck = async (id: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('jwt_token') : null;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/production/alerts/${id}/ack`, { method: 'POST', headers, body: JSON.stringify({ user: 'manager-ui' }) });
      if (res.ok) {
        await loadFilteredAlerts();
      }
    } catch (e) { console.error('Ack failed', e); }
  };

  const handleClose = async (id: string) => {
    try {
      const headers: Record<string, string> = {};
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('jwt_token') : null;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/production/alerts/${id}/close`, { method: 'POST', headers });
      if (res.ok) {
        await loadFilteredAlerts();
      }
    } catch (e) { console.error('Close failed', e); }
  };

  useEffect(() => {
    loadFilteredAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterStage, filterSegment, filterWorkshop]);
  

  const getStageProgress = (orderId: string) => {
    // Вычислить прогресс заказа по этапам
    const order = dashboardData?.active_orders.find(o => o.order_id === orderId);
    if (!order) return 0;
    return Math.round((order.completed_stages / order.total_stages) * 100);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Factory className="h-8 w-8" />
              Производственный контроль
            </h1>
            <p className="text-muted-foreground mt-2">
              Мониторинг всех этапов в реальном времени
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Обновлено: {lastUpdate.toLocaleTimeString('ru-RU')}
            </p>
            <Button variant="outline" size="sm" onClick={loadDashboardData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Заказов в работе</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.in_progress_orders || 0}</div>
              <p className="text-xs text-muted-foreground">
                Активных на производстве
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Завершено сегодня</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.completed_orders_today || 0}</div>
              <p className="text-xs text-muted-foreground">
                из {dashboardData?.total_orders_today || 0} заказов
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Операторов</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.total_operators || 0}</div>
              <p className="text-xs text-muted-foreground">
                Работают на участках
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Средняя эффективность</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.stage_statistics ? 
                  Math.round(
                    dashboardData.stage_statistics.reduce((acc, s) => acc + s.efficiency_percentage, 0) / 
                    dashboardData.stage_statistics.length
                  ) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                По всем этапам
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Просроченные этапы</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overdueCount}</div>
              <p className="text-xs text-muted-foreground">Требуют внимания</p>
            </CardContent>
          </Card>
        </div>

  <div className="grid gap-6 lg:grid-cols-3">
          {/* Активные заказы */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Активные заказы
              </CardTitle>
              <CardDescription>
                Заказы, находящиеся в производстве
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!dashboardData?.active_orders || dashboardData.active_orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Нет активных заказов</p>
                    <p className="text-sm mt-1">Все заказы завершены или не начаты</p>
                  </div>
                ) : (
                  dashboardData.active_orders.map((order) => (
                    <div 
                      key={order.order_id} 
                      className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-lg">{order.order_qr}</p>
                          {order.customer_name && (
                            <p className="text-sm text-muted-foreground">
                              Клиент: {order.customer_name}
                            </p>
                          )}
                        </div>
                        <Badge variant={order.status === 'started' ? 'default' : 'outline'}>
                          {order.status === 'started' ? 'В работе' : 'Завершено'}
                        </Badge>
                      </div>

                      {/* Текущий этап */}
                      <div className="flex items-center gap-2 mb-3 p-2 bg-primary/10 rounded-md">
                        <Play className="h-4 w-4 text-primary animate-pulse" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{order.current_stage}</p>
                          <p className="text-xs text-muted-foreground">
                            Оператор: {order.operator_name} • 
                            Начато: {new Date(order.start_time).toLocaleTimeString('ru-RU')}
                            {order.elapsed_minutes !== undefined && 
                              ` • Прошло: ${order.elapsed_minutes} мин`
                            }
                          </p>
                        </div>
                      </div>

                      {/* Прогресс-бар */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Прогресс</span>
                          <span className="font-medium">
                            {order.completed_stages} из {order.total_stages} этапов
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${order.progress_percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Статистика по этапам */}
          <Card className="lg:col-span-2">
          <OverdueAlertsPanel stages={productionStages.map(s => ({ id: s.id, name: s.name }))} />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Статистика этапов
              </CardTitle>
              <CardDescription>
                Производительность по каждому этапу
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!dashboardData?.stage_statistics || dashboardData.stage_statistics.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Нет данных по этапам</p>
                  </div>
                ) : (
                  dashboardData.stage_statistics.map((stat, index) => (
                    <div 
                      key={index} 
                      className="p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium">{stat.stage_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Среднее время: {stat.avg_duration_minutes} мин 
                            (план: {stat.estimated_duration} мин)
                          </p>
                        </div>
                        <Badge 
                          variant={stat.efficiency_percentage >= 100 ? 'default' : 'outline'}
                        >
                          {stat.efficiency_percentage}%
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Завершено</p>
                          <p className="font-medium text-lg">{stat.total_completed}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">В работе</p>
                          <p className="font-medium text-lg">{stat.total_in_progress}</p>
                        </div>
                      </div>

                      {/* Индикатор эффективности */}
                      <div className="mt-3">
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all ${
                              stat.efficiency_percentage >= 100 
                                ? 'bg-green-500' 
                                : stat.efficiency_percentage >= 80 
                                  ? 'bg-yellow-500' 
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(stat.efficiency_percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Информация о миграции */}
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
              <AlertCircle className="h-5 w-5" />
              Требуется применение миграции
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Для полноценной работы производственного модуля необходимо применить миграции 005_production_workflow.sql и 006_order_progress_view.sql через Cloudflare Dashboard.
            </p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <p className="text-xs text-muted-foreground">
                После применения миграции дашборд начнёт отображать реальные данные
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
