import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const run = args => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
const generated = run(['scripts/build-error-controls.mjs', '--check']);
assert.equal(generated.status, 0, generated.stderr);
const readRows = name => fs.readFileSync(path.join(root, name), 'utf8').trim().split('\n').map(JSON.parse);
const reference = readRows('data/v1.1/reference-submission.jsonl');
const controls = readRows('controls/v1/controls.jsonl');
assert.equal(controls.length, 16);
assert.equal(new Set(controls.map(c => c.id)).size, 16);
const pair = r => r.caseId + '/' + r.track;
assert.deepEqual(controls.map(pair).sort(), reference.map(pair).sort());
const temp = fs.mkdtempSync(path.join(tmpdir(), 'pit-controls-'));
try {
  const filename = path.join(temp, 'submission.jsonl');
  const score = rows => {
    fs.writeFileSync(filename, rows.map(r => JSON.stringify(r)).join('\n')+'\n');
    const r = run(['scripts/score-submission.mjs', filename]);
    assert([0,1].includes(r.status), r.stderr);
    return { exitCode: r.status, report: JSON.parse(r.stdout) };
  };
  assert.equal(score(reference).exitCode, 0, 'Unchanged controls must pass');
  let temporal = 0, answerOnly = 0;
  for (const control of controls) {
    const original = reference.find(r => pair(r) === pair(control));
    assert.deepEqual(control.reference, original);
    const restored = structuredClone(control.changed);
    const keys = control.changedField.split('.');
    const parent = keys.slice(0,-1).reduce((o,k) => o[k], restored);
    assert.deepEqual(parent[keys.at(-1)], control.after);
    assert.notDeepEqual(control.before, control.after);
    parent[keys.at(-1)] = control.before;
    assert.deepEqual(restored, original, 'Exactly the declared field may change');
    const {exitCode, report} = score(reference.map(r => pair(r) === pair(control) ? control.changed : r));
    assert.equal(exitCode, 1, control.id);
    assert.equal(report.result, 'fail');
    assert.equal(report.summary.perfectResponseCount, 15);
    const row = report.results.find(r => pair(r) === pair(control));
    assert.equal(row.score, control.expected.score, control.id);
    assert.equal(row.hardFailure, control.expected.hardFailure, control.id);
    assert.equal(report.summary.temporalIntegrityFailureCount, Number(control.expected.hardFailure));
    for (const other of report.results.filter(r => pair(r) !== pair(control))) assert.equal(other.score,100);
    if (row.hardFailure) temporal++; else answerOnly++;
  }
  assert.equal(temporal, 10); assert.equal(answerOnly, 6);
  console.log('All 16 one-field errors rejected: 10 temporal, 6 answer/comparability. Unchanged reference passed. Frozen scorer unchanged.');
} finally { fs.rmSync(temp, {recursive: true, force: true}); }
