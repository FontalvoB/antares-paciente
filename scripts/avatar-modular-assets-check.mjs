import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root='public/models/avatar';
function load(file) {
  const raw=fs.readFileSync(path.join(root,file)),size=raw.readUInt32LE(12);
  assert.equal(raw.readUInt32LE(8),raw.length);
  return {raw,g:JSON.parse(raw.subarray(20,20+size)),bin:raw.subarray(28+size)};
}
function floats(asset,index) {
  const a=asset.g.accessors[index],v=asset.g.bufferViews[a.bufferView];assert.equal(a.componentType,5126);
  const n={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[a.type],result=[];
  for(let i=0;i<a.count;i++)for(let j=0;j<n;j++)result.push(asset.bin.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??n*4)+j*4));
  return result;
}
function binds(asset) {
  const skin=asset.g.skins[0],m=floats(asset,skin.inverseBindMatrices);
  return Object.fromEntries(skin.joints.map((id,i)=>[asset.g.nodes[id].name,m.slice(i*16,i*16+16)]));
}
const old=load('bodies/male-body-base-v7.glb'),body=load('bodies/male-body-base-v8.glb');
assert.deepEqual(old.bin,body.bin.subarray(0,old.bin.length));
for(const key of ['animations','skins','nodes','materials','images','textures'])assert.deepEqual(body.g[key],old.g[key]);
for(let i=0;i<old.g.accessors.length;i++)if(![7,8].includes(i))assert.deepEqual(old.g.accessors[i],body.g.accessors[i]);
const canonical=binds(body),files=['bodies/male-body-base-v8.glb','clothing/tops/male-shirt-basic-01-v2.glb',
  'hair/male-hair-01-v2.glb','hair/male-hair-02-v2.glb','hair/male-hair-03-v2.glb',
  'accessories/glasses/unisex-glasses-01.glb','accessories/watches/unisex-watch-01.glb','accessories/bracelets/unisex-bracelet-01.glb'];
const rows=files.map(file=>{
  const a=load(file),binding=binds(a);let error=0,triangles=0;
  assert.equal(Object.keys(binding).length,51);
  for(const [name,m] of Object.entries(binding)) {assert(canonical[name]);m.forEach((x,i)=>error=Math.max(error,Math.abs(x-canonical[name][i])));}
  assert(error<1e-6);
  for(const mesh of a.g.meshes) {
    assert.deepEqual(mesh.extras.targetNames,body.g.meshes[0].extras.targetNames);
    for(const p of mesh.primitives) {triangles+=a.g.accessors[p.indices].count/3;assert.equal(p.targets.length,9);}
  }
  return {file,bytes:a.raw.length,triangles,materials:a.g.materials.length,textures:a.g.images?.length??0,bones:Object.keys(binding).length,inverseBindMaxDifference:error};
});
const clips=body.g.animations.map(a=>{
  const samplers=a.samplers.map(s=>({times:floats(body,s.input),values:floats(body,s.output),width:{VEC3:3,VEC4:4}[body.g.accessors[s.output].type]}));
  const duration=Math.max(...samplers.map(s=>s.times.at(-1)-s.times[0]));
  const endpointDifference=Math.max(...samplers.flatMap(s=>s.values.slice(0,s.width).map((v,i)=>Math.abs(v-s.values[s.values.length-s.width+i]))));
  if(a.name==='Idle')assert(endpointDifference<1e-5);
  return {name:a.name,duration,channels:a.channels.length,endpointDifference};
});
const report={assets:rows,clips,protectedDataIdentical:true,activeCombination:{bytes:rows.filter(r=>!r.file.includes('hair-01')&&!r.file.includes('hair-02')).reduce((s,r)=>s+r.bytes,0),triangles:rows.filter(r=>!r.file.includes('hair-01')&&!r.file.includes('hair-02')).reduce((s,r)=>s+r.triangles,0)}};
fs.writeFileSync('docs/avatar-modular-validation/assets-final.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
