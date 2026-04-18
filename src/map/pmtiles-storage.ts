import { deleteFile, fileSize, getFile, writeStream } from '../data/opfs';
import { OPFS_REGIONS_DIR } from '../constants';

const regionPath = (id: string): string[] => [OPFS_REGIONS_DIR, `${id}.pmtiles`];

export async function regionFile(id: string): Promise<File | null> {
  return getFile(regionPath(id));
}

export async function regionSize(id: string): Promise<number | null> {
  return fileSize(regionPath(id));
}

export async function deleteRegion(id: string): Promise<void> {
  await deleteFile(regionPath(id));
}

export interface RegionDownloadProgress {
  loaded: number;
  total: number | null;
}

export async function downloadRegion(
  id: string,
  url: string,
  onProgress?: (p: RegionDownloadProgress) => void,
): Promise<{ sizeBytes: number }> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to fetch region ${id}: ${res.status} ${res.statusText}`);
  }
  const totalHeader = res.headers.get('content-length');
  const total = totalHeader ? Number.parseInt(totalHeader, 10) : null;
  const bytesWritten = await writeStream(regionPath(id), res.body, (loaded) => {
    onProgress?.({ loaded, total });
  });
  return { sizeBytes: bytesWritten };
}
