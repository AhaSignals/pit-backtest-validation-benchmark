#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readJson, root } from './lib/independent-runner.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.length < 1) {
  console.log('Usage: npm run package:independent -- results/independent/<run-id> [--output path/to/result.zip]');
  process.exit(argv.includes('--help') ? 0 : 1);
}
const outputIndex = argv.indexOf('--output');
const runArg = argv[0];
const runRoot = path.resolve(process.cwd(), runArg);
const manifest = readJson(path.join(runRoot, 'run-manifest.json'));
if (manifest.resultClass !== 'independent') throw new Error('Only independent result directories can be packaged.');
const verification = spawnSync(process.execPath, [path.join(root, 'scripts/verify-independent-result.mjs'), runRoot], { cwd: root, encoding: 'utf8' });
if (verification.status !== 0) throw new Error(`Independent result verification failed; package was not created:\n${verification.stdout}${verification.stderr}`);
const outputPath = outputIndex >= 0
  ? path.resolve(process.cwd(), argv[outputIndex + 1])
  : path.resolve(process.cwd(), `${manifest.runId}.zip`);

const checksumFiles = fs.readFileSync(path.join(runRoot, 'checksums.sha256'), 'utf8').trim().split('\n').map((line) => line.split('  ')[1]);
const filenames = [...checksumFiles, 'checksums.sha256'].sort();
for (const filename of filenames) {
  if (!filename || filename.includes('/') || filename.includes('..')) throw new Error(`Unsafe package filename: ${filename}`);
  if (!fs.existsSync(path.join(runRoot, filename))) throw new Error(`Missing package file: ${filename}`);
}

const crcTable = Array.from({ length: 256 }, (_, number) => {
  let crc = number;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});
const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const u16 = (number) => { const value = Buffer.alloc(2); value.writeUInt16LE(number); return value; };
const u32 = (number) => { const value = Buffer.alloc(4); value.writeUInt32LE(number >>> 0); return value; };

const localParts = [];
const centralParts = [];
let offset = 0;
for (const filename of filenames) {
  const data = fs.readFileSync(path.join(runRoot, filename));
  const entryName = Buffer.from(`${manifest.runId}/${filename}`, 'utf8');
  const crc = crc32(data);
  const local = Buffer.concat([
    u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
    u32(crc), u32(data.length), u32(data.length), u16(entryName.length), u16(0), entryName, data,
  ]);
  localParts.push(local);
  centralParts.push(Buffer.concat([
    u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
    u32(crc), u32(data.length), u32(data.length), u16(entryName.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), entryName,
  ]));
  offset += local.length;
}
const central = Buffer.concat(centralParts);
const end = Buffer.concat([
  u32(0x06054b50), u16(0), u16(0), u16(filenames.length), u16(filenames.length),
  u32(central.length), u32(offset), u16(0),
]);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, Buffer.concat([...localParts, central, end]));
console.log(JSON.stringify({ status: 'packaged', runId: manifest.runId, fileCount: filenames.length, output: outputPath }, null, 2));
