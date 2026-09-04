#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
if (!args.includes('--execute')) throw new Error('Refusing to run without --execute. This command creates a public operator-run candidate.');

const requestedModel = arg('--model', 'gpt-5.6-sol');
const reasoningEffort = arg('--reasoning', 'high');
const operator = arg('--operator', 'AhaSignals');
const now = new Date();
const runId = arg('--run-id', `openai-${requestedModel}-${now.toISOString().replace(/[:.]/g, '-').toLowerCase()}`);
if (!/^[a-z0-9][a-z0-9._-]+$/.test(runId)) throw new Error('run-id must contain lowercase letters, numbers, dots, underscores or hyphens.');

const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const sha256File = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const dataRoot = path.join(root, 'data/v1.1');
const benchmark = readJson(path.join(dataRoot, 'benchmark.json'));
const evidencePackagePath = path.join(root, 'operator/evidence-v1.1.json');
const evidencePackage = readJson(evidencePackagePath);
const prompts = fs.readFileSync(path.join(dataRoot, 'prompts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const evidenceByCase = Object.fromEntries(evidencePackage.cases.map((item) => [item.caseId, item.evidence]));
const codexBin = arg('--codex-bin', process.env.CODEX_BIN || '/Applications/ChatGPT.app/Contents/Resources/codex');
const clientVersionRun = spawnSync(codexBin, ['--version'], { encoding: 'utf8' });
if (clientVersionRun.status !== 0) throw new Error(`Cannot read Codex client version: ${clientVersionRun.stderr}`);
const clientVersion = clientVersionRun.stdout.trim();
const runRoot = path.join(root, 'results/operator-run', runId);
if (fs.existsSync(runRoot)) throw new Error(`Run directory already exists: ${runRoot}`);
fs.mkdirSync(runRoot, { recursive: true });

const answerFormats = {
  'AS-PIT-001': 'a JSON number in USD',
  'AS-PIT-002': 'an object with exactly {"value": number, "sign": "positive" | "negative" | "zero"}',
  'AS-PIT-003': 'an object with exactly {"sourceStatus": string, "primaryMatrixEligible": boolean}',
  'AS-PIT-004': 'an object with exactly {"valueChanged": boolean, "evidenceChanged": boolean, "priorComparabilityTier": string, "laterComparabilityTier": string}',
  'AS-PIT-005': 'an object with exactly {"strictSynchronizedRankingAllowed": boolean, "periodEnds": [{"ticker": string, "fiscalPeriod": string, "periodEnded": YYYY-MM-DD}, ...]}',
  'AS-PIT-006': 'a JSON number in USD',
  'AS-PIT-007': 'a JSON number in USD, or null when abstaining',
  'AS-PIT-008': 'a JSON number in USD',
};

const answerSchemas = {
  'AS-PIT-001': { type: 'number' },
  'AS-PIT-002': { type: 'object', additionalProperties: false, required: ['value', 'sign'], properties: { value: { type: 'number' }, sign: { enum: ['positive', 'negative', 'zero'] } } },
  'AS-PIT-003': { type: 'object', additionalProperties: false, required: ['sourceStatus', 'primaryMatrixEligible'], properties: { sourceStatus: { type: 'string' }, primaryMatrixEligible: { type: 'boolean' } } },
  'AS-PIT-004': { type: 'object', additionalProperties: false, required: ['valueChanged', 'evidenceChanged', 'priorComparabilityTier', 'laterComparabilityTier'], properties: { valueChanged: { type: 'boolean' }, evidenceChanged: { type: 'boolean' }, priorComparabilityTier: { type: 'string' }, laterComparabilityTier: { type: 'string' } } },
  'AS-PIT-005': { type: 'object', additionalProperties: false, required: ['strictSynchronizedRankingAllowed', 'periodEnds'], properties: { strictSynchronizedRankingAllowed: { type: 'boolean' }, periodEnds: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['ticker', 'fiscalPeriod', 'periodEnded'], properties: { ticker: { type: 'string' }, fiscalPeriod: { type: 'string' }, periodEnded: { type: 'string' } } } } } },
  'AS-PIT-006': { type: 'number' },
  'AS-PIT-007': { type: ['number', 'null'] },
  'AS-PIT-008': { type: 'number' },
};

