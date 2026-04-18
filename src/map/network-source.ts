import type { RangeResponse, Source } from 'pmtiles';
import { pluginFetch } from './plugin-fetch';

/**
 * PMTiles Source backed by `api.network.fetch`. Each getBytes call turns
 * into one main-process HTTPS Range request, so the usual renderer CORS
 * limitations don't apply. Designed for the Protomaps daily planet file
 * (no CORS headers on build.protomaps.com).
 */
export class NetworkSource implements Source {
  constructor(public readonly url: string) {}

  getKey(): string {
    return this.url;
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    if (length <= 0) {
      return { data: new ArrayBuffer(0) };
    }
    const end = offset + length - 1;
    const headers: Record<string, string> = { Range: `bytes=${offset}-${end}` };
    if (etag) headers['If-Match'] = etag;

    if (signal?.aborted) {
      throw signal.reason ?? new Error('Aborted');
    }

    const response = await pluginFetch(this.url, {
      method: 'GET',
      headers,
    });

    if (response.status === 416) {
      throw new Error(
        `PMTiles range ${offset}-${end} out of bounds (${this.url})`,
      );
    }
    if (response.status !== 200 && response.status !== 206) {
      throw new Error(
        `PMTiles range read failed: ${response.status} ${response.statusText} (${this.url})`,
      );
    }

    return {
      data: response.body,
      etag: response.headers['etag'],
      expires: response.headers['expires'],
      cacheControl: response.headers['cache-control'],
    };
  }
}
