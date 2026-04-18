// OPFS helpers. Everything the plugin persists that is too large for
// `api.storage` (airport DB, PMTiles regions) lives here.

import { OPFS_ROOT_DIR } from '../constants';

async function ensureSubdir(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true });
}

export async function rootDir(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage || !navigator.storage.getDirectory) {
    throw new Error('OPFS is not available in this environment');
  }
  const root = await navigator.storage.getDirectory();
  return ensureSubdir(root, OPFS_ROOT_DIR);
}

export async function resolveFile(
  pathSegments: string[],
  createIfMissing = false,
): Promise<FileSystemFileHandle | null> {
  let dir = await rootDir();
  for (let i = 0; i < pathSegments.length - 1; i++) {
    dir = await dir.getDirectoryHandle(pathSegments[i], { create: createIfMissing });
  }
  const filename = pathSegments[pathSegments.length - 1];
  try {
    return await dir.getFileHandle(filename, { create: createIfMissing });
  } catch (err) {
    if (createIfMissing) throw err;
    return null;
  }
}

export async function readFileBytes(pathSegments: string[]): Promise<Uint8Array | null> {
  const handle = await resolveFile(pathSegments, false);
  if (!handle) return null;
  const file = await handle.getFile();
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function getFile(pathSegments: string[]): Promise<File | null> {
  const handle = await resolveFile(pathSegments, false);
  if (!handle) return null;
  return handle.getFile();
}

export async function fileSize(pathSegments: string[]): Promise<number | null> {
  const file = await getFile(pathSegments);
  return file ? file.size : null;
}

export async function writeStream(
  pathSegments: string[],
  source: ReadableStream<Uint8Array>,
  onProgress?: (bytesWritten: number) => void,
): Promise<number> {
  const handle = await resolveFile(pathSegments, true);
  if (!handle) throw new Error(`Could not create OPFS file: ${pathSegments.join('/')}`);
  const writable = await handle.createWritable();
  const reader = source.getReader();
  let written = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        // Copy into a fresh ArrayBuffer so the OPFS writer gets the tightest
        // possible typing. Some TS libdom versions require ArrayBuffer-backed
        // views explicitly (not SharedArrayBuffer-backed).
        const buf = new Uint8Array(value.byteLength);
        buf.set(value);
        await writable.write(buf as unknown as BufferSource);
        written += buf.byteLength;
        onProgress?.(written);
      }
    }
  } finally {
    await writable.close();
  }
  return written;
}

export async function deleteFile(pathSegments: string[]): Promise<void> {
  let dir = await rootDir();
  for (let i = 0; i < pathSegments.length - 1; i++) {
    dir = await dir.getDirectoryHandle(pathSegments[i], { create: false });
  }
  const filename = pathSegments[pathSegments.length - 1];
  try {
    await dir.removeEntry(filename);
  } catch {
    // already gone
  }
}
