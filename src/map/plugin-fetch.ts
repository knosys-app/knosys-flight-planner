import { getApi } from '../store/storage';
import type { PluginNetworkFetchInit, PluginNetworkFetchResponse } from '../types';

/**
 * Thin wrapper around `api.network.fetch`. Runs HTTPS requests through the
 * Electron main process, so the usual renderer CORS enforcement doesn't
 * apply. Used for PMTiles range reads against Protomaps.
 *
 * Throws if:
 *  - the host didn't expose api.network (older Knosys version)
 *  - the plugin didn't declare the `network` permission
 *  - the response is not 2xx
 */
export async function pluginFetch(
  url: string,
  init?: PluginNetworkFetchInit,
): Promise<PluginNetworkFetchResponse> {
  const api = getApi();
  if (!api.network?.fetch) {
    throw new Error(
      'Offline maps require Knosys with api.network.fetch. Please update Knosys.',
    );
  }
  const res = await api.network.fetch(url, init);
  return res;
}

/**
 * Convenience helper: issue a byte-range GET and unwrap to the ArrayBuffer.
 * Throws on non-2xx/3xx unless the caller handled it via `allowStatus`.
 */
export async function pluginFetchRange(
  url: string,
  startByte: number,
  endByteInclusive: number,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<ArrayBuffer> {
  const res = await pluginFetch(url, {
    method: 'GET',
    headers: { Range: `bytes=${startByte}-${endByteInclusive}` },
    timeoutMs: options.timeoutMs,
  });
  if (res.status !== 206 && res.status !== 200) {
    throw new Error(`Range read failed (${res.status}): ${url}`);
  }
  return res.body;
}

export async function pluginHead(url: string): Promise<PluginNetworkFetchResponse> {
  return pluginFetch(url, { method: 'HEAD' });
}
