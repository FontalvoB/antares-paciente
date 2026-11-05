/** Regresión actual: ciudades verificadas y fallback por país; nunca llama a emergencias. */
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
process.env.COP_E2E_APP_URL ??= process.env.SOS_CHECK_URL ?? 'http://localhost:5173';
process.env.COP_E2E_OUTPUT ??= await mkdtemp(path.join(os.tmpdir(), 'sos-emergency-number-check-'));
console.log(`Capturas y resultados: ${process.env.COP_E2E_OUTPUT}`);
await import('../e2e/emergency-city-routing.mjs');
