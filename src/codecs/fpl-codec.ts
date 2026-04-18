import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { v4 as uuid } from 'uuid';
import type { PlanFormatCodec } from './plan-format';
import type { Plan, Waypoint, WaypointKind } from '../types';
import { M_PER_FT } from '../math/units';

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: false,
});

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
});

function waypointFplType(kind: WaypointKind, ref: string): string {
  if (kind === 'airport') return 'AIRPORT';
  if (kind === 'navaid') {
    if (ref.length <= 3) return 'NDB';
    return 'VOR';
  }
  return 'USER WAYPOINT';
}

function buildFpl(plan: Plan, xmlns: string): string {
  const waypointRows = plan.waypoints.map((wp) => ({
    identifier: wp.ref,
    type: waypointFplType(wp.kind, wp.ref),
    'country-code': 'US',
    lat: wp.lat,
    lon: wp.lon,
    comment: wp.name,
    elevation: wp.altFt !== undefined ? wp.altFt * M_PER_FT : 0,
  }));

  const routePoints = plan.waypoints.map((wp) => ({
    'waypoint-identifier': wp.ref,
    'waypoint-type': waypointFplType(wp.kind, wp.ref),
    'waypoint-country-code': 'US',
  }));

  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    'flight-plan': {
      '@_xmlns': xmlns,
      'file-description': plan.name,
      author: { 'author-name': 'Knosys Flight Planner' },
      'flight-plan-index': 1,
      'waypoint-table': { waypoint: waypointRows },
      route: {
        'route-name': plan.name,
        'flight-plan-index': 1,
        'route-point': routePoints,
      },
    },
  };
  return builder.build(doc);
}

function parseFpl(data: string): Plan {
  const parsed: any = parser.parse(data);
  const fp = parsed['flight-plan'] ?? {};
  const wpRaw = fp['waypoint-table']?.waypoint ?? [];
  const wpArr = Array.isArray(wpRaw) ? wpRaw : [wpRaw];

  const waypoints: Waypoint[] = wpArr.map((w: any) => {
    const elevationM = w.elevation !== undefined ? Number(w.elevation) : 0;
    const type = String(w.type ?? '').toUpperCase();
    const kind: WaypointKind =
      type === 'AIRPORT' ? 'airport' : type === 'USER WAYPOINT' ? 'userPoint' : 'navaid';
    return {
      id: uuid(),
      kind,
      ref: String(w.identifier ?? 'WP'),
      name: String(w.comment ?? w.identifier ?? 'Waypoint'),
      lat: Number(w.lat),
      lon: Number(w.lon),
      altFt: elevationM ? Math.round(elevationM / M_PER_FT) : undefined,
    };
  });

  const legs = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    legs.push({
      fromId: waypoints[i].id,
      toId: waypoints[i + 1].id,
      altFt: waypoints[i + 1].altFt ?? 5500,
    });
  }

  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: uuid(),
    name: String(fp['file-description'] ?? fp.route?.['route-name'] ?? 'Imported Plan'),
    createdAt: now,
    updatedAt: now,
    departureIcao: waypoints[0]?.ref ?? '',
    destinationIcao: waypoints[waypoints.length - 1]?.ref ?? '',
    waypoints,
    legs,
    aircraftProfileId: '',
  };
}

export const FplGarminFormat: PlanFormatCodec = {
  id: 'fpl-garmin',
  name: 'Garmin FPL',
  extension: '.fpl',
  mime: 'application/xml',
  write: (plan) => buildFpl(plan, 'http://www8.garmin.com/xmlschemas/FlightPlan/v1'),
  read: parseFpl,
};

export const FplForeFlightFormat: PlanFormatCodec = {
  id: 'fpl-foreflight',
  name: 'ForeFlight FPL',
  extension: '.fpl',
  mime: 'application/xml',
  write: (plan) => buildFpl(plan, 'http://www.foreflight.com/flightplan/1.0'),
  read: parseFpl,
};
