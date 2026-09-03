#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = path.join(root, 'data/v1');
const read = (filename) => fs.readFileSync(path.join(dataRoot, filename), 'utf8');
const json = (filename) => JSON.parse(read(filename));
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

const benchmark = json('benchmark.json');
const cases = json('decision-cases.json');
const report = json('baseline-report.json');
const observations = read('observation-vintages.csv').trim().split('\n');

assert.equal(benchmark.artifact.id, 'ahasignals-pit-backtest-validation-benchmark-v1');
assert.equal(benchmark.artifact.version, '1.0.0');
assert.equal(benchmark.artifact.status, 'frozen');
assert.deepEqual(benchmark.decisionCases, cases.cases);
assert.deepEqual(benchmark.decisionCases.map((testCase) => testCase.caseId), ['AS-PIT-001', 'AS-PIT-002', 'AS-PIT-003', 'AS-PIT-004', 'AS-PIT-005']);
assert.equal(observations.length, 29, 'Expected one header and 28 vintage observations');

assert.equal(report.result, 'pass');
assert.equal(report.summary.passedCaseCount, 5);
assert.equal(report.summary.failedCaseCount, 0);
assert.equal(report.summary.coreWeaveVintageObservationCount, 28);
assert.equal(report.summary.coreWeaveRevisionSeriesCount, 14);
assert.equal(report.summary.presentationChangeCount, 4);
assert.equal(report.summary.signFlipCount, 1);
assert.equal(report.summary.crossSectionMetricCellCount, 24);
assert.equal(report.summary.crossSectionSourceUpgradeCount, 4);
assert.equal(report.summary.crossSectionNewlyAdmittedIssuerCount, 1);
assert.equal(report.performanceLayer.status, 'not-evaluated');

const byId = Object.fromEntries(benchmark.decisionCases.map((testCase) => [testCase.caseId, testCase]));
assert.equal(byId['AS-PIT-001'].expected.value, 1_212_788_000);
assert.equal(byId['AS-PIT-001'].forbiddenFuture.value, 1_212_000_000);
assert.ok(Date.parse(byId['AS-PIT-001'].expected.acceptedAt) <= Date.parse(byId['AS-PIT-001'].decisionTime));
assert.ok(Date.parse(byId['AS-PIT-001'].forbiddenFuture.acceptedAt) > Date.parse(byId['AS-PIT-001'].decisionTime));
assert.equal(byId['AS-PIT-002'].expected.value, 26_109_000);
assert.equal(byId['AS-PIT-002'].forbiddenFuture.value, -6_000_000);
assert.equal(byId['AS-PIT-003'].expected.primaryMatrixEligible, false);
assert.equal(byId['AS-PIT-003'].laterState.primaryMatrixEligible, true);
assert.equal(byId['AS-PIT-004'].expected.valueChanged, false);
assert.equal(byId['AS-PIT-004'].expected.evidenceChanged, true);
assert.equal(byId['AS-PIT-005'].expected.strictSynchronizedRankingAllowed, false);

const payload = structuredClone(benchmark);
delete payload.integrity;
assert.equal(sha256(JSON.stringify(payload)), benchmark.integrity.payloadSha256, 'Benchmark payload hash mismatch');

const checksumLines = read('checksums.sha256').trim().split('\n');
for (const filename of ['benchmark.json', 'observation-vintages.csv', 'decision-cases.json', 'baseline-report.json', 'schema.json', 'price-adapter-schema.json']) {
  const line = checksumLines.find((candidate) => candidate.endsWith(`  ${filename}`));
  assert.ok(line, `Missing checksum for ${filename}`);
  assert.equal(line.split('  ')[0], sha256(read(filename)), `Checksum mismatch for ${filename}`);
}

console.log(`PASS: ${report.summary.passedCaseCount}/${report.summary.caseCount} cases, ${report.summary.coreWeaveVintageObservationCount} vintage observations, payload ${benchmark.integrity.payloadSha256}`);
