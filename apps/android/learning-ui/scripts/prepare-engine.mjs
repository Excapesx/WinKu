import AdmZip from 'adm-zip';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {engineLibraries,verifyEngineNative} from './apk-native.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const apkPath=process.argv[2];if(!apkPath)throw new Error('Usage: node scripts/prepare-engine.mjs <official-v0.3.8.apk>');
const bytes=await readFile(apkPath);const digest=createHash('sha256').update(bytes).digest('hex');
if(digest!=='80cc39a73a50683a17bcfc6a623c4f9cd1398e77920845febeaa05d0af941754')throw new Error('APK does not match the pinned official v0.3.8 release; refusing to reuse it.');
const apk=new AdmZip(bytes),engine=new AdmZip(apk.readFile('assets/engine.zip'));
verifyEngineNative(apk);
for(const name of ['index.js','learning.js']){const target=`node_modules/@dsh-android/plugin-guard/${name}`;engine.addFile(target,await readFile(resolve(root,'js/packages/plugin-guard',name)));}
const engineOut=resolve(root,'toolchains/out/engine');await mkdir(engineOut,{recursive:true});
const bundle=engine.toBuffer(),hash=createHash('sha256').update(bundle).digest('hex');
await writeFile(resolve(engineOut,'engine.zip'),bundle);await writeFile(resolve(engineOut,'engine.sha256'),`${hash}  engine.zip\n`);
await writeFile(resolve(engineOut,'engine-version.txt'),apk.readAsText('assets/engine-version.txt').trim()+'+learning.1\n');
const nativeOut=resolve(root,'toolchains/out/jniLibs/arm64-v8a');await mkdir(nativeOut,{recursive:true});
for(const name of engineLibraries){const content=apk.readFile(`lib/arm64-v8a/${name}`);if(!content)throw new Error(`Missing engine library: ${name}`);await writeFile(resolve(nativeOut,name),content);}
const thirdParty=resolve(root,'toolchains/out/third-party/assets/shizuku');await mkdir(thirdParty,{recursive:true});
for(const name of ['shizuku.apk','LICENSE'])await writeFile(resolve(thirdParty,name),apk.readFile(`assets/shizuku/${name}`));
console.log(JSON.stringify({baseApkSha256:digest,engineSha256:hash,engineOut,nativeOut},null,2));
