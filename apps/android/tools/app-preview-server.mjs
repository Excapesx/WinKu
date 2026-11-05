import http from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const port=4174, origin=`http://127.0.0.1:${port}`, serial='emulator-5554';
const adb=resolve(root,'toolchains/local/android-sdk/platform-tools/adb.exe');
const run=promisify(execFile);
let frame,frameAt=0,pending,width=390,height=844;
async function capture(){
 if(frame&&Date.now()-frameAt<350)return frame;
 if(!pending)pending=(async()=>{const {stdout}=await run(adb,['-s',serial,'exec-out','screencap','-p'],{encoding:'buffer',windowsHide:true,timeout:15000,maxBuffer:4*1024*1024});if(stdout.length<24||stdout.readUInt32BE(0)!==0x89504e47)throw new Error('No emulator frame');width=stdout.readUInt32BE(16);height=stdout.readUInt32BE(20);frame=stdout;frameAt=Date.now();return frame;})().finally(()=>pending=null);
 return pending;
}
const assets={'/app-preview.css':['tools/app-preview.css','text/css'],'/app-preview-client.js':['tools/app-preview-client.js','text/javascript'],'/captures/chat.png':['out/preview-app-chat.png','image/png'],'/captures/drawer.png':['out/preview-app-drawer.png','image/png'],'/captures/settings.png':['out/preview-app-settings.png','image/png']};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
 if(req.method!=='GET'){res.writeHead(405).end('Read-only preview');return;}
 if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==origin)){res.writeHead(403).end('Local preview only');return;}
 try{const path=new URL(req.url,origin).pathname;
  if(path==='/api/frame'){const png=await capture();res.writeHead(200,{'Content-Type':'image/png'}).end(png);return;}
  if(path==='/api/status'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({app:'dsh-ultra-native-preview',readOnly:true,serial,width,height,frameAt}));return;}
  if(path==='/'){res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'");res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(await readFile(resolve(root,'tools/app-preview.html')));return;}
  const asset=assets[path];if(asset){res.writeHead(200,{'Content-Type':asset[1]}).end(await readFile(resolve(root,asset[0])));return;}
  res.writeHead(404).end();
 }catch(failure){res.writeHead(503,{'Content-Type':'application/json'}).end(JSON.stringify({error:failure.message}));}
});
server.listen(port,'127.0.0.1',()=>console.log(`DSH Ultra read-only native UI preview: ${origin}`));
process.on('SIGINT',()=>server.close());process.on('SIGTERM',()=>server.close());
