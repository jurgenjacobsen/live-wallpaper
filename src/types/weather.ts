export interface WeatherCurrentRow {
  tempC: number;
  condition: string;
  description: string;
  iconUrl: string;
  humidity: number;
  windKph: number;
}

export interface WeatherDayColumn {
  dateKey: string;
  dateLabel: string;
  minC: number;
  maxC: number;
  condition: string;
  description: string;
  iconUrl: string;
}

export interface WeatherForecastPayload {
  city: string;
  updatedAt: string;
  current: WeatherCurrentRow;
  days: WeatherDayColumn[];
}
