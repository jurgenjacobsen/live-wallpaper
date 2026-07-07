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

export interface AviationWeatherData {
  icaoId: string;
  receiptTime?: string;
  obsTime?: number;
  reportTime?: string;
  temp?: number;
  dewp?: number;
  wdir?: number;
  wspd?: number;
  wgst?: number;
  visib?: string;
  altim?: number;
  metarType?: string;
  rawOb?: string;
  lat?: number;
  lon?: number;
  elev?: number;
  name?: string;
  cover?: string;
  fltCat?: string;
  rawTaf?: string;
}
