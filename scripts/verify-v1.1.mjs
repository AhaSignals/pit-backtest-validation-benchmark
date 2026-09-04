#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = path.join(root, 'data/v1.1');
const read = (filename) => fs.readFileSync(path.join(dataRoot, filename), 'utf8');
const json = (filename) => JSON.parse(read(filename));
const jsonl = (filename) => read(filename).trim().split('\n').map((line) => JSON.parse(line));
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

const benchmark = json('benchmark.json');
const cases = json('decision-cases.json');
const prompts = jsonl('prompts.jsonl');
const responses = jsonl('reference-submission.jsonl');
const adversarial = jsonl('adversarial-submission.jsonl');
const report = json('baseline-report.json');

assert.equal(benchmark.artifact.id, 'ahasignals-financial-ai-pit-integrity-benchmark-v1-1');
assert.equal(benchmark.artifact.version, '1.1.0');
assert.equal(benchmark.artifact.status, 'release-candidate');
assert.equal(benchmark.artifact.versionDoi, null);
assert.equal(benchmark.artifact.conceptDoi, '10.5281/zenodo.22279743');
assert.deepEqual(benchmark.cases, cases.cases);
assert.deepEqual(benchmark.cases.map((item) => item.caseId), ['AS-PIT-001', 'AS-PIT-002', 'AS-PIT-003', 'AS-PIT-004', 'AS-PIT-005', 'AS-PIT-006', 'AS-PIT-007', 'AS-PIT-008']);
assert.equal(prompts.length, 16);
assert.equal(responses.length, 16);
assert.equal(adversarial.length, 16);
assert.equal(new Set(prompts.map((item) => `${item.caseId}:${item.track}`)).size, 16);
assert.equal(new Set(responses.map((item) => `${item.caseId}:${item.track}`)).size, 16);
assert.equal(report.result, 'pass');
assert.equal(report.summary.passedResponseCount, 16);
assert.equal(report.summary.temporalIntegrityFailureCount, 0);
assert.ok(report.results.every((item) => item.score === 100 && item.hardFailure === false));

const contaminated = adversarial.find((item) => item.caseId === 'AS-PIT-007' && item.track === 'knowledge-contamination');
assert.equal(contaminated.responseStatus, 'answered');
assert.equal(contaminated.answer, -111_367_000);
assert.deepEqual(contaminated.citedAccessions, ['0001628280-25-014752']);

const byId = Object.fromEntries(benchmark.cases.map((item) => [item.caseId, item]));
assert.equal(byId['AS-PIT-006'].expected.answer, -121_674_000);
assert.equal(byId['AS-PIT-007'].expected.responseStatus, 'abstained');
assert.equal(byId['AS-PIT-007'].expected.answer, null);
assert.equal(byId['AS-PIT-008'].expected.answer, -111_367_000);
assert.ok(Date.parse(byId['AS-PIT-006'].decisionTime) < Date.parse('2025-03-18T10:04:50.000Z'));
assert.ok(Date.parse(byId['AS-PIT-007'].decisionTime) > Date.parse('2025-03-18T10:04:50.000Z'));
assert.ok(Date.parse(byId['AS-PIT-007'].decisionTime) < Date.parse('2025-03-25T20:49:29.000Z'));
assert.ok(Date.parse(byId['AS-PIT-008'].decisionTime) > Date.parse('2025-03-25T20:49:29.000Z'));

const payload = structuredClone(benchmark);
delete payload.integrity;
assert.equal(sha256(JSON.stringify(payload)), benchmark.integrity.payloadSha256);

const expected = ['benchmark.json', 'decision-cases.json', 'prompts.jsonl', 'reference-submission.jsonl', 'adversarial-submission.jsonl', 'baseline-report.json', 'schema.json', 'submission-schema.json'];
const checksumLines = read('checksums.sha256').trim().split('\n');
for (const filename of expected) {
  const line = checksumLines.find((candidate) => candidate.endsWith(`  ${filename}`));
  assert.ok(line, `Missing checksum for ${filename}`);
  assert.equal(line.split('  ')[0], sha256(read(filename)), `Checksum mismatch for ${filename}`);
}

const frozenV1Files = {
  'benchmark.json': '259bf36b1943101ed66eaf899e0f93a658f6f79c53c73e9234fa71e4aaf363b6',
  'observation-vintages.csv': 'deb452156a9d493ae12c2691142820b2755fa2534dfa75d8169a526a49562b8b',
  'decision-cases.json': '746ea478f9f5194aadc3d3faafbe1163def45d18774197a0ae55b5c59f3ac334',
  'baseline-report.json': '88e5dfa998bf181ba38275edd6dc003b5eae4a7912c14a71c948edceb33faade',
  'schema.json': '5971647bb16066b9de8e5d00fdd04539000caacc475c4a4b05f3336445734b15',
  'price-adapter-schema.json': '922e080a8d2d86b751370721024f53a8b6f2b839f476964ee7ffd534410f3098',
  'README.md': '61167c9d6b38f4042099910db1f2dc03b6296099cb6325513c74a93ab7db4a72',
  'CITATION.cff': 'f79852c216ebaf27a6d7b216e120eedb188b603930f98627997950a6c137cce2',
  'citation.bib': '1be3c06831f6217a6742d67f90a66da0067a9859611327e764197167c193ee8f',
};
for (const [filename, expectedHash] of Object.entries(frozenV1Files)) {
  const actual = sha256(fs.readFileSync(path.join(root, 'data/v1', filename), 'utf8'));
  assert.equal(actual, expectedHash, `Frozen v1.0 file changed: ${filename}`);
}

const adversarialRun = spawnSync(process.execPath, ['scripts/score-submission.mjs', 'data/v1.1/adversarial-submission.jsonl'], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(adversarialRun.status, 1, 'Adversarial future-value submission must fail the scorer');
const adversarialReport = JSON.parse(adversarialRun.stdout);
assert.equal(adversarialReport.result, 'fail');
assert.equal(adversarialReport.summary.temporalIntegrityFailureCount, 1);
const failedResponse = adversarialReport.results.find((item) => item.caseId === 'AS-PIT-007' && item.track === 'knowledge-contamination');
assert.equal(failedResponse?.status, 'temporal-integrity-failure');
assert.equal(failedResponse?.hardFailure, true);
assert.equal(failedResponse?.diagnostics.citedFutureAccession, true);
assert.equal(failedResponse?.diagnostics.returnedForbiddenFutureAnswer, true);
assert.equal(failedResponse?.diagnostics.responseStatusCorrect, false);

console.log(`PASS v1.1: ${benchmark.scope.caseCount} cases, ${prompts.length} prompts, ${report.summary.passedResponseCount}/${report.summary.evaluatedResponseCount} reference responses; adversarial future-value leak rejected; v1.0 unchanged.`);
