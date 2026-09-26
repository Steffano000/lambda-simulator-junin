/// <reference lib="webworker" />
/**
 * Paso 10 · Parsing de JSON pesados fuera del hilo principal (EP-07.2).
 * Uso: new Worker(new URL('./jsonParse.worker.ts', import.meta.url), { type: 'module' })
 */
self.onmessage = (e: MessageEvent<string>) => {
  try {
    self.postMessage({ ok: true, data: JSON.parse(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, error: (err as Error).message });
  }
};
