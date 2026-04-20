import { FaaDofObstacleProvider } from './faa-dof-provider';
import { isObstaclesDbInstalled, loadObstaclesDb } from './obstacle-download';
import type { ObstacleProvider } from './obstacle-provider';

let singleton: ObstacleProvider | null = null;

export function getObstacleProvider(): ObstacleProvider {
  if (!singleton) {
    singleton = new FaaDofObstacleProvider(async () => {
      const bytes = await loadObstaclesDb();
      if (!bytes) throw new Error('obstacles.sqlite not installed in OPFS');
      return bytes;
    });
  }
  return singleton;
}

export function resetObstacleProvider(): void {
  singleton = null;
}

export { isObstaclesDbInstalled };
