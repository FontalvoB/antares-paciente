// Remove float round-trip drift introduced by Blender's glTF import/export.
// Only accept differences below 0.1 mm; never adapt or redesign the rig.
import fs from 'node:fs';import assert from 'node:assert/strict';
const root='public/models/avatar/';
function read(file){const raw=fs.readFileSync(root+file),n=raw.readUInt32LE(12);return{g:JSON.parse(raw.subarray(20,20+n)),bin:Buffer.from(raw.subarray(28+n))};}
const source=read('bodies/female-body-base-v1.glb');
function matrices(a){const skin=a.g.skins[0],acc=a.g.accessors[skin.inverseBindMatrices],view=a.g.bufferViews[acc.bufferView];return{skin,offset:(view.byteOffset??0)+(acc.byteOffset??0),stride:view.byteStride??64};}
const sm=matrices(source),canonical=new Map(sm.skin.joints.map((node,i)=>[source.g.nodes[node].name,{node:source.g.nodes[node],matrix:Array.from({length:16},(_,j)=>source.bin.readFloatLE(sm.offset+i*sm.stride+j*4))}]));
const rows=[];
for(const file of ['bodies/female-body-base-v2.glb','clothing/tops/female-shirt-basic-01-v2.glb',...['01','02','03'].map(n=>`hair/female-hair-long-${n}.glb`)]){
 const a=read(file),m=matrices(a);let error=0;
 m.skin.joints.forEach((node,i)=>{const n=a.g.nodes[node],c=canonical.get(n.name);assert(c);
  for(let j=0;j<16;j++){const offset=m.offset+i*m.stride+j*4;const d=Math.abs(a.bin.readFloatLE(offset)-c.matrix[j]);error=Math.max(error,d);assert(d<.0001,`Different bind convention ${file}: ${d}`);a.bin.writeFloatLE(c.matrix[j],offset);}
  for(const key of ['translation','rotation','scale','matrix']){if(c.node[key])n[key]=structuredClone(c.node[key]);else delete n[key];}
 });
 const raw=Buffer.from(JSON.stringify(a.g)),json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),header=Buffer.alloc(20),bh=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+a.bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(a.bin.length);bh.writeUInt32LE(0x004e4942,4);
 fs.writeFileSync(root+file,Buffer.concat([header,json,bh,a.bin]));rows.push({file,removedFloatDrift:error});
}
fs.writeFileSync('docs/avatar-female-v2-validation/canonical-roundtrip.json',JSON.stringify(rows,null,2));console.log(rows);
