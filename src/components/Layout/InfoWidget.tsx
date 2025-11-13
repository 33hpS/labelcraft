import { useState, useEffect } from 'react';
import { Cloud, DollarSign, Clock } from 'lucide-react';

interface InfoWidgetProps {
  variant?: 'desktop' | 'mobile';
}

/**
 * Компактный виджет с временем, погодой и курсами валют
 */
export default function InfoWidget({ variant = 'desktop' }: InfoWidgetProps) {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: number; desc: string } | null>(null);
  const [rates, setRates] = useState<{ usd: number; eur: number; rub: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Обновление времени каждую секунду
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Загрузка погоды для Бишкека
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // OpenWeatherMap API
        const apiKey = 'b18e470ac2546ff8f412454b312e053b';
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=Bishkek&units=metric&appid=${apiKey}&lang=ru`
        );
        
        if (response.ok) {
          const data = await response.json();
          setWeather({
            temp: Math.round(data.main.temp),
            desc: data.weather[0].description,
          });
        }
      } catch (error) {
        console.error('Weather fetch error:', error);
        // Фоллбэк данные
        setWeather({ temp: 15, desc: 'ясно' });
      }
    };

    fetchWeather();
    // Обновлять каждые 30 минут
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Загрузка курсов валют для KGS
  useEffect(() => {
    const fetchRates = async () => {
      try {
        // НБКР API или exchangerate-api.com
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/KGS');
        
        if (response.ok) {
          const data = await response.json();
          setRates({
            usd: Math.round(1 / data.rates.USD * 100) / 100,
            eur: Math.round(1 / data.rates.EUR * 100) / 100,
            rub: Math.round(1 / data.rates.RUB * 100) / 100,
          });
        }
      } catch (error) {
        console.error('Rates fetch error:', error);
        // Фоллбэк данные
        setRates({ usd: 87.5, eur: 95.2, rub: 0.95 });
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
    // Обновлять каждый час
    const interval = setInterval(fetchRates, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short'
    });
  };

  if (loading) {
    if (variant === 'mobile') {
      return (
        <div className="flex lg:hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <Clock size={14} />
          <span>Загрузка...</span>
        </div>
      );
    }

    return (
      <div className="hidden lg:flex items-center space-x-2 text-xs text-muted-foreground">
        <Clock size={14} />
        <span>Загрузка...</span>
      </div>
    );
  }

  if (variant === 'mobile') {
    return (
      <div className="flex lg:hidden flex-col gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-primary" />
            <span className="font-semibold font-mono">{formatTime(time)}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{formatDate(time)}</span>
        </div>

        {weather && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud size={14} className="text-primary" />
              <span className="font-semibold">{weather.temp}°C</span>
            </div>
            <span className="text-[10px] text-muted-foreground capitalize truncate max-w-[120px]">{weather.desc}</span>
          </div>
        )}

        {rates && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 font-mono">
              <DollarSign size={14} className="text-primary" />
              <span className="font-semibold text-[11px]">USD {rates.usd}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
              <span>EUR {rates.eur}</span>
              <span>RUB {rates.rub}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="hidden lg:flex items-center space-x-3 text-xs">
      {/* Время */}
      <div className="flex items-center space-x-1 text-foreground">
        <Clock size={14} className="text-primary flex-shrink-0" />
        <div className="flex flex-col leading-tight">
          <span className="font-semibold font-mono w-16">{formatTime(time)}</span>
          <span className="text-[10px] text-muted-foreground w-16">{formatDate(time)}</span>
        </div>
      </div>

      <div className="h-8 w-px bg-border" />

      {/* Погода Бишкек */}
      {weather && (
        <div className="flex items-center space-x-1 text-foreground">
          <Cloud size={14} className="text-primary flex-shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold w-12">{weather.temp}°C</span>
            <span className="text-[10px] text-muted-foreground capitalize w-12 truncate">{weather.desc}</span>
          </div>
        </div>
      )}

      <div className="h-8 w-px bg-border" />

      {/* Курсы валют */}
      {rates && (
        <div className="flex items-center space-x-1 text-foreground">
          <DollarSign size={14} className="text-primary flex-shrink-0" />
          <div className="flex flex-col leading-tight">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-[10px] font-mono">USD {rates.usd}</span>
              <span className="font-semibold text-[10px] font-mono">EUR {rates.eur}</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">RUB {rates.rub}</span>
          </div>
        </div>
      )}
    </div>
  );
}
