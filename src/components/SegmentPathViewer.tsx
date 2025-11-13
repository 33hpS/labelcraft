import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { ListChecks, RefreshCw } from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  sequence_order: number;
  color?: string;
}

export function SegmentPathViewer() {
  const [segment, setSegment] = useState<string | undefined>(undefined);
  const [workshop, setWorkshop] = useState<string | undefined>(undefined);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPath = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: segment || undefined,
          workshop: workshop ? Number(workshop) : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStages(data.path || []);
      } else {
        setStages([]);
      }
    } catch (e) {
      setStages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPath();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5"/>Маршрут производства</CardTitle>
          <CardDescription>Выберите сегмент/цех для просмотра последовательности этапов</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={loadPath} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          <Select onValueChange={setSegment} value={segment}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Сегмент"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="lux">Люкс</SelectItem>
              <SelectItem value="econom">Эконом</SelectItem>
              <SelectItem value="">Все</SelectItem>
            </SelectContent>
          </Select>

          <Select onValueChange={setWorkshop} value={workshop}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Цех"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 цех</SelectItem>
              <SelectItem value="2">2 цех</SelectItem>
              <SelectItem value="">Все</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={loadPath} disabled={loading}>Показать</Button>
        </div>

        {stages.length === 0 ? (
          <div className="text-sm text-muted-foreground">Нет этапов для выбранных фильтров</div>
        ) : (
          <ol className="list-decimal pl-6 space-y-1">
            {stages.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <div className="w-6 text-muted-foreground">{s.sequence_order}</div>
                <div className="font-medium">{s.name}</div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
