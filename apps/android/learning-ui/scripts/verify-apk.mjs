import AdmZip from 'adm-zip';
import {verifyEngineNative} from './apk-native.mjs';

const apkPath = process.argv[2];
if (!apkPath) throw new Error('Usage: node scripts/verify-apk.mjs <arm64.apk>');
console.log(JSON.stringify(verifyEngineNative(new AdmZip(apkPath)), null, 2));
