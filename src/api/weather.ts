import type { WeatherForecastPayload } from "../types/weather";

export async function fetchWeatherForecast(): Promise<WeatherForecastPayload> {
  const res = await fetch("/api/weather-forecast", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Weather API error ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as WeatherForecastPayload;
}
