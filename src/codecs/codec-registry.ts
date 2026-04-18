import type { PlanFormatCodec, PlanFormatId } from './plan-format';
import { GpxFormat } from './gpx-codec';
import { FplGarminFormat, FplForeFlightFormat } from './fpl-codec';
import { CsvFormat } from './csv-codec';

const builtins: PlanFormatCodec[] = [GpxFormat, FplGarminFormat, FplForeFlightFormat, CsvFormat];

const registry = new Map<PlanFormatId, PlanFormatCodec>();
for (const codec of builtins) registry.set(codec.id, codec);

export function listCodecs(): PlanFormatCodec[] {
  return [...registry.values()];
}

export function getCodec(id: PlanFormatId): PlanFormatCodec | undefined {
  return registry.get(id);
}

export function registerCodec(codec: PlanFormatCodec): void {
  registry.set(codec.id, codec);
}
