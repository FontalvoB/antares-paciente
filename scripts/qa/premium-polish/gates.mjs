/** Gates con códigos de salida explícitos y logs UTF-8, también en PowerShell 5. */
import {spawnSync} from 'node:child_process';
import {writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
const globalNpm=resolve(process.env.APPDATA??'', 'npm/node_modules/npm/bin/npm-cli.js');
const npm=process.env.npm_execpath??(existsSync(globalNpm)?globalNpm:resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'));
const gates=[];
for(const [name,args]of [['test',['test','--','--reporter=json','--outputFile=.artifacts/p4-all-tests.json']],['lint',['run','lint']],['build',['run','build']],['i18n',['run','i18n:check']]]){
 const r=spawnSync(process.execPath,[npm,...args],{encoding:'utf8',maxBuffer:64*1024*1024});
 writeFileSync(`.artifacts/p4-${name==='test'?'all-tests':name}.log`,(r.stdout??'')+(r.stderr??''));
 gates.push({name,exitCode:r.status});writeFileSync('.artifacts/p4-gates.json',JSON.stringify(gates,null,2)+'\n');
 console.log(`${name}: ${r.status}`);assert.equal(r.status,0,name);
}
