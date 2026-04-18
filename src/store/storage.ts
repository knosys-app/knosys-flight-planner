import type { PluginAPI, PluginStorageAPI } from '../types';

// Module-level reference to the host's plugin-scoped key-value store.
// Set once during `activate()` via initStore() and used by every store helper.
let storage: PluginStorageAPI | null = null;
let api: PluginAPI | null = null;

export function initStore(pluginApi: PluginAPI): void {
  api = pluginApi;
  storage = pluginApi.storage;
}

export function getApi(): PluginAPI {
  if (!api) throw new Error('FlightPlanner: api not initialized. Did activate() run?');
  return api;
}

export function getStorage(): PluginStorageAPI {
  if (!storage) throw new Error('FlightPlanner: storage not initialized.');
  return storage;
}

export async function getValue<T>(key: string): Promise<T | null> {
  return getStorage().get<T>(key);
}

export async function setValue<T>(key: string, value: T): Promise<void> {
  return getStorage().set<T>(key, value);
}

export async function deleteValue(key: string): Promise<void> {
  return getStorage().delete(key);
}
