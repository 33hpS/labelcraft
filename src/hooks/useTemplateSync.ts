import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from '@/lib/api';

export interface SyncConfig {
  templateId: string;
  userId: string;
  deviceId?: string;
  autoSaveInterval?: number;
  enableRealTime?: boolean;
}

export interface SyncState {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  needsSync: boolean;
  hasConflict: boolean;
  conflictMessage?: string;
}

export interface VersionInfo {
  versionNumber: number;
  name: string;
  createdAt: string;
  createdBy: string;
  changeSummary?: string;
  isAutosave: boolean;
}

export function useTemplateSync(config: SyncConfig) {
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncTime: null,
    syncError: null,
    needsSync: false,
    hasConflict: false,
  });

  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const deviceIdRef = useRef<string>(config.deviceId || `device-${Math.random().toString(36).substr(2, 9)}`);

  // Загрузить историю версий
  const loadVersions = useCallback(async () => {
    try {
      const response = await api.getTemplateVersions(config.templateId, 50);
      const versionList = response.versions || [];
      setVersions(versionList.map((v: any) => ({
        versionNumber: v.version_number,
        name: v.name,
        createdAt: v.created_at,
        createdBy: v.created_by,
        changeSummary: v.change_summary,
        isAutosave: v.is_autosave === 1,
      })));
    } catch (error) {
      console.error('Failed to load versions:', error);
      setSyncState(prev => ({
        ...prev,
        syncError: 'Failed to load version history'
      }));
    }
  }, [config.templateId]);

  // Сохранить версию
  const saveVersion = useCallback(
    async (elements: any[], settings: any, name?: string, isAutosave = false) => {
      setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));

      try {
        const response = await api.saveTemplateVersion(config.templateId, {
          name: name || `Version ${new Date().toLocaleTimeString()}`,
          description: isAutosave ? 'Auto-saved' : 'Manual save',
          elements,
          settings,
          createdBy: config.userId,
          isAutosave,
          changeSummary: isAutosave ? 'Auto-save' : 'User save',
        });

        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncTime: new Date(),
          needsSync: false,
        }));

        // Обновить список версий
        await loadVersions();

        return response;
      } catch (error) {
        console.error('Failed to save version:', error);
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          syncError: error instanceof Error ? error.message : 'Save failed',
        }));
        throw error;
      }
    },
    [config.templateId, config.userId, loadVersions]
  );

  // Восстановить из версии
  const restoreVersion = useCallback(
    async (versionNumber: number) => {
      setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));

      try {
        const response = await api.restoreTemplateVersion(
          config.templateId,
          versionNumber,
          config.userId
        );

        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncTime: new Date(),
        }));

        await loadVersions();

        return response;
      } catch (error) {
        console.error('Failed to restore version:', error);
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          syncError: error instanceof Error ? error.message : 'Restore failed',
        }));
        throw error;
      }
    },
    [config.templateId, config.userId, loadVersions]
  );

  // Синхронизировать с сервером
  const syncTemplate = useCallback(
    async (elements: any[], settings: any, currentVersion: number) => {
      setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));

      try {
        const response = await api.syncTemplate(config.templateId, {
          userId: config.userId,
          deviceId: deviceIdRef.current,
          elements,
          settings,
          currentVersion,
        });

        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncTime: new Date(),
          needsSync: false,
          hasConflict: response.conflictDetected || false,
          conflictMessage: response.conflictDetected
            ? 'Conflict detected. Server version is newer. Please review and save.'
            : undefined,
        }));

        return response;
      } catch (error) {
        console.error('Sync failed:', error);
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          syncError: error instanceof Error ? error.message : 'Sync failed',
        }));
        throw error;
      }
    },
    [config.templateId, config.userId]
  );

  // Получить состояние синхронизации
  const getSyncState = useCallback(async () => {
    try {
      const state = await api.getSyncState(
        config.templateId,
        config.userId,
        deviceIdRef.current
      );
      return state;
    } catch (error) {
      console.error('Failed to get sync state:', error);
      return null;
    }
  }, [config.templateId, config.userId]);

  // Получить последние изменения (для polling real-time)
  const getLatestChanges = useCallback(async () => {
    try {
      const response = await api.getLatestChanges(config.templateId);
      return response.changes || [];
    } catch (error) {
      console.error('Failed to get latest changes:', error);
      return [];
    }
  }, [config.templateId]);

  // Уведомить об изменении
  const notifyChange = useCallback(
    async (changeType: string, affectedElementId?: string, oldValue?: any, newValue?: any) => {
      try {
        await api.notifyChange(config.templateId, {
          versionNumber: versions[0]?.versionNumber || 1,
          changeType: changeType as any,
          affectedElementId,
          affectedElementName: affectedElementId || 'Unknown',
          oldValue,
          newValue,
          userId: config.userId,
          userName: config.userId,
          deviceId: deviceIdRef.current,
        });
      } catch (error) {
        console.error('Failed to notify change:', error);
      }
    },
    [config.templateId, config.userId, versions]
  );

  // Автосохранение
  useEffect(() => {
    if (!config.autoSaveInterval) return;

    // Вернуть функцию для отправки данных на автосохранение
    // Должна быть вызвана из компонента
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [config.autoSaveInterval]);

  // Real-time polling
  useEffect(() => {
    if (!config.enableRealTime) return;

    const startPolling = async () => {
      pollTimerRef.current = setInterval(async () => {
        await getLatestChanges();
      }, 2000); // Poll каждые 2 секунды
    };

    startPolling();

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [config.enableRealTime, getLatestChanges]);

  // Загрузить версии при монтировании
  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  return {
    syncState,
    versions,
    saveVersion,
    restoreVersion,
    syncTemplate,
    getSyncState,
    getLatestChanges,
    notifyChange,
    deviceId: deviceIdRef.current,
  };
}
