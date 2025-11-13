import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { RefreshCw, Clock } from 'lucide-react';
import { useState } from 'react';

export default function SessionBadge() {
  const { remainingSec, refreshToken } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  if (!remainingSec) return null;

  const handleRefresh = async () => {
    if (!refreshToken) return;
    setRefreshing(true);
    try {
      await refreshToken();
    } finally {
      setRefreshing(false);
    }
  };

  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  let colorClass = 'text-green-600 dark:text-green-400';
  if (remainingSec < 120) colorClass = 'text-red-600 dark:text-red-400';
  else if (remainingSec < 600) colorClass = 'text-yellow-600 dark:text-yellow-400';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1 text-xs font-mono ${colorClass}`}>
        <Clock size={14} />
        <span>{timeStr}</span>
      </div>
      {refreshToken && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Обновить сессию"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </Button>
      )}
    </div>
  );
}
