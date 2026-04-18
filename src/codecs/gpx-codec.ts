import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { v4 as uuid } from 'uuid';
import type { PlanFormatCodec } from './plan-format';
import type { Plan, Waypoint } from '../types';
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

function toGpxWaypoint(wp: Waypoint): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@_lat': wp.lat,
    '@_lon': wp.lon,
    name: wp.ref,
    desc: wp.name,
  };
  if (wp.altFt !== undefined) {
    node.ele = wp.altFt * M_PER_FT;
  }
  return node;
}

export const GpxFormat: PlanFormatCodec = {
  id: 'gpx',
  name: 'GPX',
  extension: '.gpx',
  mime: 'application/gpx+xml',

  write(plan: Plan): string {
    const doc = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      gpx: {
        '@_version': '1.1',
        '@_creator': 'Knosys Flight Planner',
        '@_xmlns': 'http://www.topografix.com/GPX/1/1',
        metadata: {
          name: plan.name,
          time: plan.updatedAt,
        },
        rte: {
          name: plan.name,
          rtept: plan.waypoints.map(toGpxWaypoint),
        },
      },
    };
    return builder.build(doc);
  },

  read(data: string): Plan {
    const parsed: any = parser.parse(data);
    const gpx = parsed.gpx ?? {};
    const rte = gpx.rte ?? {};
    const rteptRaw = rte.rtept ?? [];
    const rteptArr = Array.isArray(rteptRaw) ? rteptRaw : [rteptRaw];

    const waypoints: Waypoint[] = rteptArr.map((pt: any) => {
      const ele = pt.ele !== undefined ? Number(pt.ele) : undefined;
      return {
        id: uuid(),
        kind: 'airport' as const,
        ref: String(pt.name ?? 'WP'),
        name: String(pt.desc ?? pt.name ?? 'Waypoint'),
        lat: Number(pt['@_lat']),
        lon: Number(pt['@_lon']),
        altFt: ele !== undefined ? Math.round(ele / M_PER_FT) : undefined,
      };
    });

    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];
    const now = new Date().toISOString();
    const legs = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      legs.push({
        fromId: waypoints[i].id,
        toId: waypoints[i + 1].id,
        altFt: waypoints[i + 1].altFt ?? 5500,
      });
    }

    const plan: Plan = {
      schemaVersion: 1,
      id: uuid(),
      name: String(gpx.metadata?.name ?? rte.name ?? 'Imported Plan'),
      createdAt: now,
      updatedAt: now,
      departureIcao: first?.ref ?? '',
      destinationIcao: last?.ref ?? '',
      waypoints,
      legs,
      aircraftProfileId: '',
    };
    return plan;
  },
};
