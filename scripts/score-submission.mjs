#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = path.join(root, 'data/v1.1');
const benchmark = JSON.parse(fs.readFileSync(path.join(dataRoot, 'benchmark.json'), 'utf8'));
const submissionPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(dataRoot, 'reference-submission.jsonl');
const lines = fs.readFileSync(submissionPath, 'utf8').trim().split('\n').filter(Boolean);
const responses = lines.map((line, index) => {
  try { return JSON.parse(line); }
  catch (error) { throw new Error(`Invalid JSON on submission line ${index + 1}: ${error.message}`); }
});
const stable = (value) => JSON.stringify(value);
const sameSet = (left, right) => stable([...left].sort()) === stable([...right].sort());
const caseById = Object.fromEntries(benchmark.cases.map((item) => [item.caseId, item]));
const expectedPairs = benchmark.cases.flatMap((item) => benchmark.design.tracks.map((track) => `${item.caseId}:${track.trackId}`));
const actualPairs = responses.map((item) => `${item.caseId}:${item.track}`);

if (responses.length !== expectedPairs.length || new Set(actualPairs).size !== expectedPairs.length || expectedPairs.some((pair) => !actualPairs.includes(pair))) {
  throw new Error(`Submission must contain exactly one response for each of the ${expectedPairs.length} case-track pairs.`);
}

const results = responses.map((response) => {
  const testCase = caseById[response.caseId];
  if (!testCase) throw new Error(`Unknown caseId ${response.caseId}`);
  if (!['retrieval', 'knowledge-contamination'].includes(response.track)) throw new Error(`Unknown track ${response.track}`);
  if (!['answered', 'abstained'].includes(response.responseStatus)) throw new Error(`Invalid responseStatus for ${response.caseId}:${response.track}`);
  for (const field of ['citedAccessions', 'evidenceIds', 'excludedAccessions']) {
    if (!Array.isArray(response[field])) throw new Error(`${field} must be an array for ${response.caseId}:${response.track}`);
  }

  const citedFuture = response.citedAccessions.some((accession) => testCase.forbiddenFuture.accessions.includes(accession));
  const futureAnswer = testCase.forbiddenFuture.answers.some((answer) => stable(answer) === stable(response.answer));
  const statusCorrect = response.responseStatus === testCase.expected.responseStatus;
  const temporalAdmissibility = !citedFuture && !futureAnswer && statusCorrect ? 40 : 0;
  const accessionCitation = sameSet(response.citedAccessions, testCase.expected.citedAccessions) ? 25 : 0;
  const answerAccuracy = stable(response.answer) === stable(testCase.expected.answer) ? 20 : 0;
  const abstentionDiscipline = statusCorrect ? 10 : 0;
  const evidenceCompleteness = testCase.expected.evidenceIds.every((id) => response.evidenceIds.includes(id))
    && typeof response.explanation === 'string'
    && response.explanation.length >= 20 ? 5 : 0;
  const hardFailure = temporalAdmissibility === 0;
  return {
    caseId: response.caseId,
    track: response.track,
    status: hardFailure ? 'temporal-integrity-failure' : 'pass',
    hardFailure,
    score: temporalAdmissibility + accessionCitation + answerAccuracy + abstentionDiscipline + evidenceCompleteness,
    dimensions: { temporalAdmissibility, accessionCitation, answerAccuracy, abstentionDiscipline, evidenceCompleteness },
    diagnostics: { citedFutureAccession: citedFuture, returnedForbiddenFutureAnswer: futureAnswer, responseStatusCorrect: statusCorrect },
  };
});

const report = {
  benchmarkId: benchmark.artifact.id,
  benchmarkVersion: benchmark.artifact.version,
  submission: path.basename(submissionPath),
  result: results.every((item) => item.score === 100 && !item.hardFailure) ? 'pass' : 'fail',
  summary: {
    responseCount: results.length,
    perfectResponseCount: results.filter((item) => item.score === 100 && !item.hardFailure).length,
    temporalIntegrityFailureCount: results.filter((item) => item.hardFailure).length,
    meanScore: results.reduce((sum, item) => sum + item.score, 0) / results.length,
  },
  results,
};

console.log(JSON.stringify(report, null, 2));
if (report.result !== 'pass') process.exitCode = 1;
