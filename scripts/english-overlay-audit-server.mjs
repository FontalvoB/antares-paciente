// Servidor separado de QA: solo altera respuestas de este proceso, sin llamadas externas.
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:5191,strictPort:true,hmr:false},plugins:[{name:'english-overlay-audit',enforce:'post',transform(code,id){
 if(id.endsWith('/src/context/AppContext.tsx'))return code.replace('return ctx;','window.__englishAuditApp = ctx; return ctx;');
 if(id.endsWith('/src/services/achievements/share-card.ts'))return code.replace('await loadCertificateFont();','if (window.__overlayRenderError) throw new Error("Controlled card failure"); await loadCertificateFont();');
},configureServer(server){server.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/__english-overlays'))return next();try{let html=await readFile('index.html','utf8');html=html.replace('/src/main.tsx','/e2e/english-overlay-fixtures.tsx');html=await server.transformIndexHtml(req.url,html);res.setHeader('Content-Type','text/html');res.end(html)}catch(error){next(error)}})}}]});
await server.listen();console.log('Controlled actual overlays: http://localhost:5191/__english-overlays');
