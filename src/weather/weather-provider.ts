export interface WeatherWinds {
  dirTrueDeg: number;
  speedKt: number;
  tempC?: number;
}

export interface WeatherProvider {
  id: string;
  name: string;
  getWinds(lat: number, lon: number, altFt: number, timeUtc: Date): Promise<WeatherWinds>;
}
