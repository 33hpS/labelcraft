import { Link } from 'react-router';
import { AppLayout } from '../components/Layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Package, LayoutTemplate, User, BarChart3, QrCode, Printer, Loader2, FileText, Trash2, Edit, Download, Upload, Copy, Save, RotateCcw } from 'lucide-react';
import { useStats, useActivityLogs } from '../hooks/useStats';
import { useTranslation } from 'react-i18next';

/**
 * Home page with dashboard overview
 */
export default function HomePage() {
  const { stats, loading: statsLoading } = useStats();
  const { logs, loading: logsLoading } = useActivityLogs(5);
  const { t } = useTranslation();

  const statsCards = [
    { 
      label: t('home.stats.products'), 
      value: statsLoading ? '...' : stats.products.toString(), 
      icon: Package, 
      color: 'text-primary' 
    },
    { 
      label: t('home.stats.templates'), 
      value: statsLoading ? '...' : stats.templates.toString(), 
      icon: LayoutTemplate, 
      color: 'text-primary' 
    },
    { 
      label: t('home.stats.todayActivity'), 
      value: statsLoading ? '...' : stats.todayActivity.toString(), 
      icon: Printer, 
      color: 'text-primary' 
    },
    { 
      label: t('home.stats.orders'), 
      value: statsLoading ? '...' : stats.orders.toString(), 
      icon: QrCode, 
      color: 'text-primary' 
    },
  ];

  // Map action types to readable labels
  const getActionLabel = (actionType: string): string => {
    return t(`actions.${actionType}`, actionType);
  };

  // Format metadata for display
  const formatMetadata = (metadata: string | null): string | null => {
    if (!metadata) return null;
    
    try {
      const data = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      const parts: string[] = [];
      
      if (data.count) parts.push(`${data.count} шт.`);
      if (data.items_count) parts.push(`${data.items_count} позиций`);
      if (data.products_created) parts.push(`создано товаров: ${data.products_created}`);
      if (data.source) parts.push(`источник: ${data.source}`);
      if (data.order_id) parts.push(`заказ: ${data.order_id.substring(0, 8)}...`);
      
      return parts.length > 0 ? parts.join(', ') : null;
    } catch (e) {
      return null;
    }
  };

  // Get icon for action type
  const getActionIcon = (actionType: string) => {
    const icons: Record<string, any> = {
      'product_created': Package,
      'product_updated': Edit,
      'product_deleted': Trash2,
      'template_created': FileText,
      'template_updated': Edit,
      'template_deleted': Trash2,
      'order_created': FileText,
      'order_imported': Upload,
      'order_deleted': Trash2,
      'label_printed': Printer,
      'template_version_saved': Save,
      'template_version_restored': RotateCcw,
    };
    return icons[actionType] || BarChart3;
  };

  // Get color for action type
  const getActionColor = (actionType: string): string => {
    if (actionType.includes('deleted')) return 'text-destructive bg-destructive/10';
    if (actionType.includes('created') || actionType.includes('imported')) return 'text-primary bg-primary/10';
    if (actionType.includes('printed')) return 'text-primary bg-primary/10';
    if (actionType.includes('updated') || actionType.includes('saved')) return 'text-primary bg-primary/10';
    return 'text-muted-foreground bg-muted';
  };

  // Format time ago
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds} сек назад`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    return `${days} дн назад`;
  };

  const quickActions = [
    {
      title: t('home.quickActions.products.title'),
      description: t('home.quickActions.products.desc'),
      icon: Package,
      link: '/products',
      buttonText: t('home.quickActions.products.button')
    },
    {
      title: t('home.quickActions.templates.title'),
      description: t('home.quickActions.templates.desc'),
      icon: LayoutTemplate,
      link: '/templates', 
      buttonText: t('home.quickActions.templates.button')
    },
    {
      title: t('home.quickActions.operator.title'),
      description: t('home.quickActions.operator.desc'),
      icon: User,
      link: '/operator',
      buttonText: t('home.quickActions.operator.button')
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Welcome section */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {t('home.title')}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('home.subtitle')}
          </p>
        </div>

        {/* Stats overview */}
  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {stat.value}
                      </p>
                    </div>
                    <div className={`p-3 rounded-full bg-muted ${stat.color}`}>
                      <Icon size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick actions */}
  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                  </div>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to={action.link}>
                    <Button className="w-full">
                      {action.buttonText}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>{t('home.recentActivity')}</CardTitle>
            </div>
            <CardDescription>
              {t('home.recentActivityDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t('common.loading')}</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('common.noData')}
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log, index) => {
                  const Icon = getActionIcon(log.action_type);
                  const metadata = formatMetadata(log.metadata);
                  return (
                    <div key={index} className="flex items-start gap-3 py-3 border-b border-border last:border-0 hover:bg-accent transition-colors rounded-lg px-2">
                      <div className={`p-2 rounded-lg ${getActionColor(log.action_type)}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground">{getActionLabel(log.action_type)}</p>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">{formatTimeAgo(log.created_at)}</p>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{log.target_name || 'Без названия'}</p>
                        {metadata && (
                          <p className="text-xs text-muted-foreground mt-1">{metadata}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
                            {log.user_name}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
