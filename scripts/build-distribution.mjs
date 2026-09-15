import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'distribution/huggingface');
const check = process.argv.includes('--check');
const source = (name) => readFileSync(path.join(root, name));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const lines = (name) => source(name).toString().trim().split('\n').map(JSON.parse);
const prompts = lines('data/v1.1/prompts.jsonl');
const answers = lines('data/v1.1/reference-submission.jsonl');
const cases = JSON.parse(source('data/v1.1/decision-cases.json')).cases;
const sourceFiles = readdirSync(path.join(root, 'data/v1.1')).sort().map(n => `data/v1.1/${n}`);
const files = new Map(sourceFiles.map(name => [`original/${name}`, source(name)]));
const jsonl = (rows) => Buffer.from(rows.map(row => JSON.stringify(row)).join('\n') + '\n');
files.set('tables/prompts.jsonl', jsonl(prompts.map(p => ({
  case_id: p.caseId, track: p.track, decision_time: p.decisionTime,
  task: p.task, prompt_json: JSON.stringify(p),
}))));
files.set('tables/reference_answers.jsonl', jsonl(answers.map(a => ({
  case_id: a.caseId, track: a.track, response_status: a.responseStatus,
  reference_answer_json: JSON.stringify(a),
}))));
files.set('tables/cases.jsonl', jsonl(cases.map(c => ({
  case_id: c.caseId, title: c.title, failure_mode: c.failureMode,
  decision_time: c.decisionTime, case_json: JSON.stringify(c),
}))));
files.set('DATA-LICENSE.md', source('DATA-LICENSE.md'));
files.set('citation.bib', source('data/v1.1/citation.bib'));
// The card is reviewed prose; it is hashed together with the generated payload.
const card = source('distribution/huggingface/README.md');
const manifest = {
  distributionVersion: '2026-09-16-v1', benchmarkVersion: '1.1.0',
  creator: 'AhaSignals', benchmarkDoi: '10.5281/zenodo.22289017',
  sourceRepository: 'https://github.com/AhaSignals/pit-backtest-validation-benchmark',
  sourceFiles: Object.fromEntries(sourceFiles.map(name => [name, sha(source(name))])),
  counts: { cases: cases.length, prompts: prompts.length, referenceAnswers: answers.length },
  boundary: 'Public conformance fixtures, not held-out evaluation or independently collected historical observations.',
  files: Object.fromEntries([...files, ['README.md', card]].map(([name, data]) => [name, sha(data)])),
};
files.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
for (const [name, bytes] of files) {
  const dest = path.join(output, name);
  if (check) {
    if (!readFileSync(dest).equals(bytes)) throw new Error(`Distribution differs from source: ${name}`);
  } else {
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, bytes);
  }
}
console.log(`${check ? 'Verified' : 'Built'} distribution: ${cases.length} cases, ${prompts.length} prompts; frozen originals preserved.`);
