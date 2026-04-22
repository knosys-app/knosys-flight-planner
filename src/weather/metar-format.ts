// Pure, testable formatters for MetarObservation fields → human strings.

import type { CloudLayer, MetarObservation } from './types';

export function fmtWind(m: MetarObservation): string {
  if (m.windSpeedKt == null && m.windDirDeg == null) return '—';
  if (m.windSpeedKt === 0) return 'Calm';
  const dir = m.windDirDeg == null ? 'VRB' : String(m.windDirDeg).padStart(3, '0');
  const speed = m.windSpeedKt == null ? '?' : `${m.windSpeedKt}`;
  const gust = m.windGustKt != null ? ` G${m.windGustKt}` : '';
  return `${dir}° @ ${speed} kt${gust}`;
}

export function fmtVisibility(m: MetarObservation): string {
  if (m.visibilitySm == null) return '—';
  if (m.visibilitySm === Number.POSITIVE_INFINITY) return '10+ sm';
  return `${m.visibilitySm} sm`;
}

export function fmtAltimeter(m: MetarObservation): string {
  if (m.altimeterInHg == null) return '—';
  return `${m.altimeterInHg.toFixed(2)} inHg`;
}

export function fmtTempDew(m: MetarObservation): string {
  const t = m.tempC == null ? '—' : `${Math.round(m.tempC)}°C`;
  const d = m.dewpointC == null ? '—' : `${Math.round(m.dewpointC)}°C`;
  return `${t} / ${d}`;
}

export function fmtCloudLayer(c: CloudLayer): string {
  if (c.coverage === 'SKC' || c.coverage === 'CLR') return 'Sky clear';
  const base = c.baseFtAgl != null ? `${c.baseFtAgl.toLocaleString()} ft` : '—';
  return `${c.coverage} @ ${base}`;
}

export function fmtClouds(m: MetarObservation): string {
  if (m.clouds.length === 0) return 'Sky clear';
  const clear = m.clouds.find((c) => c.coverage === 'SKC' || c.coverage === 'CLR');
  if (clear) return 'Sky clear';
  return m.clouds.map(fmtCloudLayer).join(' · ');
}

export function fmtAgeLabel(isoish: string | undefined, now = Date.now()): string {
  if (!isoish) return '—';
  const t = new Date(isoish).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export function fmtZulu(isoish: string | undefined): string {
  if (!isoish) return '—';
  const d = new Date(isoish);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}${hh}${mm}Z`;
}