const outputSchemaFor = (caseId) => ({
  type: 'object',
  additionalProperties: false,
  required: ['caseId', 'track', 'responseStatus', 'answer', 'citedAccessions', 'evidenceIds', 'excludedAccessions', 'explanation'],
  properties: {
    caseId: { type: 'string' },
    track: { enum: ['retrieval', 'knowledge-contamination'] },
    responseStatus: { enum: ['answered', 'abstained'] },
    answer: answerSchemas[caseId],
    citedAccessions: { type: 'array', items: { type: 'string' } },
    evidenceIds: { type: 'array', items: { type: 'string' } },
    excludedAccessions: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
  },
});

const assembledPrompts = [];
const rawEvents = [];
const rawResponses = [];
const submissions = [];
const startedAt = new Date().toISOString();

for (const prompt of prompts) {
  const allEvidence = evidenceByCase[prompt.caseId];
  if (!allEvidence) throw new Error(`Missing operator evidence for ${prompt.caseId}`);
  const visibleEvidence = prompt.track === 'retrieval'
    ? allEvidence.filter((item) => Date.parse(item.acceptedAt) <= Date.parse(prompt.decisionTime))
    : allEvidence;
  const executionPrompt = [
    'You are participating in a financial point-in-time integrity evaluation.',
    'Use only the evidence cards included below. Do not browse, use tools, inspect files, or rely on outside sources.',
    'Treat SEC acceptedAt as the public-information clock. Select evidence by acceptedAt before extracting or comparing facts.',
    'A later comparative must not be imported into an earlier decision. If a controlling non-reliance notice is public and no restated value is yet public, abstain.',
    'Return only one JSON object matching the required response contract. Do not add markdown or commentary outside JSON.',
    `caseId: ${prompt.caseId}`,
    `track: ${prompt.track}`,
    `decisionTime: ${prompt.decisionTime}`,
    `task: ${prompt.task}`,
    `answer field format: ${answerFormats[prompt.caseId]}`,
    'citedAccessions must contain only the accession(s) controlling the answer at decisionTime.',
    'evidenceIds must contain the factId values supporting the answer. excludedAccessions should list visible accessions rejected because acceptedAt is later than decisionTime.',
    'If responseStatus is abstained, answer must be null.',
    `evidence cards: ${JSON.stringify(visibleEvidence)}`,
    'Required response fields: caseId, track, responseStatus, answer, citedAccessions, evidenceIds, excludedAccessions, explanation.',
  ].join('\n');
  assembledPrompts.push({ ...prompt, operatorProtocol: 'closed-evidence-v1', materializedEvidence: visibleEvidence, executionPrompt });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ahasignals-pit-run-'));
  const responseFile = path.join(tempRoot, 'response.json');
  const outputSchema = path.join(tempRoot, 'response-schema.json');
  fs.writeFileSync(outputSchema, `${JSON.stringify(outputSchemaFor(prompt.caseId), null, 2)}\n`);
  const invocation = spawnSync(codexBin, [
    'exec', '--ephemeral', '--ignore-user-config', '--ignore-rules',
    '--model', requestedModel,
    '-c', `model_reasoning_effort="${reasoningEffort}"`,
    '--sandbox', 'read-only', '--skip-git-repo-check', '--cd', tempRoot,
    '--output-schema', outputSchema, '--json', '--output-last-message', responseFile,
    executionPrompt,
  ], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const responseText = fs.existsSync(responseFile) ? fs.readFileSync(responseFile, 'utf8') : '';
  let response = null;
  try { response = JSON.parse(responseText); } catch {}
  rawEvents.push({ caseId: prompt.caseId, track: prompt.track, exitStatus: invocation.status, stdout: invocation.stdout, stderr: invocation.stderr });
  rawResponses.push({ caseId: prompt.caseId, track: prompt.track, exitStatus: invocation.status, responseText, parsed: response });
  if (invocation.status !== 0 || !response) {
    fs.writeFileSync(path.join(runRoot, 'prompts.jsonl'), `${assembledPrompts.map(JSON.stringify).join('\n')}\n`);
    fs.writeFileSync(path.join(runRoot, 'raw-events.jsonl'), `${rawEvents.map(JSON.stringify).join('\n')}\n`);
    fs.writeFileSync(path.join(runRoot, 'raw-responses.jsonl'), `${rawResponses.map(JSON.stringify).join('\n')}\n`);
    throw new Error(`Model execution failed or returned invalid JSON for ${prompt.caseId}:${prompt.track}. Raw evidence retained in ${runRoot}.`);
  }
  submissions.push(response);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const writeJsonl = (filename, records) => fs.writeFileSync(path.join(runRoot, filename), `${records.map(JSON.stringify).join('\n')}\n`);
writeJsonl('prompts.jsonl', assembledPrompts);
writeJsonl('raw-events.jsonl', rawEvents);
writeJsonl('raw-responses.jsonl', rawResponses);
writeJsonl('submission.jsonl', submissions);

const scoreRun = spawnSync(process.execPath, [path.join(root, 'scripts/score-submission.mjs'), path.join(runRoot, 'submission.jsonl')], { cwd: root, encoding: 'utf8' });
if (!scoreRun.stdout.trim()) throw new Error(`Scorer produced no report: ${scoreRun.stderr}`);
const score = JSON.parse(scoreRun.stdout);
fs.writeFileSync(path.join(runRoot, 'score-report.json'), `${JSON.stringify(score, null, 2)}\n`);

const toolPattern = /"type":"(?:command_execution|web_search|mcp_tool_call|tool_call)"/g;
const toolUseCount = rawEvents.reduce((sum, item) => sum + ((item.stdout.match(toolPattern) || []).length), 0);
const artifactNames = ['prompts.jsonl', 'raw-events.jsonl', 'raw-responses.jsonl', 'submission.jsonl', 'score-report.json'];
const artifactHashes = Object.fromEntries(artifactNames.map((filename) => [filename, sha256File(path.join(runRoot, filename))]));
const completedAt = new Date().toISOString();
const manifest = {
  runId,
  resultClass: 'operator-run',
  operator,
  benchmark: { id: benchmark.artifact.id, version: benchmark.artifact.version, versionDoi: benchmark.artifact.versionDoi, frozenChecksums: 'data/v1.1/checksums.sha256' },
  model: { provider: 'OpenAI', requestedModel, resolvedProviderSnapshot: null, interface: 'Codex CLI', clientVersion, reasoningEffort, temperature: null, seed: null },
  execution: {
    startedAt, completedAt, promptAssemblyVersion: 'closed-evidence-v1', evidencePackage: 'operator/evidence-v1.1.json', evidencePackageSha256: sha256File(evidencePackagePath),
    contextIsolation: 'one fresh ephemeral context per case-track pair', networkPolicy: 'model instructed not to browse; frozen evidence cards only', filesystemPolicy: 'read-only empty temporary directory',
    retryPolicy: 'one attempt per prompt; zero retries', manualAnswerEdits: false, responseCount: submissions.length, toolUseCount,
  },
  artifacts: artifactHashes,
  score: score.summary,
  result: score.result,
  boundary: 'AhaSignals-operated pilot result. It is not an independent submission, a general model ranking, an investment-performance result or an assurance engagement.',
};
fs.writeFileSync(path.join(runRoot, 'run-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const checksumNames = [...artifactNames, 'run-manifest.json'];
fs.writeFileSync(path.join(runRoot, 'checksums.sha256'), `${checksumNames.map((filename) => `${sha256File(path.join(runRoot, filename))}  ${filename}`).join('\n')}\n`);

const registryPath = path.join(root, 'results/index.json');
const registry = readJson(registryPath);
registry.updatedAt = completedAt.slice(0, 10);
registry.operatorRuns.push({
  runId, path: `operator-run/${runId}/run-manifest.json`, operator, provider: manifest.model.provider, requestedModel, completedAt,
  result: score.result, perfectResponseCount: score.summary.perfectResponseCount, responseCount: score.summary.responseCount,
  temporalIntegrityFailureCount: score.summary.temporalIntegrityFailureCount, meanScore: score.summary.meanScore,
});
fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(JSON.stringify({ runId, runRoot, result: score.result, summary: score.summary, toolUseCount }, null, 2));
