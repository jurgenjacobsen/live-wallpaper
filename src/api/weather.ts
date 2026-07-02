import type { WeatherForecastPayload, AviationWeatherData } from "../types/weather";

const WEATHER_REQUEST_TIMEOUT_MS = 15000;

export async function fetchWeatherForecast(): Promise<WeatherForecastPayload> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), WEATHER_REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("/api/weather-forecast", {
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Weather request timed out");
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(`Weather API error ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as WeatherForecastPayload;
}

export async function fetchAviationWeather(airports?: string): Promise<AviationWeatherData[]> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), WEATHER_REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    const url = airports ? `/api/aviation-weather?ids=${encodeURIComponent(airports)}` : "/api/aviation-weather";
    res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Aviation weather request timed out");
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(`Aviation weather API error ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as AviationWeatherData[];
}
