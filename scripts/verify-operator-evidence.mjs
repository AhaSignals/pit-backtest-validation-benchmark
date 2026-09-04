#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const benchmark = JSON.parse(fs.readFileSync(path.join(root, 'data/v1.1/benchmark.json'), 'utf8'));
const evidencePackage = JSON.parse(fs.readFileSync(path.join(root, 'operator/evidence-v1.1.json'), 'utf8'));
assert.equal(evidencePackage.benchmarkVersion, benchmark.artifact.version);
assert.deepEqual(evidencePackage.cases.map((item) => item.caseId), benchmark.cases.map((item) => item.caseId));

const cardsByCase = Object.fromEntries(evidencePackage.cases.map((item) => [item.caseId, item.evidence]));
for (const testCase of benchmark.cases) {
  const cards = cardsByCase[testCase.caseId];
  assert.equal(cards.length, testCase.sourceEvidence.length, `${testCase.caseId} evidence-card count`);
  for (const source of testCase.sourceEvidence) {
    const card = cards.find((item) => item.accession === source.accession);
    assert.ok(card, `${testCase.caseId} missing accession ${source.accession}`);
    assert.equal(Date.parse(card.acceptedAt), Date.parse(source.acceptedAt), `${testCase.caseId} acceptedAt mismatch`);
    if (new URL(source.url).hostname === 'www.sec.gov') {
      assert.equal(card.filingUrl, source.url, `${testCase.caseId} filing URL mismatch`);
    } else {
      const sourceObjectId = path.basename(new URL(source.url).pathname, '.json');
      assert.equal(card.factId, sourceObjectId, `${testCase.caseId} derived evidence-object mismatch`);
      assert.equal(new URL(card.filingUrl).hostname, 'www.sec.gov', `${testCase.caseId} operator card must retain the underlying SEC filing URL`);
    }
  }
  for (const accession of [...testCase.expected.citedAccessions, ...testCase.forbiddenFuture.accessions]) {
    assert.ok(cards.some((item) => item.accession === accession), `${testCase.caseId} expected or forbidden accession missing from cards`);
  }
}

const eligible = (caseId) => {
  const testCase = benchmark.cases.find((item) => item.caseId === caseId);
  return cardsByCase[caseId].filter((item) => Date.parse(item.acceptedAt) <= Date.parse(testCase.decisionTime));
};
assert.equal(eligible('AS-PIT-001')[0].facts.value, 1_212_788_000);
assert.deepEqual({ value: eligible('AS-PIT-002')[0].facts.value, sign: eligible('AS-PIT-002')[0].facts.sign }, { value: 26_109_000, sign: 'positive' });
assert.deepEqual({ sourceStatus: eligible('AS-PIT-003')[0].facts.sourceStatus, primaryMatrixEligible: eligible('AS-PIT-003')[0].facts.primaryMatrixEligible }, { sourceStatus: 'preliminary', primaryMatrixEligible: false });
const upgrade = eligible('AS-PIT-004');
assert.equal(upgrade.length, 2);
assert.equal(upgrade[0].facts.comparisonValueFingerprint, upgrade[1].facts.comparisonValueFingerprint);
assert.deepEqual(upgrade.map((item) => item.facts.comparabilityTier), ['C', 'A']);
assert.deepEqual(eligible('AS-PIT-005').map((item) => item.facts.periodEnded), ['2026-07-26', '2026-06-27']);
assert.equal(eligible('AS-PIT-006').at(-1).facts.value, -121_674_000);
assert.equal(eligible('AS-PIT-007').at(-1).facts.knowledgeState, 'withdrawn-from-reliance');
assert.equal(eligible('AS-PIT-008').at(-1).facts.value, -111_367_000);

console.log('PASS operator evidence: 8 cases match frozen accession metadata and reproduce every expected knowledge state.');
