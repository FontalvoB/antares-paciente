// Reutiliza el recorrido de Hoy aceptado; conserva evidencia P4 separada.
import {readFileSync} from 'node:fs';
const source=readFileSync('scripts/qa/premium-coach/polish-nav.mjs','utf8')
  .replace("from 'playwright'",`from '${import.meta.resolve('playwright')}'`)
  .replace('revision-app-premium/P3','revision-app-premium/P4')
  .replaceAll('height:900','height:844');
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
