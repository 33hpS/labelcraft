/**
 * Enhanced Template Editor - Advanced Features Version
 * Улучшенный редактор с дополнительными возможностями
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TemplateEditor } from './TemplateEditor';
import { 
  Sparkles, Settings2, Layers, ZoomIn, ZoomOut, Grid3x3, Eye, 
  RotateCcw, Redo2, Copy, Trash2, Lock, Unlock,
  Keyboard, MoreVertical
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from './ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface EnhancedTemplateEditorProps {
  template?: any;
  initialElements?: any[];
  onSave: (template: any, elements: any[]) => void;
  onClose: () => void;
}

interface HistoryEntry {
  elements: any[];
  timestamp: number;
}

/**
 * Enhanced Template Editor with advanced features
 * - Undo/Redo система
 * - Горячие клавиши (Ctrl+Z, Ctrl+Y)
 * - Выделение элементов
 * - Zoom управление
 */
export function EnhancedTemplateEditor({ 
  template, 
  initialElements, 
  onSave, 
  onClose 
}: EnhancedTemplateEditorProps) {
  // === UI State ===
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [showLayers, setShowLayers] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);

  // === History (Undo/Redo) ===
  const [history, setHistory] = useState<HistoryEntry[]>([
    { elements: initialElements || [], timestamp: Date.now() }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // === Selection & Clipboard ===
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<any[] | null>(null);
  const [clipboardHistory, setClipboardHistory] = useState<any[][]>([]);
  const [lockedElements, setLockedElements] = useState<Set<string>>(new Set());

  // === Refs ===
  const editorRef = useRef<HTMLDivElement>(null);

  // === Get current elements ===
  const currentElements = useMemo(() => history[historyIndex].elements, [history, historyIndex]);

  // === Save to history ===
  const addToHistory = useCallback((elements: any[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ elements, timestamp: Date.now() });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // === Undo/Redo ===
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  }, [historyIndex, history.length]);

  // === Copy/Paste ===
  const copy = useCallback(() => {
    if (selectedElements.length > 0) {
      const copied = currentElements.filter(el => selectedElements.includes(el.id));
      setClipboard(copied);
      setClipboardHistory([...clipboardHistory, copied]);
    }
  }, [selectedElements, currentElements, clipboardHistory]);

  const paste = useCallback(() => {
    if (clipboard && clipboard.length > 0) {
      const pasted = clipboard.map(el => ({
        ...el,
        id: `${el.id}-copy-${Date.now()}`,
        x: el.x + 10,
        y: el.y + 10
      }));
      const newElements = [...currentElements, ...pasted];
      addToHistory(newElements);
    }
  }, [clipboard, currentElements, addToHistory]);

  // === Delete selected ===
  const deleteSelected = useCallback(() => {
    const newElements = currentElements.filter(el => !selectedElements.includes(el.id));
    addToHistory(newElements);
    setSelectedElements([]);
  }, [currentElements, selectedElements, addToHistory]);

  // === Lock/Unlock ===
  const toggleLock = useCallback(() => {
    const newLocked = new Set(lockedElements);
    selectedElements.forEach(id => {
      if (newLocked.has(id)) {
        newLocked.delete(id);
      } else {
        newLocked.add(id);
      }
    });
    setLockedElements(newLocked);
  }, [selectedElements, lockedElements]);

  // === Zoom controls ===
  const zoomIn = useCallback(() => {
    setZoom(Math.min(zoom + 10, 200));
  }, [zoom]);

  const zoomOut = useCallback(() => {
    setZoom(Math.max(zoom - 10, 50));
  }, [zoom]);

  const resetZoom = useCallback(() => {
    setZoom(100);
  }, []);

  // === Hotkeys ===
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'c':
            e.preventDefault();
            copy();
            break;
          case 'v':
            e.preventDefault();
            paste();
            break;
          case 'x':
            e.preventDefault();
            copy();
            deleteSelected();
            break;
          default:
            break;
        }
      }
      
      if (e.key === 'Delete') {
        e.preventDefault();
        deleteSelected();
      }

      // G для grid toggle
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey) {
        e.preventDefault();
        setShowGrid(!showGrid);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copy, paste, deleteSelected, showGrid]);

  // === Clipboard history viewer ===
  const ClipboardHistoryMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          title="Ctrl+Shift+V"
          disabled={clipboardHistory.length === 0}
        >
          📋 История ({clipboardHistory.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>История буфера обмена</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {clipboardHistory.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Нет истории
          </div>
        ) : (
          clipboardHistory.slice().reverse().map((item, idx) => (
            <DropdownMenuItem
              key={idx}
              onClick={() => setClipboard(item)}
              className="cursor-pointer"
            >
              <span className="text-xs">
                {item.length} элемент{item.length !== 1 ? 'ов' : ''}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // === Grid settings menu ===
  const GridSettingsMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Grid3x3 className="w-4 h-4" />
          Сетка
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Размер сетки</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {[10, 20, 50].map(size => (
          <DropdownMenuItem
            key={size}
            onClick={() => {
              setGridSize(size);
              setSnapToGrid(true);
            }}
            className="cursor-pointer"
          >
            <span className={gridSize === size ? 'font-bold' : ''}>
              {size}px {gridSize === size ? '✓' : ''}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setShowGrid(!showGrid)}
          className="cursor-pointer"
        >
          {showGrid ? '✓ Показывать сетку' : 'Скрыть сетку'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setSnapToGrid(!snapToGrid)}
          className="cursor-pointer"
        >
          {snapToGrid ? '✓ Привязка к сетке' : 'Без привязки'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* === Toolbar === */}
      <div className="border-b bg-muted/50 p-3 space-y-2">
        {/* Row 1: Main actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={undo}
                  disabled={historyIndex === 0}
                  title="Ctrl+Z"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Отменить (Ctrl+Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  title="Ctrl+Y"
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Повторить (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-border" />

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={copy}
                  disabled={selectedElements.length === 0}
                  title="Ctrl+C"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Копировать (Ctrl+C)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={paste}
                  disabled={!clipboard}
                  title="Ctrl+V"
                >
                  Вставить
                </Button>
              </TooltipTrigger>
              <TooltipContent>Вставить (Ctrl+V)</TooltipContent>
            </Tooltip>

            <ClipboardHistoryMenu />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={deleteSelected}
                  disabled={selectedElements.length === 0}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Удалить (Delete)</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-border" />

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={toggleLock}
                  disabled={selectedElements.length === 0}
                >
                  {selectedElements.some(id => lockedElements.has(id)) ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Заблокировать/Разблокировать</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={zoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Уменьшить</TooltipContent>
            </Tooltip>

            <span className="text-sm font-medium w-12 text-center">{zoom}%</span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={zoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Увеличить</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={resetZoom}>
                  100%
                </Button>
              </TooltipTrigger>
              <TooltipContent>Сбросить масштаб</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-border" />

          <GridSettingsMenu />

          <div className="flex-1" />

          <Button size="sm" variant="default" onClick={() => onSave(template, currentElements)}>
            Сохранить
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        {/* Row 2: Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex gap-4">
            <span>Выбрано: {selectedElements.length}</span>
            <span>История: {historyIndex + 1}/{history.length}</span>
            <span>Сетка: {gridSize}px {snapToGrid ? '(привязка)' : '(свободно)'}</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">Горячие клавиши: Ctrl+Z/Y (Undo/Redo) • Del (Удалить) • G (Сетка)</Badge>
          </div>
        </div>
      </div>

      {/* === Editor Content === */}
      <div className="flex-1 overflow-auto" ref={editorRef}>
        <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
          <TemplateEditor
            template={template}
            initialElements={currentElements}
            onSave={(t, els) => {
              addToHistory(els);
              onSave(t, els);
            }}
            onClose={onClose}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="border-t bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex justify-between">
        <div>Элементы: {currentElements.length}</div>
        <div>{new Date(history[historyIndex].timestamp).toLocaleTimeString('ru-RU')}</div>
      </div>
    </div>
  );
}