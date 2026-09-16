// No model calls. Fetch only a pinned manifest, prompt table and frozen prompts.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const pin = JSON.parse(fs.readFileSync(path.join(root, 'distribution/published-hub.json')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (!['--hub','--local','--out'].includes(key) || key in options) throw Error('Use --hub OR --local DIRECTORY, and --out NEW_DIRECTORY.');
  options[key] = key === '--hub' ? true : args[++i];
  if (!options[key] || String(options[key]).startsWith('--')) throw Error('Missing argument value.');
}
if (Boolean(options['--hub']) === Boolean(options['--local']) || !options['--out']) throw Error('Use --hub OR --local DIRECTORY, and --out NEW_DIRECTORY.');
if (fs.existsSync(options['--out'])) throw Error('Output directory already exists; choose a new directory.');
const read = async name => {
  if (options['--local']) return fs.readFileSync(path.join(options['--local'], name));
  const url = `https://huggingface.co/datasets/${pin.repository}/resolve/${pin.revision}/${name}`;
  const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw Error(`Public dataset read failed (${response.status}): ${name}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 2_000_000) throw Error('Unexpected dataset size.');
  return data;
};
const manifestBytes = await read('manifest.json');
assert.equal(sha(manifestBytes), pin.manifestSha256, 'Pinned manifest hash mismatch');
const manifest = JSON.parse(manifestBytes);
const tableBytes = await read('tables/prompts.jsonl');
const originalBytes = await read('original/data/v1.1/prompts.jsonl');
assert.equal(sha(tableBytes), manifest.files['tables/prompts.jsonl'], 'Prompt table hash mismatch');
assert.equal(sha(originalBytes), manifest.sourceFiles['data/v1.1/prompts.jsonl'], 'Frozen prompt hash mismatch');
const rows = bytes => bytes.toString().trim().split('\n').map(JSON.parse);
const originals = rows(originalBytes);
const table = rows(tableBytes);
assert.equal(table.length, 16);
assert.deepEqual(table.map(r => JSON.parse(r.prompt_json)), originals, 'Prompt table must round-trip to the frozen originals');
assert.equal(new Set(originals.map(r => `${r.caseId}/${r.track}`)).size, 16);
for (const [i, row] of table.entries()) {
  assert.deepEqual(Object.keys(row).sort(), ['case_id','decision_time','prompt_json','task','track']);
  assert.equal(row.case_id, originals[i].caseId);
  assert.equal(row.track, originals[i].track);
  assert(!('expected' in originals[i]) && !('forbiddenFuture' in originals[i]));
}
const receipt = {
  creator: 'AhaSignals', kind: 'prompt-export-receipt',
  source: options['--hub'] ? 'public-pinned-hub-download' : 'local-file-verification',
  repository: pin.repository, revision: pin.revision, manifestSha256: pin.manifestSha256,
  verifiedAt: new Date().toISOString(), benchmarkVersion: '1.1.0', promptCount: 16,
  output: {file: 'prompts.jsonl', sha256: sha(originalBytes)},
  exporterSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  boundary: 'Verifies pinned prompt bytes only. This time records export verification, not historical collection or model execution. Supply evidence under the independent-run protocol. Public calibration prompts are not held-out evaluation.',
};
// Validate everything before creating output; never overwrite a previous export.
fs.mkdirSync(options['--out']);
fs.writeFileSync(path.join(options['--out'], 'prompts.jsonl'), originalBytes, {flag: 'wx'});
fs.writeFileSync(path.join(options['--out'], 'receipt.json'), JSON.stringify(receipt,null,2)+'\n', {flag: 'wx'});
console.log('Verified and exported 16 frozen prompts, with a receipt. No answers, case annotations or model calls.');
