// Ejecuta los recorridos P2/P3 aceptados con evidencia P4 independiente.
import {readFileSync} from 'node:fs';
const phase=process.argv[2]??'p3',folder=phase==='p2'?'premium-missions':'premium-coach';
let source=readFileSync(`scripts/qa/${folder}/${phase==='p2'?'run':'after'}.mjs`,'utf8')
  .replaceAll("from 'playwright'",`from '${import.meta.resolve('playwright')}'`)
  .replaceAll("from './setup.mjs'",`from '${new URL('../'+folder+'/setup.mjs',import.meta.url).href}'`)
  .replace('revision-app-premium/P3/after','revision-app-premium/P4/regression-p3')
  .replace("'revision-app-premium/P2'","'revision-app-premium/P4/regression-p2'");
if(phase==='p2') source=source.replace("process.argv[2]??'after'","'after'").replace('revision-app-premium/P2','revision-app-premium/P4/regression-p2');
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
