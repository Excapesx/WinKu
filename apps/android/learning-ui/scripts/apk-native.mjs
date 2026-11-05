import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Keep the APK reuse path aligned with upstream's complete native package,
// including the C++ runtime required before NodeRuntime.nativeStart can run.
const upstream = readFileSync(fileURLToPath(new URL('../../native/prebuilt.sh', import.meta.url)), 'utf8');
export const engineLibraries = [...new Set([
  ...[...upstream.matchAll(/^\s*"([^":]+\.so):[^"\r\n]+"/gm)].map(match => match[1]),
  'librg.so',
])];
const systemLibraries = new Set(['libc.so', 'libm.so', 'libdl.so', 'liblog.so', 'libandroid.so', 'libz.so']);

/** Read DT_NEEDED from the actual ELF64/AArch64 bytes, without executing them. */
export function readElfNeeded(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 64 || bytes.readUInt32BE(0) !== 0x7f454c46 ||
      bytes[4] !== 2 || bytes[5] !== 1 || bytes.readUInt16LE(18) !== 183) {
    throw new Error('Expected a little-endian ELF64 AArch64 native library');
  }
  const number = offset => {
    const value = bytes.readBigUInt64LE(offset);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('ELF offset exceeds safe range');
    return Number(value);
  };
  const phoff = number(32), phsize = bytes.readUInt16LE(54), count = bytes.readUInt16LE(56);
  if (phsize < 56 || phoff + phsize * count > bytes.length) throw new Error('Invalid ELF program headers');
  const headers = Array.from({length: count}, (_, i) => {
    const offset = phoff + phsize * i;
    return {type: bytes.readUInt32LE(offset), offset: number(offset + 8), address: number(offset + 16), size: number(offset + 32)};
  });
  const dynamic = headers.find(header => header.type === 2);
  // The bundled ripgrep is a statically linked ET_EXEC, stored as lib*.so
  // so Android installs it in an executable native-library directory.
  if (!dynamic && bytes.readUInt16LE(16) === 2) return [];
  if (!dynamic || dynamic.offset + dynamic.size > bytes.length) throw new Error('Missing ELF dynamic section');
  let stringAddress; const needed = [];
  for (let at = dynamic.offset; at + 16 <= dynamic.offset + dynamic.size; at += 16) {
    const tag = bytes.readBigInt64LE(at);
    if (tag === 0n) break;
    if (tag === 1n) needed.push(number(at + 8));
    if (tag === 5n) stringAddress = number(at + 8);
  }
  const segment = headers.find(header => header.type === 1 && stringAddress >= header.address && stringAddress < header.address + header.size);
  if (!segment) throw new Error('Missing ELF dynamic string table');
  const start = segment.offset + stringAddress - segment.address;
  return needed.map(offset => {
    const begin = start + offset, end = bytes.indexOf(0, begin);
    if (begin >= bytes.length || end < begin) throw new Error('Invalid ELF dependency name');
    return bytes.toString('utf8', begin, end);
  });
}

/** Reject an APK if any native engine library or non-system dependency is absent. */
export function verifyEngineNative(apk) {
  const prefix = 'lib/arm64-v8a/';
  const missing = engineLibraries.filter(name => !apk.getEntry(prefix + name));
  if (missing.length) throw new Error(`Missing engine native libraries: ${missing.join(', ')}`);
  const dependencies = {};
  const queue = [...engineLibraries];
  while (queue.length) {
    const name = queue.shift();
    if (dependencies[name]) continue;
    const required = readElfNeeded(apk.readFile(prefix + name));
    dependencies[name] = required;
    for (const dependency of required) {
      if (systemLibraries.has(dependency)) continue;
      if (!apk.getEntry(prefix + dependency)) throw new Error(`${name} requires missing native dependency ${dependency}`);
      queue.push(dependency);
    }
  }
  return {abi: 'arm64-v8a', libraries: Object.keys(dependencies), dependencies};
}
