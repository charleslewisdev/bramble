interface OpenMeteoCurrentWeather {
  temperature_2m: number;
  relative_humidity_2m: number;
  precipitation: number;
  wind_speed_10m: number;
  weather_code: number;
  uv_index: number;
  wind_gusts_10m: number;
}

interface OpenMeteoDailyWeather {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  weather_code: number[];
  uv_index_max: number[];
  precipitation_probability_max: number[];
}

interface OpenMeteoHourlyWeather {
  soil_temperature_0cm: number[];
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrentWeather;
  daily: OpenMeteoDailyWeather;
  hourly?: OpenMeteoHourlyWeather;
}

export interface WeatherData {
  current: {
    temperature: number;
    humidity: number;
    precipitation: number;
    windSpeed: number;
    weatherCode: number;
    conditions: string;
    uvIndex: number;
    windGust: number;
  };
  daily: {
    temperatureMax: number;
    temperatureMin: number;
    precipitationProbability: number;
    uvIndexMax: number;
  };
  soilTemperature: number | null;
  forecast: DayForecast[];
}

export interface DayForecast {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  weatherCode: number;
  conditions: string;
  uvIndexMax: number;
  precipitationProbabilityMax: number;
}

const WEATHER_CODE_MAP: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export function weatherCodeToCondition(code: number): string {
  return WEATHER_CODE_MAP[code] ?? "Unknown";
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current:
      "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code,uv_index,wind_gusts_10m",
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,uv_index_max,precipitation_probability_max",
    hourly: "soil_temperature_0cm",
    forecast_hours: "1",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!response.ok) {
    throw new Error(
      `Open-Meteo API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as OpenMeteoResponse;

  const forecast: DayForecast[] = data.daily.time.map((date, i) => {
    const weatherCode = data.daily.weather_code[i] ?? 0;
    return {
      date,
      temperatureMax: data.daily.temperature_2m_max[i] ?? 0,
      temperatureMin: data.daily.temperature_2m_min[i] ?? 0,
      precipitationSum: data.daily.precipitation_sum[i] ?? 0,
      weatherCode,
      conditions: weatherCodeToCondition(weatherCode),
      uvIndexMax: data.daily.uv_index_max[i] ?? 0,
      precipitationProbabilityMax: data.daily.precipitation_probability_max[i] ?? 0,
    };
  });

  const soilTemp = data.hourly?.soil_temperature_0cm?.[0] ?? null;

  return {
    current: {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      precipitation: data.current.precipitation,
      windSpeed: data.current.wind_speed_10m,
      weatherCode: data.current.weather_code,
      conditions: weatherCodeToCondition(data.current.weather_code),
      uvIndex: data.current.uv_index,
      windGust: data.current.wind_gusts_10m,
    },
    daily: {
      temperatureMax: data.daily.temperature_2m_max[0] ?? 0,
      temperatureMin: data.daily.temperature_2m_min[0] ?? 0,
      precipitationProbability: data.daily.precipitation_probability_max[0] ?? 0,
      uvIndexMax: data.daily.uv_index_max[0] ?? 0,
    },
    soilTemperature: soilTemp,
    forecast,
  };
}
