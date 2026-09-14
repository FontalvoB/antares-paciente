// Read-only audit. Historical references also prevent automatic deletion.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const skip=new Set(['node_modules','.git','dist','.codegraph','.venv','bin','obj']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>skip.has(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk('.');
const textFiles=files.filter(f=>/\.(ts|tsx|js|mjs|cjs|json|md|py|html|css|yaml|yml|toml|txt|config)$/.test(f)&&!f.includes('avatar-polish-validation'));
const texts=textFiles.map(f=>[f,fs.readFileSync(f,'utf8')]);
const assets=files.filter(f=>f.startsWith(path.join('public','models','avatar'))&&/\.(glb|blend|blend1)$/.test(f));
const rows=assets.map(file=>{const raw=fs.readFileSync(file);const basename=path.basename(file);return {file:file.replaceAll('\\','/'),bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex'),references:texts.filter(([f,t])=>f!==file&&t.includes(basename)).map(([f])=>f.replaceAll('\\','/'))};});
fs.writeFileSync(process.env.AVATAR_REF_REPORT || 'docs/avatar-polish-validation/reference-inventory.json',JSON.stringify({scannedFiles:files.length,textFiles:textFiles.length,assets:rows},null,2));
console.log(JSON.stringify(rows.filter(r=>!r.references.length).map(r=>({file:r.file,bytes:r.bytes,duplicates:rows.filter(s=>s.file!==r.file&&s.sha256===r.sha256).map(s=>s.file)})),null,2));
