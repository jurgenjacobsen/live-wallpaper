import { useEffect, useState } from "react";
import { fetchWeatherForecast, fetchAviationWeather } from "../api/weather";
import type { WeatherForecastPayload, AviationWeatherData } from "../types/weather";

interface UseWeatherDataResult {
  weather: WeatherForecastPayload | null;
  aviationWeather: AviationWeatherData[] | null;
  loading: boolean;
  error: string | null;
  aviationError: string | null;
}

export function useWeatherData(config?: { enableMetar?: boolean; enableTaf?: boolean; airports?: string }): UseWeatherDataResult {
  const [weather, setWeather] = useState<WeatherForecastPayload | null>(null);
  const [aviationWeather, setAviationWeather] = useState<AviationWeatherData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviationError, setAviationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setAviationError(null);

      try {
        const fetchWeatherPromise = fetchWeatherForecast();

        const shouldFetchAviation = (config?.enableMetar || config?.enableTaf) && config?.airports;
        const fetchAviationPromise = shouldFetchAviation
          ? fetchAviationWeather(config.airports).catch((err) => {
              console.error("Aviation weather load failed:", err);
              if (!cancelled) {
                setAviationError(err instanceof Error ? err.message : String(err));
              }
              return null;
            })
          : Promise.resolve(null);

        const [weatherData, aviationData] = await Promise.all([
          fetchWeatherPromise,
          fetchAviationPromise,
        ]);

        if (!cancelled) {
          setWeather(weatherData);
          setAviationWeather(aviationData);
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
  }, [config?.enableMetar, config?.enableTaf, config?.airports]);

  return { weather, aviationWeather, loading, error, aviationError };
}
