import test from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import {readElfNeeded, verifyEngineNative} from '../scripts/apk-native.mjs';

// The pinned upstream APK supplies real ELF bytes rather than mocked headers.
// Set DSH_TEST_BASE_APK to run the packaging regression against that artifact.
const base = process.env.DSH_TEST_BASE_APK;
test('official engine native libraries have a complete dependency closure', {skip: !base}, () => {
  const report = verifyEngineNative(new AdmZip(base));
  assert.ok(report.dependencies['libnode.so'].includes('libc++_shared.so'));
  assert.ok(report.libraries.includes('libc++_shared.so'));
});
test('release check catches the exact missing C++ runtime regression', {skip: !base}, () => {
  const apk = new AdmZip(base);
  apk.deleteFile('lib/arm64-v8a/libc++_shared.so');
  assert.throws(() => verifyEngineNative(apk), /Missing engine native libraries: libc\+\+_shared\.so/);
});
test('native check refuses non-ELF and non-arm64 payloads', () => {
  assert.throws(() => readElfNeeded(Buffer.alloc(128)), /ELF64 AArch64/);
});
