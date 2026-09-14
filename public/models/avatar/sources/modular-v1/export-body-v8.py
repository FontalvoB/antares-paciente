"""Exportar el Shape Key editado conservando exactamente clips, skin y texturas v7."""
import bpy,struct,json,os,hashlib
from mathutils import Vector
from mathutils.kdtree import KDTree
root='C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente'
source=root+'/public/models/avatar/bodies/male-body-base-v7.glb';out=root+'/public/models/avatar/bodies/male-body-base-v8.glb'
assert not os.path.exists(out)
raw=open(source,'rb').read();jl=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+jl]);binary=bytearray(raw[28+jl:]);before=bytes(binary)
body=bpy.data.objects['male-body-base-v8_Mesh'];basis=body.data.shape_keys.key_blocks[0];volume=body.data.shape_keys.key_blocks['BodyVolume']
kd=KDTree(len(basis.data))
for i,p in enumerate(basis.data):kd.insert(p.co,i)
kd.balance()
mesh=bpy.data.meshes.new('BodyVolume_ExportNormals');mesh.from_pydata([v.co for v in volume.data],[],[list(p.vertices) for p in body.data.polygons]);mesh.update()
def readvec(index,i):
    a=g['accessors'][index];v=g['bufferViews'][a['bufferView']]
    return Vector(struct.unpack_from('<3f',binary,v.get('byteOffset',0)+a.get('byteOffset',0)+i*v.get('byteStride',12)))
def writevec(index,values):
    a=g['accessors'][index]
    # El origen usa morphs sparse. Añadir dos vistas densas evita alterar vistas compartidas.
    start=len(binary);stride=12;binary.extend(b'\0'*(len(values)*12))
    a.pop('sparse',None);a.pop('byteOffset',None);a['bufferView']=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(values)*12})
    assert a['count']==len(values) and a['componentType']==5126
    for i,p in enumerate(values):struct.pack_into('<3f',binary,start+i*stride,*p)
    if 'min' in a:a['min']=[min(p[j] for p in values) for j in range(3)]
    if 'max' in a:a['max']=[max(p[j] for p in values) for j in range(3)]
max_error=0;edited=[]
for model in g['meshes']:
    idx=model['extras']['targetNames'].index('BodyVolume')
    for primitive in model['primitives']:
        positions=[];normals=[]
        for i in range(g['accessors'][primitive['attributes']['POSITION']]['count']):
            base=readvec(primitive['attributes']['POSITION'],i);_,index,error=kd.find(Vector((base.x,-base.z,base.y)));max_error=max(max_error,error)
            assert error<.00001,'Source topology or coordinate system mismatch'
            co=volume.data[index].co;n=mesh.vertices[index].normal
            positions.append(Vector((co.x,co.z,-co.y))-base)
            normals.append(Vector((n.x,n.z,-n.y))-readvec(primitive['attributes']['NORMAL'],i))
        for semantic,values in [('POSITION',positions),('NORMAL',normals)]:
            accessor=primitive['targets'][idx][semantic];writevec(accessor,values);edited.append(accessor)
bpy.data.meshes.remove(mesh)
g.setdefault('asset',{}).setdefault('extras',{}).update({'bodyVersion':8,'source':'male-body-base-v7','revision':'BodyVolume distributed adiposity; all other attributes and animations preserved'})
g['buffers'][0]['byteLength']=len(binary)
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
output=struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
open(out,'wb').write(output)
# Todos los bytes cambiados deben pertenecer a esos dos bufferViews exclusivamente.
allowed=[]
for index in edited:
    view=g['bufferViews'][g['accessors'][index]['bufferView']];allowed.append((view.get('byteOffset',0),view.get('byteOffset',0)+view['byteLength']))
assert all(a==b or any(lo<=i<hi for lo,hi in allowed) for i,(a,b) in enumerate(zip(before,binary)))
report={'file':out,'bytes':len(output),'sourceSha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(output).hexdigest(),'maxVertexMappingErrorM':max_error,'changedAccessors':edited,'allOtherBinaryDataIdentical':True,'clips':[a['name'] for a in g['animations']]}
with open(root+'/docs/avatar-modular-validation/body-v8-export.json','w') as f:json.dump(report,f,indent=2)
result=report
