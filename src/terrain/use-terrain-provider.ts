import { TerrariumTerrainProvider } from './terrarium-provider';
import type { TerrainProvider } from './terrain-provider';

let singleton: TerrainProvider | null = null;

export function getTerrainProvider(): TerrainProvider {
  if (!singleton) {
    singleton = new TerrariumTerrainProvider();
  }
  return singleton;
}

export function resetTerrainProvider(): void {
  singleton = null;
}
