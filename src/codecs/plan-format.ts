import type { AircraftProfile, NavlogRow, Plan } from '../types';

export type PlanFormatId = 'gpx' | 'fpl-garmin' | 'fpl-foreflight' | 'csv';

export interface PlanFormatCodec {
  id: PlanFormatId;
  name: string;
  extension: string;
  mime: string;
  write(plan: Plan, aircraft: AircraftProfile, navlog: NavlogRow[]): string;
  read?(data: string): Plan;
}
