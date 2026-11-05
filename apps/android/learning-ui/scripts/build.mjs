import {build} from 'esbuild';
import {mkdir,copyFile,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'../app/src/main/assets/learning');
await mkdir(out,{recursive:true});
await build({entryPoints:[join(root,'src/main.tsx')],bundle:true,minify:true,target:['chrome100'],outfile:join(out,'app.js'),loader:{'.woff2':'file','.woff':'file','.ttf':'file'},assetNames:'fonts/[name]-[hash]',legalComments:'linked',define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
await copyFile(join(root,'index.html'),join(out,'index.html'));
await copyFile(join(root,'sandbox.html'),join(out,'sandbox.html'));
await build({entryPoints:[join(root,'src/sandbox.ts')],bundle:true,minify:true,target:['chrome100'],outfile:join(out,'sandbox.js')});
const exampleModule=await build({entryPoints:[join(root,'src/examples.ts')],bundle:true,write:false,format:'esm',platform:'node'});
const {examples}=await import('data:text/javascript;base64,'+Buffer.from(exampleModule.outputFiles[0].text).toString('base64'));
await writeFile(join(out,'examples.json'),JSON.stringify(examples));
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const licenses=[];for(const name of Object.keys(pkg.dependencies)){const dir=join(root,'node_modules',name);const meta=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));const candidates=(await readdir(dir)).filter(n=>/^licen[cs]e(\.|$)/i.test(n));licenses.push(`${name} ${meta.version}\nLicense: ${meta.license}\n${candidates[0]?await readFile(join(dir,candidates[0]),'utf8'):''}`);}
await writeFile(join(out,'THIRD-PARTY-LICENSES.txt'),licenses.join('\n\n----------------\n\n'));
console.log(`Offline learning assets: ${out}`);
