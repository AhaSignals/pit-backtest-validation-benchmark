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

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};
const stable = (value) => JSON.stringify(canonicalize(value));
const sameSet = (left, right) => stable([...left].sort()) === stable([...right].sort());
const accessionPattern = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/;
const allowedFields = ['answer', 'caseId', 'citedAccessions', 'evidenceIds', 'excludedAccessions', 'explanation', 'responseStatus', 'track'].sort();

const validateRecord = (record, lineNumber) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`Submission line ${lineNumber} must be a JSON object.`);
  if (stable(Object.keys(record).sort()) !== stable(allowedFields)) throw new Error(`Submission line ${lineNumber} must contain exactly the required schema fields.`);
  if (!/^AS-PIT-00[1-8]$/.test(record.caseId)) throw new Error(`Invalid caseId on submission line ${lineNumber}.`);
  if (!['retrieval', 'knowledge-contamination'].includes(record.track)) throw new Error(`Invalid track on submission line ${lineNumber}.`);
  if (!['answered', 'abstained'].includes(record.responseStatus)) throw new Error(`Invalid responseStatus on submission line ${lineNumber}.`);
  for (const field of ['citedAccessions', 'evidenceIds', 'excludedAccessions']) {
    if (!Array.isArray(record[field]) || new Set(record[field]).size !== record[field].length) throw new Error(`${field} must be a unique array on submission line ${lineNumber}.`);
  }
  for (const field of ['citedAccessions', 'excludedAccessions']) {
    if (!record[field].every((value) => typeof value === 'string' && accessionPattern.test(value))) throw new Error(`${field} contains an invalid accession on submission line ${lineNumber}.`);
  }
  if (!record.evidenceIds.every((value) => typeof value === 'string' && value.length > 0)) throw new Error(`evidenceIds contains an invalid value on submission line ${lineNumber}.`);
  if (typeof record.explanation !== 'string' || record.explanation.length < 20) throw new Error(`explanation is too short on submission line ${lineNumber}.`);
};

const lines = fs.readFileSync(submissionPath, 'utf8').trim().split('\n').filter(Boolean);
const responses = lines.map((line, index) => {
  try {
    const record = JSON.parse(line);
    validateRecord(record, index + 1);
    return record;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON on submission line ${index + 1}: ${error.message}`);
    throw error;
  }
});

const caseById = Object.fromEntries(benchmark.cases.map((item) => [item.caseId, item]));
const expectedPairs = benchmark.cases.flatMap((item) => benchmark.design.tracks.map((track) => `${item.caseId}:${track.trackId}`));
const actualPairs = responses.map((item) => `${item.caseId}:${item.track}`);
if (responses.length !== expectedPairs.length || new Set(actualPairs).size !== expectedPairs.length || expectedPairs.some((pair) => !actualPairs.includes(pair))) {
  throw new Error(`Submission must contain exactly one response for each of the ${expectedPairs.length} case-track pairs.`);
}

const results = responses.map((response) => {
  const testCase = caseById[response.caseId];
  const citedFuture = response.citedAccessions.some((accession) => testCase.forbiddenFuture.accessions.includes(accession));
  const futureAnswer = testCase.forbiddenFuture.answers.some((answer) => stable(answer) === stable(response.answer));
  const statusCorrect = response.responseStatus === testCase.expected.responseStatus;
  const temporalAdmissibility = !citedFuture && !futureAnswer && statusCorrect ? 40 : 0;
  const accessionCitation = sameSet(response.citedAccessions, testCase.expected.citedAccessions) ? 25 : 0;
  const answerAccuracy = stable(response.answer) === stable(testCase.expected.answer) ? 20 : 0;
  const abstentionDiscipline = statusCorrect ? 10 : 0;
  const evidenceCompleteness = testCase.expected.evidenceIds.every((id) => response.evidenceIds.includes(id))
    && response.explanation.length >= 20 ? 5 : 0;
  const hardFailure = temporalAdmissibility === 0;
  const omittedKnownFutureAccessions = testCase.forbiddenFuture.accessions.filter((accession) => !response.excludedAccessions.includes(accession));
  return {
    caseId: response.caseId,
    track: response.track,
    status: hardFailure ? 'temporal-integrity-failure' : 'pass',
    hardFailure,
    score: temporalAdmissibility + accessionCitation + answerAccuracy + abstentionDiscipline + evidenceCompleteness,
    dimensions: { temporalAdmissibility, accessionCitation, answerAccuracy, abstentionDiscipline, evidenceCompleteness },
    diagnostics: {
      citedFutureAccession: citedFuture,
      returnedForbiddenFutureAnswer: futureAnswer,
      responseStatusCorrect: statusCorrect,
      omittedKnownFutureAccessions,
    },
  };
});

const report = {
  benchmarkId: benchmark.artifact.id,
  benchmarkVersion: benchmark.artifact.version,
  submission: path.basename(submissionPath),
  schemaValid: true,
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
