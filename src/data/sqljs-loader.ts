import initSqlJs, { type SqlJsStatic } from 'sql.js';
import sqlWasmBase64 from 'sql.js/dist/sql-wasm.wasm?b64';

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Loads sql.js using an inline-base64 WASM binary. This avoids any network
 * fetch or `locateFile` resolution, which would fail under the plugin's
 * `new Function()` execution context.
 */
export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    const wasmBinary = base64ToUint8Array(sqlWasmBase64);
    // sql.js accepts any typed array; the type def is narrower than the runtime contract.
    sqlJsPromise = initSqlJs({ wasmBinary: wasmBinary.buffer as ArrayBuffer });
  }
  return sqlJsPromise;
}
