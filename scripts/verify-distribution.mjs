import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFileSync(path.join(root, name), 'utf8');
const rows = (name) => read(name).trim().split('\n').map(JSON.parse);
const run = (args) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
const generated = run(['scripts/build-distribution.mjs', '--check']);
assert.equal(generated.status, 0, generated.stderr);
const base = 'distribution/huggingface/';
const prompts = rows(base + 'tables/prompts.jsonl');
const answers = rows(base + 'tables/reference_answers.jsonl');
const cases = rows(base + 'tables/cases.jsonl');
assert.equal(prompts.length, 16);
assert.equal(answers.length, 16);
assert.equal(cases.length, 8);
assert.deepEqual(prompts.map(r => JSON.parse(r.prompt_json)), rows('data/v1.1/prompts.jsonl'));
assert.deepEqual(answers.map(r => JSON.parse(r.reference_answer_json)), rows('data/v1.1/reference-submission.jsonl'));
assert.deepEqual(cases.map(r => JSON.parse(r.case_json)), JSON.parse(read('data/v1.1/decision-cases.json')).cases);
const keys = list => list.map(r => `${r.case_id}/${r.track}`).sort();
assert.equal(new Set(keys(prompts)).size, 16);
assert.deepEqual(keys(prompts), keys(answers));
for (const row of prompts) {
  const prompt = JSON.parse(row.prompt_json);
  assert.equal(row.case_id, prompt.caseId);
  assert.equal(row.track, prompt.track);
  assert.equal(row.decision_time, prompt.decisionTime);
  assert(!('expected' in prompt) && !('forbiddenFuture' in prompt));
  assert(!('reference_answer_json' in row) && !('case_json' in row));
}
const manifest = JSON.parse(read(base + 'manifest.json'));
const actualFiles = (dir, prefix = '') => readdirSync(path.join(root, base, dir), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? actualFiles(path.join(dir, e.name), prefix + e.name + '/') : [prefix + e.name]);
assert.deepEqual(actualFiles('').sort(), [...Object.keys(manifest.files), 'manifest.json'].sort());
const temp = mkdtempSync(path.join(tmpdir(), 'aha-distribution-'));
try {
  const filename = path.join(temp, 'submission.jsonl');
  const restored = answers.map(r => JSON.parse(r.reference_answer_json));
  const score = responseRows => {
    writeFileSync(filename, responseRows.map(r => JSON.stringify(r)).join('\n') + '\n');
    return run(['scripts/score-submission.mjs', filename]);
  };
  const positive = score(restored);
  assert.equal(positive.status, 0, positive.stderr);
  assert.equal(JSON.parse(positive.stdout).summary.temporalIntegrityFailureCount, 0);
  const seeded = rows('data/v1.1/adversarial-submission.jsonl');
  const bad = seeded.find(r => r.caseId === 'AS-PIT-007' && r.track === 'knowledge-contamination');
  const negative = score(restored.map(r => r.caseId === bad.caseId && r.track === bad.track ? bad : r));
  assert.equal(negative.status, 1);
  assert.equal(JSON.parse(negative.stdout).summary.temporalIntegrityFailureCount, 1);
  assert.notEqual(score(restored.slice(1)).status, 0, 'A missing row must not pass');
  assert.notEqual(score([...restored.slice(1), restored[1]]).status, 0, 'A duplicate must not replace a missing pair');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
console.log('Distribution verified: byte-identical sources, lossless round trips, exact pairs, separated inputs, positive/negative and missing/duplicate scorer controls.');
