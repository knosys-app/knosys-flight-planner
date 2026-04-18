import maplibregl from 'maplibre-gl';
import workerSource from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?raw';

let registered = false;

/**
 * MapLibre spawns a Web Worker from a separate JS URL. Under the plugin
 * sandbox (`new Function()` execution, no module path resolution) there is
 * no usable worker URL. Build a Blob URL from the inlined worker source
 * and point MapLibre at it. CSP `worker-src 'self' blob:` permits this.
 */
export function ensureMaplibreWorker(): void {
  if (registered) return;
  const blob = new Blob([workerSource], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  maplibregl.setWorkerUrl(url);
  registered = true;
}
