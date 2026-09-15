import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='public/models/avatar/';
function read(p){const b=fs.readFileSync(root+p),n=b.readUInt32LE(12);return {g:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};}
const old=read('bodies/male-body-base-v9.glb'),next=read('bodies/female-body-base-v1.glb');
assert(!next.g.animations?.length,'Clips already transferred');
const chunks=[next.bin],map=new Map();let offset=next.bin.length;
function accessor(id){
 if(map.has(id))return map.get(id);
 const a=structuredClone(old.g.accessors[id]);assert(!a.sparse);const view=old.g.bufferViews[a.bufferView];
 const bytes=old.bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);chunks.push(bytes);
 next.g.bufferViews.push({...view,buffer:0,byteOffset:offset});offset+=bytes.length;
 const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}
 a.bufferView=next.g.bufferViews.length-1;next.g.accessors.push(a);const dest=next.g.accessors.length-1;map.set(id,dest);return dest;
}
next.g.animations=old.g.animations.map(source=>{
 const a=structuredClone(source);
 for(const s of a.samplers){s.input=accessor(s.input);s.output=accessor(s.output);}
 for(const c of a.channels){const name=old.g.nodes[c.target.node].name;c.target.node=next.g.nodes.findIndex(n=>n.name===name);assert(c.target.node>=0,`Missing ${name}`);}
 return a;
});
next.g.buffers[0].byteLength=offset;next.g.asset.extras={bodyVersion:1,source:'female-v1',gender:'female',preservedClips:['Idle','RigCheck']};
for(const n of next.g.nodes)if(n.mesh!==undefined)n.extras={...n.extras,avatar_version:1,morph_range:'0..1'};
const json=Buffer.from(JSON.stringify(next.g));const j=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),bin=Buffer.concat(chunks),h=Buffer.alloc(20),bh=Buffer.alloc(8);
h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+bin.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(root+'bodies/female-body-base-v1.glb',Buffer.concat([h,j,bh,bin]));
console.log(JSON.stringify({clips:next.g.animations.map(a=>a.name),bytes:28+j.length+bin.length}));

