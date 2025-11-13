/**
 * Premium Template Editor - Top-tier modern UI
 */
import { useState } from 'react';
import { TemplateEditor } from './TemplateEditor';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  Sparkles, LayoutTemplate, Zap, Settings2, Layers,
  ZoomIn, ZoomOut, Grid3x3, Eye, Move, Palette
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface PremiumTemplateEditorProps {
  template?: any;
  initialElements?: any[];
  onSave: (template: any, elements: any[]) => void;
  onClose: () => void;
}

export function PremiumTemplateEditor({ template, initialElements, onSave, onClose }: PremiumTemplateEditorProps) {
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[98vw] w-full h-[98vh] p-0 gap-0 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {template ? 'Редактирование шаблона' : 'Создание нового шаблона'}
          </DialogTitle>
          <DialogDescription>
            Премиум визуальный редактор этикеток с полноэкранным просмотром и расширенными инструментами.
          </DialogDescription>
        </DialogHeader>
        {/* Premium Header */}
        <div className="relative p-6 border-b bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-grid-white/10" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <LayoutTemplate className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
                  {template ? 'Редактирование шаблона' : 'Создание нового шаблона'}
                  <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
                </h2>
                <p className="text-indigo-100 text-sm mt-1">Премиум визуальный редактор этикеток</p>
              </div>
            </div>
            
            {/* Toolbar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-lg p-1">
                <Button
                  size="sm"
                  variant={showGrid ? 'secondary' : 'ghost'}
                  onClick={() => setShowGrid(!showGrid)}
                  className="h-9 text-white hover:bg-white/30"
                >
                  <Grid3x3 className="w-4 h-4 mr-1" />
                  Сетка
                </Button>
                <Button
                  size="sm"
                  variant={showRulers ? 'secondary' : 'ghost'}
                  onClick={() => setShowRulers(!showRulers)}
                  className="h-9 text-white hover:bg-white/30"
                >
                  <Settings2 className="w-4 h-4 mr-1" />
                  Линейки
                </Button>
              </div>
              
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setZoom(Math.max(25, zoom - 25))}
                  disabled={zoom <= 25}
                  className="h-8 w-8 p-0 text-white hover:bg-white/30"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm font-bold min-w-[3.5rem] text-center">{zoom}%</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setZoom(Math.min(200, zoom + 25))}
                  disabled={zoom >= 200}
                  className="h-8 w-8 p-0 text-white hover:bg-white/30"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
              
              <Button
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                onClick={() => setZoom(100)}
              >
                <Eye className="w-4 h-4 mr-1" />
                100%
              </Button>
            </div>
          </div>
        </div>

        {/* Wrapped Original Editor with Enhanced Container */}
        <div className="flex-1 overflow-hidden relative">
          <div 
            className={`h-full transition-all duration-300 ${showGrid ? 'bg-grid-pattern' : 'bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100'}`}
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              height: zoom === 100 ? '100%' : `${(100 / zoom) * 100}%`
            }}
          >
            <TemplateEditor
              template={template}
              initialElements={initialElements}
              onSave={onSave}
              onClose={onClose}
            />
          </div>
        </div>

        {/* Premium Footer Info */}
        <div className="px-6 py-3 border-t bg-gradient-to-r from-gray-50 to-white flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">Премиум редактор</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              <Layers className="w-3 h-3 mr-1" />
              Версия 2.0
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Palette className="w-3 h-3" />
            <span>Все инструменты доступны</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add CSS for grid pattern
const style = document.createElement('style');
style.textContent = `
  .bg-grid-pattern {
    background-image: linear-gradient(0deg, rgba(0,0,0,0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
    background-size: 20px 20px;
    background-color: #f9fafb;
  }
`;
document.head.appendChild(style);
