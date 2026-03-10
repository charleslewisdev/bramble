import SunCalc from "suncalc";

export interface SunInfo {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  goldenHourStart: Date;
  goldenHourEnd: Date;
  dayLengthMinutes: number;
  dayLengthFormatted: string;
  sunPosition: {
    azimuth: number;
    altitude: number;
  };
}

export function getSunInfo(
  lat: number,
  lng: number,
  date: Date = new Date(),
): SunInfo {
  const times = SunCalc.getTimes(date, lat, lng);
  const position = SunCalc.getPosition(date, lat, lng);

  const dayLengthMs = times.sunset.getTime() - times.sunrise.getTime();
  const dayLengthMinutes = Math.round(dayLengthMs / 60000);
  const hours = Math.floor(dayLengthMinutes / 60);
  const minutes = dayLengthMinutes % 60;

  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    solarNoon: times.solarNoon,
    goldenHourStart: times.goldenHour,
    goldenHourEnd: times.goldenHourEnd,
    dayLengthMinutes,
    dayLengthFormatted: `${hours}h ${minutes}m`,
    sunPosition: {
      azimuth: (position.azimuth * 180) / Math.PI + 180, // Convert to degrees, 0 = North
      altitude: (position.altitude * 180) / Math.PI, // Convert to degrees
    },
  };
}

export function getDayLength(
  lat: number,
  lng: number,
  date: Date = new Date(),
): { minutes: number; formatted: string } {
  const info = getSunInfo(lat, lng, date);
  return {
    minutes: info.dayLengthMinutes,
    formatted: info.dayLengthFormatted,
  };
}
