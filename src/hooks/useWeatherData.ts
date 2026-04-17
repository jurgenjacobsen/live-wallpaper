import { useEffect, useState } from "react";
import { fetchWeatherForecast } from "../api/weather";
import type { WeatherForecastPayload } from "../types/weather";

interface UseWeatherDataResult {
  weather: WeatherForecastPayload | null;
  loading: boolean;
  error: string | null;
}

export function useWeatherData(): UseWeatherDataResult {
  const [weather, setWeather] = useState<WeatherForecastPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchWeatherForecast();
        if (!cancelled) {
          setWeather(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { weather, loading, error };
}
