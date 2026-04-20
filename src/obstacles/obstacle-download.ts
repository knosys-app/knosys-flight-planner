// Downloads the FAA DOF-derived obstacles.sqlite from the plugin's GitHub
// raw CDN into OPFS. Called only when the user explicitly opts in via
// Settings → Avoid obstacles.

import { OBSTACLES_DB_URL, OPFS_OBSTACLES_DB } from '../constants';
import { deleteFile, fileSize, readFileBytes, writeStream } from '../data/opfs';

const OBSTACLES_DB_PATH = [OPFS_OBSTACLES_DB];

export async function isObstaclesDbInstalled(): Promise<boolean> {
  const size = await fileSize(OBSTACLES_DB_PATH);
  return size !== null && size > 0;
}

export async function getObstaclesDbSize(): Promise<number | null> {
  return fileSize(OBSTACLES_DB_PATH);
}

export async function loadObstaclesDb(): Promise<Uint8Array | null> {
  return readFileBytes(OBSTACLES_DB_PATH);
}

export async function deleteObstaclesDb(): Promise<void> {
  await deleteFile(OBSTACLES_DB_PATH);
}

export interface ObstacleDownloadProgress {
  loaded: number;
  total: number | null;
}

export async function downloadObstaclesDb(
  onProgress?: (p: ObstacleDownloadProgress) => void,
  url = OBSTACLES_DB_URL,
): Promise<void> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download obstacles DB: ${res.status} ${res.statusText}`);
  }
  const totalHeader = res.headers.get('content-length');
  const total = totalHeader ? Number.parseInt(totalHeader, 10) : null;
  await writeStream(OBSTACLES_DB_PATH, res.body, (loaded) => {
    onProgress?.({ loaded, total });
  });
}
