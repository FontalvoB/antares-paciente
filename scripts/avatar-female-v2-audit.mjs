import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const root='public/models/avatar/';
function read(file){const raw=fs.readFileSync(root+file),n=raw.readUInt32LE(12);return{raw,g:JSON.parse(raw.subarray(20,20+n)),bin:raw.subarray(28+n)};}
function data(a,id){const p=a.g.accessors[id],v=a.g.bufferViews[p.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[p.type],size={5126:4,5125:4,5123:2,5121:1}[p.componentType];assert(!p.sparse);const chunks=[];for(let i=0;i<p.count;i++){const start=(v.byteOffset??0)+(p.byteOffset??0)+i*(v.byteStride??width*size);chunks.push(a.bin.subarray(start,start+width*size));}return Buffer.concat(chunks);}
function floats(a,id){const b=data(a,id);return Array.from({length:b.length/4},(_,i)=>b.readFloatLE(i*4));}
const old=read('bodies/female-body-base-v1.glb'),body=read('bodies/female-body-base-v2.glb');
const bp=floats(body,body.g.meshes[0].primitives[0].attributes.POSITION),op=floats(old,old.g.meshes[0].primitives[0].attributes.POSITION);
// Export may split vertices for morph normals; compare spatial positions, not indices.
const buckets=new Map();for(let i=0;i<op.length;i+=3){const p=op.slice(i,i+3),key=p.map(x=>Math.floor(x*1e5)).join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
let basisError=0;for(let i=0;i<bp.length;i+=3){const p=bp.slice(i,i+3),q=p.map(x=>Math.floor(x*1e5));let best=Infinity;for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const v of buckets.get([q[0]+x,q[1]+y,q[2]+z].join(','))??[])best=Math.min(best,Math.hypot(...p.map((n,j)=>n-v[j])));basisError=Math.max(basisError,best);}assert(basisError<.000005,`Basis error ${basisError}`);
const names=body.g.meshes[0].extras.targetNames;assert.equal(names.length,9);assert.deepEqual(names,old.g.meshes[0].extras.targetNames);
const clips=body.g.animations.map(a=>{const before=old.g.animations.find(b=>b.name===a.name);assert(before);a.samplers.forEach((s,i)=>{assert.deepEqual(data(body,s.input),data(old,before.samplers[i].input));assert.deepEqual(data(body,s.output),data(old,before.samplers[i].output));});return{name:a.name,channels:a.channels.length,unchanged:true};});
const files=['bodies/female-body-base-v2.glb','clothing/tops/female-shirt-basic-01-v2.glb',...['01','02','03'].map(n=>`hair/female-hair-long-${n}.glb`)];
const rows=files.map(file=>{const a=read(file);for(const m of a.g.meshes){assert.deepEqual(m.extras.targetNames,names);for(const p of m.primitives)assert.equal(p.targets.length,9);}
 return{file,bytes:a.raw.length,triangles:a.g.meshes.reduce((s,m)=>s+m.primitives.reduce((n,p)=>n+a.g.accessors[p.indices].count/3,0),0),materials:a.g.materials.length,textures:a.g.images?.length??0,bones:a.g.skins[0].joints.length,sha256:crypto.createHash('sha256').update(a.raw).digest('hex')};});
const oldSkin=old.g.skins[0],newSkin=body.g.skins[0];assert.deepEqual(newSkin.joints.map(i=>body.g.nodes[i].name),oldSkin.joints.map(i=>old.g.nodes[i].name));
const a=floats(body,newSkin.inverseBindMatrices),b=floats(old,oldSkin.inverseBindMatrices);const bindError=Math.max(...a.map((x,i)=>Math.abs(x-b[i])));assert(bindError<.000001);
const report={bodyBasisUnchanged:true,basisError,nineMorphNamesUnchanged:true,clips,bindError,rows};fs.writeFileSync('docs/avatar-female-v2-validation/glb-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
