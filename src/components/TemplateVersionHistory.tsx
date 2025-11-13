import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Clock, RotateCcw, Trash2, Check } from 'lucide-react';

export interface VersionHistoryItem {
  versionNumber: number;
  name: string;
  createdAt: string;
  createdBy: string;
  changeSummary?: string;
  isAutosave: boolean;
}

interface TemplateVersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: VersionHistoryItem[];
  currentVersion?: number;
  onRestore: (versionNumber: number) => Promise<void>;
  onDelete?: (versionNumber: number) => Promise<void>;
  isLoading?: boolean;
}

export function TemplateVersionHistory({
  open,
  onOpenChange,
  versions,
  currentVersion,
  onRestore,
  onDelete,
  isLoading = false,
}: TemplateVersionHistoryProps) {
  // Normalize input to avoid runtime errors if a non-array sneaks in
  const safeVersions: VersionHistoryItem[] = Array.isArray(versions) ? versions : [];
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRestore = async (versionNumber: number) => {
    setRestoring(true);
    try {
      await onRestore(versionNumber);
      setSelectedVersion(null);
    } catch (error) {
      console.error('Failed to restore version:', error);
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async (versionNumber: number) => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(versionNumber);
      setSelectedVersion(null);
    } catch (error) {
      console.error('Failed to delete version:', error);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            История версий
          </DialogTitle>
          <DialogDescription>
            Просмотр и восстановление сохранённых версий шаблона
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : safeVersions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>История версий пока пуста</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {safeVersions.map((version) => (
              <div
                key={version.versionNumber}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  selectedVersion === version.versionNumber
                    ? 'bg-primary/10 border-primary'
                    : 'bg-card border-border hover:bg-muted'
                }`}
                onClick={() => setSelectedVersion(version.versionNumber)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{version.name}</h4>
                      {version.isAutosave && (
                        <Badge variant="secondary" className="text-xs">
                          Автосохр.
                        </Badge>
                      )}
                      {currentVersion === version.versionNumber && (
                        <Badge variant="default" className="text-xs flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Текущая
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      v{version.versionNumber} • {formatDate(version.createdAt)}
                    </p>
                    {version.changeSummary && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {version.changeSummary}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {version.createdBy}
                    </p>
                  </div>

                  {selectedVersion === version.versionNumber && (
                    <div className="flex gap-2">
                      {currentVersion !== version.versionNumber && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(version.versionNumber);
                          }}
                          disabled={restoring}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          {restoring ? 'Восстановление...' : 'Восстановить'}
                        </Button>
                      )}
                      {onDelete && currentVersion !== version.versionNumber && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Удалить эту версию? Это не может быть отменено.')) {
                              handleDelete(version.versionNumber);
                            }
                          }}
                          disabled={deleting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
