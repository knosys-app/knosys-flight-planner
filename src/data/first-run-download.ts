import { AIRPORTS_DB_URL, OPFS_AIRPORTS_DB } from '../constants';
import { deleteFile, fileSize, readFileBytes, writeStream } from './opfs';

const AIRPORTS_DB_PATH = [OPFS_AIRPORTS_DB];

export async function isAirportsDbInstalled(): Promise<boolean> {
  const size = await fileSize(AIRPORTS_DB_PATH);
  return size !== null && size > 0;
}

export async function getAirportsDbSize(): Promise<number | null> {
  return fileSize(AIRPORTS_DB_PATH);
}

export async function loadAirportsDb(): Promise<Uint8Array | null> {
  return readFileBytes(AIRPORTS_DB_PATH);
}

export async function deleteAirportsDb(): Promise<void> {
  await deleteFile(AIRPORTS_DB_PATH);
}

export interface DownloadProgress {
  loaded: number;
  total: number | null;
}

export async function downloadAirportsDb(
  onProgress?: (p: DownloadProgress) => void,
  url = AIRPORTS_DB_URL,
): Promise<void> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download airports DB: ${res.status} ${res.statusText}`);
  }
  const totalHeader = res.headers.get('content-length');
  const total = totalHeader ? Number.parseInt(totalHeader, 10) : null;
  await writeStream(AIRPORTS_DB_PATH, res.body, (loaded) => {
    onProgress?.({ loaded, total });
  });
}
