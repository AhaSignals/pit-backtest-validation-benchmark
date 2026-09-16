import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { makeControls } from './lib/error-controls.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(path.join(root, name));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const benchmark = JSON.parse(read('data/v1.1/benchmark.json'));
const reference = read('data/v1.1/reference-submission.jsonl').toString().trim().split('\n').map(JSON.parse);
const controls = makeControls(benchmark, reference);
const files = {
  'controls.jsonl': controls.map(c => JSON.stringify(c)).join('\n') + '\n',
  'summary.json': JSON.stringify({
    version: '1.0.0', creator: 'AhaSignals', publishedAt: '2026-09-16', benchmarkVersion: '1.1.0',
    benchmarkDoi: '10.5281/zenodo.22289017',
    counts: { selectedCases: 8, tracks: 2, alteredSubmissions: controls.length, temporalFailures: controls.filter(c => c.expected.hardFailure).length, nonTemporalRejections: controls.filter(c => !c.expected.hardFailure).length },
    boundary: 'Synthetic scorer regression controls. Each run changes one field in one response of a 16-response reference submission. Not observed model errors, independent cases, or market-wide error rates.',
    cases: controls.filter(c => c.track === 'retrieval').map(({id,track,reference,changed,synthetic,...c}) => c),
  }, null, 2) + '\n',
};
const sourceNames = ['data/v1.1/benchmark.json', 'data/v1.1/reference-submission.jsonl', 'scripts/score-submission.mjs', 'scripts/lib/error-controls.mjs', 'scripts/build-error-controls.mjs', 'scripts/verify-error-controls.mjs'];
files['manifest.json'] = JSON.stringify({
  version: '1.0.0', creator: 'AhaSignals',
  sourceHashes: Object.fromEntries(sourceNames.map(n => [n, sha(read(n))])),
  files: Object.fromEntries(Object.entries(files).map(([n, b]) => [n, sha(b)])),
}, null, 2) + '\n';
for (const [name, bytes] of Object.entries(files)) {
  const filename = path.join(root, 'controls/v1', name);
  if (process.argv.includes('--check')) {
    if (read(`controls/v1/${name}`).toString() !== bytes) throw Error(`Control build differs: ${name}`);
  } else fs.writeFileSync(filename, bytes);
}
console.log('Synthetic error controls: 8 cases, 16 separately altered submissions.');
