/** Índice y huellas de capturas: falla si el nombre y el tamaño físico no coinciden. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const root=resolve('../../openspec/changes/organizar-experiencia-bienestar/revision-app-premium')
const json=path=>JSON.parse(readFileSync(path,'utf8'))
const log=path=>{const data=readFileSync(path);return data.toString(data[0]===255&&data[1]===254?'utf16le':'utf8')}
const before=json(resolve(root,'before/results.json'))
const after=json(resolve(root,'after/results.json'))
const runtime=json(resolve(root,'runtime/results.json'))
assert.equal(before.length,6)
assert.equal(after.filter(row=>row.checks).length,6)
assert.equal(runtime.cases.length,18)
assert.deepEqual(runtime.before,runtime.after)
assert.deepEqual(runtime.clinicalWrites,[])
assert.deepEqual(runtime.pageErrors,[])
const images=[]
for(const folder of ['before','after','runtime']) for(const file of readdirSync(resolve(root,folder)).filter(file=>file.endsWith('.png')&&!file.includes('overflow'))) {
  const data=readFileSync(resolve(root,folder,file)), width=data.readUInt32BE(16),height=data.readUInt32BE(20)
  assert.equal(width,Number(file.match(/^(?:es|en)-(\d+)-/)[1]))
  images.push({file:`${folder}/${file}`,width,height,sha256:createHash('sha256').update(data).digest('hex')})
}
const tests=json('.artifacts/premium-all-tests.json')
assert.equal(tests.numFailedTests,0)
const lint=log('.artifacts/premium-lint.log')
assert.match(log('.artifacts/premium-build.log'),/built in/)
assert.match(log('.artifacts/premium-i18n.log').replace(/\u001b\[[0-9;]*m/g,''),/Missing from en.json:\s+0/)
const manifest={baseline:'20057df',generatedAt:new Date().toISOString(),evidenceRoot:root,tests:{files:tests.testResults.length,passed:tests.numPassedTests,failed:tests.numFailedTests},lint:{errors:(lint.match(/: error /g)??[]).length,warnings:(lint.match(/: warning /g)??[]).length},build:'pass; warning de chunk mayor de 1300 kB preexistente',i18nMissing:0,controlled:after,real:{cases:runtime.cases,stubs:false,pageErrors:runtime.pageErrors,clinicalWrites:runtime.clinicalWrites,protectedBefore:runtime.before,protectedAfter:runtime.after},images}
writeFileSync(resolve(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
writeFileSync('docs/integracion/P1-premium-evidencia.json',JSON.stringify(manifest,null,2)+'\n')
const rows=[]
for(const lang of ['es','en']) for(const width of [320,390,1440]) for(const tab of ['hoy','plan','historial']) rows.push(`<section><h2>${lang.toUpperCase()} · ${width} · ${tab}</h2><div class="pair">${['before','after'].map(folder=>`<figure><figcaption>${folder==='before'?'Antes · 20057df':'Después · P1'}</figcaption><a href="${folder}/${lang}-${width}-${tab}.png"><img loading="lazy" src="${folder}/${lang}-${width}-${tab}.png" alt="${folder} ${lang} ${width} ${tab}"></a></figure>`).join('')}</div></section>`)
writeFileSync(resolve(root,'index.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P1 · Evidencia de Nutrición</title><style>body{margin:24px;font:16px system-ui;color:#0b2a4a;background:#f2f7fd}main{max-width:1200px;margin:auto}section{margin:40px 0}h2{font-size:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;min-width:0}figcaption{padding:12px}img{width:100%;height:auto;border-radius:16px;border:1px solid #e3ecf6}@media(max-width:600px){.pair{grid-template-columns:1fr}}</style><main><h1>Fase 1 · Nutrición premium</h1><p>Comparación controlada con el mismo DTO, componentes reales y respuestas de prueba. La carpeta <a href="runtime/results.json">runtime</a> contiene la pasada de lectura contra el stack real, sin stubs ni mutaciones clínicas.</p><p><a href="manifest.json">Manifest y hashes</a> · <a href="after/results.json">Interacciones y accesibilidad</a>. Las capturas adicionales «historial-datos», «peso» y «hoy-datos-reduced» muestran datos ilustrativos explícitos, no registros de pacientes.</p>${rows.join('')}</main></html>`)
console.log(JSON.stringify({images:images.length,tests:manifest.tests,lint:manifest.lint,output:root}))
