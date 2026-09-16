// Synthetic single-field response changes, separate from the frozen benchmark.
const clone = value => JSON.parse(JSON.stringify(value));
export const controlSpecs = [
  { caseId: 'AS-PIT-001', field: 'answer', label: 'Backfill the later revenue comparative', mode: 'future-answer', score: 40, hardFailure: true },
  { caseId: 'AS-PIT-002', field: 'answer', label: 'Backfill the later investing-cash sign', mode: 'future-answer', score: 40, hardFailure: true },
  { caseId: 'AS-PIT-003', field: 'answer', label: 'Treat preliminary evidence as a filed record', mode: 'future-answer', score: 40, hardFailure: true },
  { caseId: 'AS-PIT-004', field: 'answer.evidenceChanged', label: 'Hide the source upgrade behind an unchanged value', value: false, score: 80, hardFailure: false },
  { caseId: 'AS-PIT-005', field: 'answer.strictSynchronizedRankingAllowed', label: 'Allow a synchronized ranking while retaining unequal period ends', value: true, score: 80, hardFailure: false },
  { caseId: 'AS-PIT-006', field: 'citedAccessions', label: 'Cite the later restatement before non-reliance', mode: 'future-accession', score: 35, hardFailure: true },
  { caseId: 'AS-PIT-007', field: 'responseStatus', label: 'Claim to have answered during the non-reliance window', value: 'answered', score: 50, hardFailure: true },
  { caseId: 'AS-PIT-008', field: 'answer', label: 'Retain the withdrawn prior value after restatement', mode: 'prior-answer', score: 80, hardFailure: false },
];
export function makeControls(benchmark, reference) {
  return controlSpecs.flatMap((spec, i) => reference.filter(r => r.caseId === spec.caseId).map(original => {
    const c = benchmark.cases.find(c => c.caseId === spec.caseId);
    const changed = clone(original);
    const keys = spec.field.split('.');
    const parent = keys.slice(0, -1).reduce((obj, key) => obj[key], changed);
    const key = keys.at(-1), before = clone(parent[key]);
    let after = spec.value;
    if (spec.mode === 'future-answer') after = c.forbiddenFuture.answers[0];
    if (spec.mode === 'future-accession') after = [c.forbiddenFuture.accessions.at(-1)];
    if (spec.mode === 'prior-answer') after = benchmark.cases.find(c => c.caseId === 'AS-PIT-006').expected.answer;
    parent[key] = clone(after);
    return {
      id: `PIT-CTRL-${String(i + 1).padStart(3, '0')}-${original.track}`,
      caseId: spec.caseId, track: original.track, label: spec.label,
      synthetic: true, changedField: spec.field, before, after: clone(after),
      reference: clone(original), changed,
      expected: { result: 'fail', score: spec.score, hardFailure: spec.hardFailure },
      caseUrl: `https://ahasignals.com/research/point-in-time-financial-data/#${spec.caseId}`,
    };
  }));
}
