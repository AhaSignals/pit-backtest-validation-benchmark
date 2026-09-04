#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const sha256File = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
const stable = (value) => JSON.stringify(canonicalize(value));
const registry = readJson(path.join(root, 'results/index.json'));
assert.equal(registry.benchmarkVersion, '1.1.0');
assert.equal(registry.benchmarkDoi, '10.5281/zenodo.22289017');

const calibration = readJson(path.join(root, 'results/calibration/index.json'));
assert.equal(calibration.resultClass, 'calibration');
for (const entry of calibration.entries) {
  const submission = path.resolve(root, 'results/calibration', entry.submission);
  const scored = spawnSync(process.execPath, [path.join(root, 'scripts/score-submission.mjs'), submission], { cwd: root, encoding: 'utf8' });
  const report = JSON.parse(scored.stdout);
  assert.equal(report.result, entry.expectedResult, `Unexpected calibration result for ${entry.id}`);
  assert.equal(report.summary.temporalIntegrityFailureCount, entry.expectedTemporalIntegrityFailures, `Unexpected temporal failures for ${entry.id}`);
}

for (const entry of registry.operatorRuns) {
  const manifestPath = path.join(root, 'results', entry.path);
  const runRoot = path.dirname(manifestPath);
  const manifest = readJson(manifestPath);
  assert.equal(manifest.runId, entry.runId);
  assert.equal(manifest.resultClass, 'operator-run');
  assert.equal(manifest.benchmark.version, '1.1.0');
  assert.equal(manifest.benchmark.versionDoi, '10.5281/zenodo.22289017');
  assert.equal(manifest.execution.manualAnswerEdits, false);
  assert.equal(manifest.execution.contextIsolation, 'one fresh ephemeral context per case-track pair');
  assert.equal(manifest.execution.retryPolicy, 'one attempt per prompt; zero retries');
  assert.equal(manifest.execution.responseCount, 16);
  assert.equal(manifest.execution.toolUseCount, 0);
  for (const [filename, hash] of Object.entries(manifest.artifacts)) assert.equal(sha256File(path.join(runRoot, filename)), hash, `Artifact hash mismatch: ${entry.runId}/${filename}`);

  const checksumLines = fs.readFileSync(path.join(runRoot, 'checksums.sha256'), 'utf8').trim().split('\n');
  for (const line of checksumLines) {
    const [hash, filename] = line.split('  ');
    assert.equal(sha256File(path.join(runRoot, filename)), hash, `Checksum mismatch: ${entry.runId}/${filename}`);
  }
  const prompts = fs.readFileSync(path.join(runRoot, 'prompts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const rawResponses = fs.readFileSync(path.join(runRoot, 'raw-responses.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(prompts.length, 16);
  assert.equal(rawResponses.length, 16);
  assert.equal(new Set(prompts.map((item) => `${item.caseId}:${item.track}`)).size, 16);
  assert.ok(rawResponses.every((item) => item.exitStatus === 0 && item.parsed));

  const scored = spawnSync(process.execPath, [path.join(root, 'scripts/score-submission.mjs'), path.join(runRoot, 'submission.jsonl')], { cwd: root, encoding: 'utf8' });
  const reproduced = JSON.parse(scored.stdout);
  const frozenReport = readJson(path.join(runRoot, 'score-report.json'));
  assert.equal(stable(reproduced), stable(frozenReport), `Score report is not reproducible: ${entry.runId}`);
  assert.equal(entry.result, reproduced.result);
  assert.equal(entry.temporalIntegrityFailureCount, reproduced.summary.temporalIntegrityFailureCount);
}

for (const entry of registry.independentRuns) {
  const manifestPath = path.join(root, 'results', entry.path);
  const runRoot = path.dirname(manifestPath);
  const verification = spawnSync(process.execPath, [path.join(root, 'scripts/verify-independent-result.mjs'), runRoot], { cwd: root, encoding: 'utf8' });
  assert.equal(verification.status, 0, `Independent result verification failed for ${entry.runId}:\n${verification.stdout}${verification.stderr}`);
  const manifest = readJson(manifestPath);
  assert.equal(manifest.runId, entry.runId);
  assert.equal(manifest.operator, entry.operator);
  assert.equal(manifest.model.provider, entry.provider);
  assert.equal(manifest.model.requestedModel, entry.requestedModel);
  assert.equal(manifest.result, entry.result);
  assert.equal(manifest.score.temporalIntegrityFailureCount, entry.temporalIntegrityFailureCount);
}

console.log(`PASS results registry: ${calibration.entries.length} calibration fixtures, ${registry.operatorRuns.length} operator run(s), ${registry.independentRuns.length} independent run(s).`);
