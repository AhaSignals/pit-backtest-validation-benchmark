#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalize, parseArgs, readJson, root, sha256File } from './lib/independent-runner.mjs';

const stable = (value) => JSON.stringify(canonicalize(value));
const args = parseArgs(process.argv.slice(2).filter((item) => item.startsWith('--')));
const positional = process.argv.slice(2).filter((item) => !item.startsWith('--'));
if (args.has('--help') || positional.length !== 1) {
  console.log('Usage: npm run verify:independent -- results/independent/<run-id>');
  process.exit(args.has('--help') ? 0 : 1);
}

const runRoot = path.resolve(process.cwd(), positional[0]);
const manifestPath = path.join(runRoot, 'run-manifest.json');
assert.ok(fs.existsSync(manifestPath), 'run-manifest.json is required.');
const manifest = readJson(manifestPath);
assert.equal(manifest.resultClass, 'independent');
assert.equal(manifest.benchmark?.version, '1.1.0');
assert.equal(manifest.benchmark?.versionDoi, '10.5281/zenodo.22289017');
assert.ok(typeof manifest.operator === 'string' && manifest.operator.trim().length >= 2);
assert.notEqual(manifest.operator.trim().toLowerCase(), 'ahasignals');
assert.equal(manifest.execution?.manualAnswerEdits, false);
assert.equal(manifest.execution?.retryPolicy, 'one attempt per prompt; zero retries');
assert.equal(manifest.execution?.responseCount, 16);
assert.equal(manifest.execution?.toolUseCount, 0);
assert.equal(manifest.execution?.evidencePackageSha256, sha256File(path.join(root, 'operator/evidence-v1.1.json')));
assert.ok(typeof manifest.model?.provider === 'string' && manifest.model.provider.length > 0);
assert.ok(typeof manifest.model?.requestedModel === 'string' && manifest.model.requestedModel.length > 0);

const requiredArtifacts = ['prompts.jsonl', 'raw-events.jsonl', 'raw-responses.jsonl', 'submission.jsonl', 'score-report.json', 'SUBMISSION.md'];
assert.deepEqual(Object.keys(manifest.artifacts).sort(), requiredArtifacts.sort());
for (const filename of requiredArtifacts) {
  assert.equal(sha256File(path.join(runRoot, filename)), manifest.artifacts[filename], `Artifact hash mismatch: ${filename}`);
}

const checksumLines = fs.readFileSync(path.join(runRoot, 'checksums.sha256'), 'utf8').trim().split('\n');
assert.equal(checksumLines.length, requiredArtifacts.length + 1);
for (const line of checksumLines) {
  const [hash, filename] = line.split('  ');
  assert.ok(filename && !filename.includes('/') && !filename.includes('..'), `Unsafe checksum path: ${filename}`);
  assert.equal(sha256File(path.join(runRoot, filename)), hash, `Checksum mismatch: ${filename}`);
}

const readJsonl = (filename) => fs.readFileSync(path.join(runRoot, filename), 'utf8').trim().split('\n').map(JSON.parse);
const prompts = readJsonl('prompts.jsonl');
const rawEvents = readJsonl('raw-events.jsonl');
const rawResponses = readJsonl('raw-responses.jsonl');
assert.equal(prompts.length, 16);
assert.equal(rawEvents.length, 16);
assert.equal(rawResponses.length, 16);
assert.equal(new Set(prompts.map((item) => `${item.caseId}:${item.track}`)).size, 16);
assert.ok(rawResponses.every((item) => item.exitStatus === 0 && item.parsed), 'Every raw response must be successful and parseable.');

const scored = spawnSync(process.execPath, [path.join(root, 'scripts/score-submission.mjs'), path.join(runRoot, 'submission.jsonl')], { cwd: root, encoding: 'utf8' });
assert.ok(scored.stdout.trim(), `Scorer produced no report: ${scored.stderr}`);
const reproduced = JSON.parse(scored.stdout);
const frozenReport = readJson(path.join(runRoot, 'score-report.json'));
assert.equal(stable(reproduced), stable(frozenReport), 'Score report is not reproducible.');
assert.equal(manifest.result, reproduced.result);
assert.equal(stable(manifest.score), stable(reproduced.summary));

console.log(`PASS independent result ${manifest.runId}: ${reproduced.summary.perfectResponseCount}/${reproduced.summary.responseCount} perfect, ${reproduced.summary.temporalIntegrityFailureCount} temporal-integrity failure(s).`);
