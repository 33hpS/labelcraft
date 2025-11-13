/**
 * Enhanced Premium Template Editor - Ultimate Version
 * Максимально улучшенный редактор с премиум функциями:
 * - Drag & Drop с visual feedback
 * - Undo/Redo система
 * - Слои и группировка элементов
 * - Горячие клавиши
 * - Предпросмотр в реальном времени
 * - Улучшенное выделение элементов
 * - Выравнивание и распределение
 * - Трансформации элементов
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TemplateEditor } from './TemplateEditor';
import { useTemplateSync } from '@/hooks/useTemplateSync';
import { TemplateVersionHistory } from './TemplateVersionHistory';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  Sparkles, LayoutTemplate, Zap, Settings2, Layers,
  ZoomIn, ZoomOut, Grid3x3, Eye, Move, Palette,
  RotateCcw, Redo2, Copy, Trash2, Lock, Unlock,
  AlignLeft, AlignCenter, AlignRight, Minimize2,
  ArrowUp, ArrowDown, Maximize2, Keyboard, MoreVertical, Clock
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

interface PremiumTemplateEditorProps {
  template?: any;
  initialElements?: any[];
  onSave: (template: any, elements: any[]) => void;
  onClose: () => void;
}

interface HistoryEntry {
  elements: any[];
  timestamp: number;
}

export function EnhancedPremiumTemplateEditor({ template, initialElements, onSave, onClose }: PremiumTemplateEditorProps) {
  const { t } = useTranslation();
  // === UI State ===
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [showLayers, setShowLayers] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20); // pixels

  // === History (Undo/Redo) ===
  const [history, setHistory] = useState<HistoryEntry[]>([
    { elements: initialElements || [], timestamp: Date.now() }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // === Selection & Clipboard ===
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<any[] | null>(null);
  const [clipboardHistory, setClipboardHistory] = useState<any[][]>([]);
  const [showClipboardMenu, setShowClipboardMenu] = useState(false);
  const [lockedElements, setLockedElements] = useState<Set<string>>(new Set());

  // === Version History (v2.1) ===
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // === Refs ===
  const editorRef = useRef<HTMLDivElement>(null);
  const dragDataRef = useRef<{ elementId: string; startX: number; startY: number } | null>(null);

  // === Template Sync (v2.1) ===
  const userId = useMemo(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userId') || `user-${Math.random().toString(36).substr(2, 9)}`;
    }
    return 'unknown';
  }, []);

  const syncHook = useTemplateSync({
    templateId: template?.id || 'temp-' + Date.now(),
    userId,
    autoSaveInterval: 30000, // 30 seconds
    enableRealTime: true,
  });

  // === Get current elements ===
  const currentElements = useMemo(() => history[historyIndex].elements, [history, historyIndex]);

  // === Auto-save mechanism ===
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (template?.id) {
        syncHook.saveVersion(currentElements, { gridSize, snapToGrid }, undefined, true)
          .catch(err => console.error('Auto-save failed:', err));
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [currentElements, template?.id, gridSize, snapToGrid, syncHook]);

  // === History Management ===
  const addToHistory = useCallback((elements: any[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    
    // Create new entry
    const newEntry = {
      elements: JSON.parse(JSON.stringify(elements)),
      timestamp: Date.now()
    };
    
    // Compress: remove duplicate consecutive entries
    if (newHistory.length > 0) {
      const lastEntry = newHistory[newHistory.length - 1];
      const isSameElements = JSON.stringify(lastEntry.elements) === JSON.stringify(newEntry.elements);
      if (isSameElements) {
        return; // Skip duplicate
      }
    }
    
    newHistory.push(newEntry);
    
    // Limit history to 500 entries
    const MAX_HISTORY = 500;
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift(); // Remove oldest entry
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

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

  // === Clipboard History Management ===
  const addToClipboardHistory = useCallback((items: any[]) => {
    setClipboard(JSON.parse(JSON.stringify(items)));
    setClipboardHistory(prev => {
      const updated = [items, ...prev].slice(0, 5); // Keep last 5
      return updated;
    });
  }, []);

  const pasteFromClipboardHistory = useCallback((items: any[]) => {
    if (!items || items.length === 0) return;
    const pasted = items.map((el) => ({
      ...el,
      id: `${el.type}-${Date.now()}-${Math.random()}`,
      x: el.x + 10,
      y: el.y + 10,
    }));
    const updated = [...currentElements, ...pasted];
    addToHistory(updated);
    setSelectedElements(pasted.map(el => el.id));
    setShowClipboardMenu(false);
  }, [currentElements, addToHistory]);

  // === Keyboard Shortcuts ===
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Shift + Z или Ctrl/Cmd + Y - Redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        redo();
      }
      // Ctrl/Cmd + C - Copy (with history)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        if (selectedElements.length > 0) {
          const selected = currentElements.filter(el => selectedElements.includes(el.id));
          addToClipboardHistory(selected);
        }
      }
      // Ctrl/Cmd + V - Paste (normal paste)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (clipboard) {
          pasteFromClipboardHistory(clipboard);
        }
      }
      // Ctrl/Cmd + Shift + V - Show clipboard history menu
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'v') {
        e.preventDefault();
        setShowClipboardMenu(!showClipboardMenu);
      }
      // Delete - Remove selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedElements.length > 0) {
          const updated = currentElements.filter(el => !selectedElements.includes(el.id));
          addToHistory(updated);
          setSelectedElements([]);
        }
      }
      // Ctrl/Cmd + D - Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedElements.length > 0) {
          const selected = currentElements.filter(el => selectedElements.includes(el.id));
          const duplicated = selected.map((el) => ({
            ...el,
            id: `${el.type}-${Date.now()}-${Math.random()}`,
            x: el.x + 15,
            y: el.y + 15,
          }));
          const updated = [...currentElements, ...duplicated];
          addToHistory(updated);
          setSelectedElements(duplicated.map(el => el.id));
        }
      }
      // Ctrl/Cmd + A - Select All
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedElements(currentElements.map(el => el.id));
      }
      // G - Toggle Snap to Grid
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setSnapToGrid(!snapToGrid);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedElements, clipboard, currentElements, addToHistory, addToClipboardHistory, pasteFromClipboardHistory]);

  // === Element Functions ===
  const deleteSelected = useCallback(() => {
    if (selectedElements.length > 0) {
      const updated = currentElements.filter(el => !selectedElements.includes(el.id));
      addToHistory(updated);
      setSelectedElements([]);
    }
  }, [selectedElements, currentElements, addToHistory]);

  const duplicateSelected = useCallback(() => {
    if (selectedElements.length > 0) {
      const selected = currentElements.filter(el => selectedElements.includes(el.id));
      const duplicated = selected.map((el) => ({
        ...el,
        id: `${el.type}-${Date.now()}-${Math.random()}`,
        x: el.x + 15,
        y: el.y + 15,
      }));
      const updated = [...currentElements, ...duplicated];
      addToHistory(updated);
      setSelectedElements(duplicated.map(el => el.id));
    }
  }, [selectedElements, currentElements, addToHistory]);

  const toggleLock = useCallback((elementId: string) => {
    const newLocked = new Set(lockedElements);
    if (newLocked.has(elementId)) {
      newLocked.delete(elementId);
    } else {
      newLocked.add(elementId);
    }
    setLockedElements(newLocked);
  }, [lockedElements]);

  // === Alignment Functions ===
  const alignSelected = useCallback((alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedElements.length < 2) return;

    const selected = currentElements.filter(el => selectedElements.includes(el.id));
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    selected.forEach(el => {
      minX = Math.min(minX, el.x);
      maxX = Math.max(maxX, el.x + el.width);
      minY = Math.min(minY, el.y);
      maxY = Math.max(maxY, el.y + el.height);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const updated = currentElements.map(el => {
      if (!selectedElements.includes(el.id)) return el;

      switch (alignment) {
        case 'left':
          return { ...el, x: minX };
        case 'center':
          return { ...el, x: centerX - el.width / 2 };
        case 'right':
          return { ...el, x: maxX - el.width };
        case 'top':
          return { ...el, y: minY };
        case 'middle':
          return { ...el, y: centerY - el.height / 2 };
        case 'bottom':
          return { ...el, y: maxY - el.height };
        default:
          return el;
      }
    });

    addToHistory(updated);
  }, [selectedElements, currentElements, addToHistory]);

  const distributeSelected = useCallback((direction: 'horizontal' | 'vertical') => {
    if (selectedElements.length < 3) return;

    const selected = currentElements.filter(el => selectedElements.includes(el.id));
    
    if (direction === 'horizontal') {
      selected.sort((a, b) => a.x - b.x);
      const totalWidth = selected.reduce((sum, el) => sum + el.width, 0);
      const spaceBetween = (selected[0].x + selected[selected.length - 1].x + selected[selected.length - 1].width - selected[0].x - totalWidth) / (selected.length - 1);
      
      let currentX = selected[0].x + selected[0].width;
      const updated = currentElements.map(el => {
        if (!selectedElements.includes(el.id)) return el;
        if (el.id === selected[0].id) return el;
        
        const result = { ...el, x: currentX + spaceBetween };
        currentX = result.x + result.width;
        return result;
      });
      addToHistory(updated);
    }
  }, [selectedElements, currentElements, addToHistory]);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`${fullscreen ? 'max-w-[100vw] w-screen h-screen' : 'max-w-[98vw] w-full h-[98vh]'} p-0 gap-0 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100`}>
        <DialogHeader className="sr-only">
          <DialogTitle>
            {template ? 'Редактирование шаблона' : 'Создание нового шаблона'}
          </DialogTitle>
          <DialogDescription>
            Расширенный премиум редактор этикеток с историей изменений, выравниванием и управлением слоями.
          </DialogDescription>
        </DialogHeader>
        
        {/* === PREMIUM HEADER === */}
        <TooltipProvider>
          <div className="relative p-3 border-b bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white overflow-hidden">
            <div className="relative z-10">
              {/* Title & Info */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                    <LayoutTemplate className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-1.5">
                      {template ? 'Редактирование шаблона' : 'Создание нового шаблона'}
                    </h2>
                  </div>
                </div>
              </div>

              {/* Controls Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* View Options */}
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-lg p-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant={showGrid ? 'secondary' : 'ghost'}
                        onClick={() => setShowGrid(!showGrid)}
                        className="h-9 text-white hover:bg-white/30"
                      >
                        <Grid3x3 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Сетка (вкл/выкл)</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant={showRulers ? 'secondary' : 'ghost'}
                        onClick={() => setShowRulers(!showRulers)}
                        className="h-9 text-white hover:bg-white/30"
                      >
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Линейки (вкл/выкл)</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant={showLayers ? 'secondary' : 'ghost'}
                        onClick={() => setShowLayers(!showLayers)}
                        className="h-9 text-white hover:bg-white/30"
                      >
                        <Layers className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Слои (вкл/выкл)</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant={snapToGrid ? 'secondary' : 'ghost'}
                        onClick={() => setSnapToGrid(!snapToGrid)}
                        className="h-9 text-white hover:bg-white/30"
                      >
                        <Grid3x3 className="w-4 h-4 opacity-70" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Магнитная сетка (G)</TooltipContent>
                  </Tooltip>

                  {/* Grid Size Menu */}
                  {snapToGrid && (
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 text-white hover:bg-white/30 text-xs"
                            >
                              {gridSize}px
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Размер сетки</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="start" className="bg-gray-900 border-gray-700">
                        <DropdownMenuLabel className="text-white text-xs">
                          Размер сетки
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-gray-700" />
                        {[10, 20, 50].map((size) => (
                          <DropdownMenuItem
                            key={size}
                            onClick={() => setGridSize(size)}
                            className={`text-white hover:bg-gray-800 cursor-pointer ${gridSize === size ? 'bg-gray-800' : ''}`}
                          >
                            <span className="text-xs">{size}px {gridSize === size ? '✓' : ''}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* History Controls */}
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-lg p-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={undo}
                        disabled={historyIndex === 0}
                        className="h-9 text-white hover:bg-white/30 disabled:opacity-50"
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
                        variant="ghost"
                        onClick={redo}
                        disabled={historyIndex === history.length - 1}
                        className="h-9 text-white hover:bg-white/30 disabled:opacity-50"
                      >
                        <Redo2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Повторить (Ctrl+Shift+Z)</TooltipContent>
                  </Tooltip>

                  <span className="text-xs px-2 text-white/70">
                    {historyIndex + 1}/{history.length}
                  </span>

                  {/* Version History Button (v2.1) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowVersionHistory(true)}
                        className="h-9 text-white hover:bg-white/30"
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>История версий (v2.1)</TooltipContent>
                  </Tooltip>
                </div>

                {/* Clipboard Controls */}
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-lg p-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={duplicateSelected}
                        disabled={selectedElements.length === 0}
                        className="h-9 text-white hover:bg-white/30 disabled:opacity-50"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Дублировать (Ctrl+D)</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={deleteSelected}
                        disabled={selectedElements.length === 0}
                        className="h-9 text-white hover:bg-white/30 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Удалить (Delete)</TooltipContent>
                  </Tooltip>

                  {/* Clipboard History Menu */}
                  {clipboardHistory.length > 0 && (
                    <DropdownMenu open={showClipboardMenu} onOpenChange={setShowClipboardMenu}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 text-white hover:bg-white/30"
                            >
                              <Copy className="w-4 h-4 mr-1" />
                              История({clipboardHistory.length})
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>История буфера (Ctrl+Shift+V)</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="start" className="bg-gray-900 border-gray-700">
                        <DropdownMenuLabel className="text-white text-xs">
                          Последние скопирования
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-gray-700" />
                        {clipboardHistory.map((items, idx) => (
                          <DropdownMenuItem
                            key={idx}
                            onClick={() => pasteFromClipboardHistory(items)}
                            className="text-white hover:bg-gray-800 cursor-pointer"
                          >
                            <span className="text-xs">
                              {idx === 0 ? '📌 Последнее' : `${idx === 1 ? '📍' : '  '} (${items.length} элемент${items.length !== 1 ? 'ов' : ''})`}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Alignment Controls */}
                {selectedElements.length > 0 && (
                  <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-lg p-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => alignSelected('left')}
                          className="h-9 w-9 p-0 text-white hover:bg-white/30"
                        >
                          <AlignLeft className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>По левому краю</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => alignSelected('center')}
                          className="h-9 w-9 p-0 text-white hover:bg-white/30"
                        >
                          <AlignCenter className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>По центру (горизонтально)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => alignSelected('right')}
                          className="h-9 w-9 p-0 text-white hover:bg-white/30"
                        >
                          <AlignRight className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>По правому краю</TooltipContent>
                    </Tooltip>

                    <div className="w-px h-6 bg-white/30" />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => alignSelected('top')}
                          className="h-9 w-9 p-0 text-white hover:bg-white/30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>По верхнему краю</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => alignSelected('middle')}
                          className="h-9 w-9 p-0 text-white hover:bg-white/30"
                        >
                          <Move className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>По центру (вертикально)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => alignSelected('bottom')}
                          className="h-9 w-9 p-0 text-white hover:bg-white/30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>По нижнему краю</TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {/* Zoom Controls */}
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 ml-auto">
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
                  <Button
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                    onClick={() => setZoom(100)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    100%
                  </Button>
                  
                  <div className="w-px h-6 bg-white/30" />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFullscreen(!fullscreen)}
                        className="h-9 w-9 p-0 text-white hover:bg-white/30"
                      >
                        {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {fullscreen
                        ? t('templateEditor.fullscreen.exit', 'Выйти из полноэкрана')
                        : t('templateEditor.fullscreen.enter', 'Полный экран')}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* === EDITOR CONTAINER === */}
          <div className="flex-1 overflow-hidden relative" ref={editorRef}>
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
                initialElements={currentElements}
                onSave={onSave}
                onClose={onClose}
              />
            </div>
          </div>
        </TooltipProvider>

        {/* === VERSION HISTORY MODAL (v2.1) === */}
        <TemplateVersionHistory
          open={showVersionHistory}
          onOpenChange={setShowVersionHistory}
          versions={syncHook.versions}
          currentVersion={history[historyIndex]?.timestamp}
          onRestore={async (versionNumber) => {
            try {
              const response = await syncHook.restoreVersion(versionNumber);
              if (response && response.template) {
                const restoredElements = typeof response.template.elements === 'string'
                  ? JSON.parse(response.template.elements)
                  : response.template.elements || [];
                addToHistory(restoredElements);
              }
            } catch (error) {
              console.error('Failed to restore version:', error);
            }
          }}
          isLoading={syncHook.syncState.isSyncing}
        />
      </DialogContent>
    </Dialog>
  );
}

// === Add CSS for grid pattern ===
if (typeof document !== 'undefined') {
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
}
