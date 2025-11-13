/**
 * Templates management page - Enhanced Modern UI
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '../components/Layout/AppLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { 
  Plus, Edit, Eye, Copy, Loader2, Search, 
  Sparkles, Zap, TrendingUp, Star, Trash2,
  Grid3x3, LayoutGrid, Calendar, Ruler
} from 'lucide-react';
import { EnhancedPremiumTemplateEditor } from '../components/EnhancedPremiumTemplateEditor';
import { TemplatePreview } from '../components/TemplatePreview';
import { useTemplates, Template, TemplateSettings } from '../hooks/useTemplates';
import { toast } from 'sonner';
import { IconButton } from '../components/ui/icon-button';
import { ConfirmDialog } from '../components/ui/confirm-dialog';

type NormalizedTemplate = Template & {
  settings: TemplateSettings;
  size: string;
  createdAt: string;
};

const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  width: 58,
  height: 40,
  dpi: 203,
  marginTop: 2,
  marginRight: 2,
  marginBottom: 2,
  marginLeft: 2,
  unit: 'mm',
};

function coerceTemplateSettings(raw: unknown): TemplateSettings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Partial<TemplateSettings>) : {};

  const clampUnit = (value: unknown): TemplateSettings['unit'] => {
    return value === 'inch' || value === 'pixel' ? value : 'mm';
  };

  const resolveNumber = (value: unknown, fallback: number) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  return {
    width: resolveNumber(source.width, DEFAULT_TEMPLATE_SETTINGS.width),
    height: resolveNumber(source.height, DEFAULT_TEMPLATE_SETTINGS.height),
    dpi: resolveNumber(source.dpi, DEFAULT_TEMPLATE_SETTINGS.dpi),
    marginTop: resolveNumber(source.marginTop, DEFAULT_TEMPLATE_SETTINGS.marginTop),
    marginRight: resolveNumber(source.marginRight, DEFAULT_TEMPLATE_SETTINGS.marginRight),
    marginBottom: resolveNumber(source.marginBottom, DEFAULT_TEMPLATE_SETTINGS.marginBottom),
    marginLeft: resolveNumber(source.marginLeft, DEFAULT_TEMPLATE_SETTINGS.marginLeft),
    unit: clampUnit(source.unit),
  };
}

function normalizeTemplate(template: Template): NormalizedTemplate {
  let parsedSettings: TemplateSettings = DEFAULT_TEMPLATE_SETTINGS;

  if (typeof template.settings === 'string') {
    try {
      parsedSettings = coerceTemplateSettings(JSON.parse(template.settings));
    } catch (error) {
      console.error('Failed to parse template settings', error);
      parsedSettings = DEFAULT_TEMPLATE_SETTINGS;
    }
  } else if (template.settings) {
    parsedSettings = coerceTemplateSettings(template.settings);
  }

  return {
    ...template,
    settings: parsedSettings,
    size: `${parsedSettings.width}×${parsedSettings.height} мм`,
    createdAt: template.created_at ? template.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export default function TemplatesPage() {
  const { t } = useTranslation();
  const { 
    templates, 
    loading, 
    error,
    createTemplate, 
    updateTemplate, 
    deleteTemplate 
  } = useTemplates();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NormalizedTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<NormalizedTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Обработка ошибок
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'draft':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return t('templates.status.active');
      case 'draft':
        return t('templates.status.draft');
      default:
        return status;
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const handleEditTemplate = (template: NormalizedTemplate) => {
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handlePreviewTemplate = (template: NormalizedTemplate) => {
    // Открываем модальное окно предпросмотра
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleSaveTemplate = async (templateData: any, elements: any[]) => {
    try {
      const templateToSave = {
        name: templateData.name,
        description: templateData.description,
        settings: {
          width: templateData.width,
          height: templateData.height,
          dpi: templateData.dpi,
          marginTop: templateData.marginTop,
          marginRight: templateData.marginRight,
          marginBottom: templateData.marginBottom,
          marginLeft: templateData.marginLeft,
          unit: 'mm' as const
        },
        elements: elements,
        status: templateData.status || 'draft'
      };

      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, templateToSave);
        toast.success('Шаблон успешно обновлен');
      } else {
        await createTemplate(templateToSave);
        toast.success('Шаблон успешно создан');
      }
      
      setIsEditorOpen(false);
      setEditingTemplate(null);
    } catch (err) {
      toast.error('Ошибка при сохранении шаблона');
    }
  };

  const handleCopyTemplate = async (template: NormalizedTemplate) => {
    try {
      const { id, created_at, updated_at, size, createdAt, ...templateData } = template;
      const copiedTemplate = {
        ...templateData,
        name: `${template.name} (копия)`,
        status: 'draft' as const
      };
      
      await createTemplate(copiedTemplate);
      toast.success(t('templates.copied'));
    } catch (err) {
      toast.error(t('templates.copyError'));
    }
  };

  const handleDeleteTemplate = async (template: NormalizedTemplate) => {
    try {
      await deleteTemplate(template.id);
      toast.success(t('templates.deleted'));
    } catch (err) {
      toast.error(t('templates.deleteError'));
      throw err;
    }
  };

  // Фильтрация шаблонов
  const normalizedTemplates = useMemo(() => templates.map(normalizeTemplate), [templates]);

  const filteredTemplates = useMemo(() => {
    const lowerSearch = searchQuery.toLowerCase().trim();
    return normalizedTemplates.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(lowerSearch) ||
        template.description?.toLowerCase().includes(lowerSearch);
      const matchesFilter = filterStatus === 'all' || template.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [normalizedTemplates, searchQuery, filterStatus]);

  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Hero Header с градиентом */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.5))]" />
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl">
                  <LayoutGrid className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                  {t('templates.title')}
                </h1>
                <Sparkles className="hidden sm:block w-6 h-6 text-yellow-300 animate-pulse" />
              </div>
              <p className="text-indigo-100 text-sm sm:text-base lg:text-lg max-w-2xl">
                {t('templates.subtitle')}
              </p>
              <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2 bg-white/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full backdrop-blur-sm">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{templates.length} {t('templates.countSuffix')}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 bg-white/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full backdrop-blur-sm">
                  <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-300" />
                  <span className="hidden sm:inline">{t('templates.premiumEditor')}</span>
                  <span className="sm:hidden">{t('templates.premiumEditor')}</span>
                </div>
              </div>
            </div>
            <Button 
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto hover:shadow-2xl hover:scale-105 transition-all duration-300 font-semibold"
              onClick={handleCreateTemplate}
            >
              <Plus size={18} className="mr-2" />
              {t('templates.addNew')}
            </Button>
          </div>
        </div>

        {/* Поиск и фильтры */}
  <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row items-stretch lg:items-center justify-between bg-card p-3 sm:p-4 rounded-xl shadow-sm border border-border">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            <Input
              placeholder={t('templates.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 sm:pl-10 pr-4 border-border focus-visible:ring-2 focus-visible:ring-ring transition-all text-sm sm:text-base"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row gap-1 p-0.5 sm:p-1 bg-muted rounded-lg flex-1 sm:flex-initial">
              <Button
                size="sm"
                variant={filterStatus === 'all' ? 'default' : 'ghost'}
                onClick={() => setFilterStatus('all')}
                className="transition-all flex-1 text-xs sm:text-sm"
              >
                {t('templates.filterAll')}
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'active' ? 'default' : 'ghost'}
                onClick={() => setFilterStatus('active')}
                className="transition-all flex-1 text-xs sm:text-sm"
              >
                {t('templates.status.active')}
              </Button>
              <Button
                size="sm"
                variant={filterStatus === 'draft' ? 'default' : 'ghost'}
                onClick={() => setFilterStatus('draft')}
                className="transition-all flex-1 text-xs sm:text-sm"
              >
                {t('templates.status.draft')}
              </Button>
            </div>
            
            <div className="flex gap-1 p-1 bg-muted rounded-lg sm:self-center">
              <IconButton
                label={t('templates.viewModeGrid')}
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={t('templates.viewModeList')}
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                onClick={() => setViewMode('list')}
              >
                <LayoutGrid className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-xl opacity-50 animate-pulse" />
              <Loader2 className="relative w-16 h-16 animate-spin text-primary" />
            </div>
            <span className="mt-6 text-lg font-medium text-muted-foreground">{t('templates.loading')}</span>
          </div>
        )}

        {/* Сетка шаблонов */}
        <div className={viewMode === 'grid' 
          ? 'grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' 
          : 'flex flex-col gap-4'
        }>
          {filteredTemplates.map((template, index) => {
            return (
              <Card 
                key={template.id} 
                className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-border bg-card overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Градиентный акцент сверху */}
                <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {template.name}
                        </CardTitle>
                        {template.status === 'active' && (
                          <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <CardDescription className="text-sm line-clamp-2">
                        {template.description || t('templates.noDescription')}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={getStatusVariant(template.status)}
                      className="flex-shrink-0 shadow-sm"
                    >
                      {getStatusText(template.status)}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Статистика в карточках */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-accent p-3 rounded-lg text-center">
                      <Ruler className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <div className="text-xs text-primary font-medium">{template.size}</div>
                    </div>
                    <div className="bg-accent p-3 rounded-lg text-center">
                      <Grid3x3 className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <div className="text-xs text-primary font-medium">{template.settings.dpi} DPI</div>
                    </div>
                    <div className="bg-accent p-3 rounded-lg text-center">
                      <Calendar className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <div className="text-xs text-primary font-medium">{template.createdAt}</div>
                    </div>
                  </div>
                  
                  {/* Действия - две строки кнопок */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="group/btn hover:bg-accent hover:text-primary transition-all"
                        onClick={() => handlePreviewTemplate(template)}
                      >
                        <Eye size={16} className="mr-2 group-hover/btn:scale-110 transition-transform" />
                        {t('templates.view')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="group/btn hover:bg-accent hover:text-primary transition-all"
                        onClick={() => handleEditTemplate(template)}
                      >
                        <Edit size={16} className="mr-2 group-hover/btn:scale-110 transition-transform" />
                        {t('templates.edit')}
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="hover:bg-accent hover:text-primary transition-all"
                        onClick={() => handleCopyTemplate(template)}
                      >
                        <Copy size={16} className="mr-2" />
                        {t('templates.copyShort')}
                      </Button>
                      <ConfirmDialog
                        title={t('templates.deleteDialogTitle', { name: template.name })}
                        description={t('templates.deleteDialogDescription')}
                        confirmLabel={t('templates.delete')}
                        cancelLabel={t('common.cancel')}
                        onConfirm={() => handleDeleteTemplate(template)}
                      >
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="transition-all"
                        >
                          <Trash2 size={16} className="mr-2" />
                          {t('templates.delete')}
                        </Button>
                      </ConfirmDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && !loading && (
          <Card className="border-dashed border-2 border-border bg-card">
            <CardContent className="p-12 text-center">
              <div className="space-y-6 max-w-md mx-auto">
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-30 animate-pulse" />
                  <div className="relative bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full p-6">
                    <LayoutGrid className="w-12 h-12 text-primary" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-foreground">
                    {searchQuery || filterStatus !== 'all' 
                      ? t('templates.notFound') 
                      : t('templates.createFirst')
                    }
                  </h3>
                  <p className="text-muted-foreground text-lg">
                    {searchQuery || filterStatus !== 'all'
                      ? t('templates.tryAdjust')
                      : t('templates.subtitle')
                    }
                  </p>
                </div>
                
                {!searchQuery && filterStatus === 'all' && (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                    <Button 
                      onClick={handleCreateTemplate} 
                      size="lg"
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
                    >
                      <Plus size={20} className="mr-2" />
                      {t('templates.addNew')}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg"
                      className="hover:bg-accent"
                    >
                      <Sparkles size={20} className="mr-2" />
                      {t('templates.learnMore')}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {isEditorOpen && (() => {
          // Парсим settings если это строка JSON
          let settings: any = {};
          if (editingTemplate) {
            if (typeof editingTemplate.settings === 'string') {
              try {
                settings = JSON.parse(editingTemplate.settings);
              } catch (error) {
                console.error('Error parsing settings:', error);
                settings = {
                  width: 58,
                  height: 40,
                  dpi: 203,
                  marginTop: 2,
                  marginRight: 2,
                  marginBottom: 2,
                  marginLeft: 2
                };
              }
            } else if (typeof editingTemplate.settings === 'object') {
              settings = editingTemplate.settings;
            }
          }

          return (
            <EnhancedPremiumTemplateEditor
              template={editingTemplate ? {
                id: editingTemplate.id,
                name: editingTemplate.name,
                description: editingTemplate.description,
                width: settings.width || 58,
                height: settings.height || 40,
                dpi: settings.dpi || 203,
                marginTop: settings.marginTop || 2,
                marginRight: settings.marginRight || 2,
                marginBottom: settings.marginBottom || 2,
                marginLeft: settings.marginLeft || 2,
                status: editingTemplate.status
              } : undefined}
              initialElements={editingTemplate?.elements}
              onSave={handleSaveTemplate}
              onClose={() => {
                setIsEditorOpen(false);
                setEditingTemplate(null);
              }}
            />
          );
        })()}

        {isPreviewOpen && previewTemplate && (
          <TemplatePreview
            template={previewTemplate}
            onClose={() => {
              setIsPreviewOpen(false);
              setPreviewTemplate(null);
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}