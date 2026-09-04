import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
export const sha256File = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
export const canonicalize = (value) => Array.isArray(value)
  ? value.map(canonicalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
    : value;
export const stable = (value) => JSON.stringify(canonicalize(value));

export function parseArgs(argv) {
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) throw new Error(`Unexpected positional argument: ${item}`);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) flags.add(item);
    else {
      values.set(item, next);
      index += 1;
    }
  }
  return {
    has: (name) => flags.has(name) || values.has(name),
    get: (name, fallback = null) => values.get(name) ?? fallback,
  };
}

export function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function validateRunIdentity({ operator, model }) {
  if (!model || model.length > 160 || /[\r\n\0]/.test(model)) throw new Error('--model must be a single-line exact model ID of 160 characters or fewer.');
  if (!operator || operator.trim().length < 2 || operator.length > 160 || /[\r\n\0]/.test(operator)) throw new Error('--operator must be a single-line person or organization name of 2–160 characters.');
  if (operator.trim().toLowerCase() === 'ahasignals') throw new Error('AhaSignals-operated runs belong under run:operator, not the independent registry.');
}

export function assertSupportedNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(major) || major < 18) throw new Error('Node.js 18 or later is required.');
}

export function discoverCodex(explicitPath = null) {
  const candidates = [
    explicitPath,
    process.env.CODEX_BIN,
    'codex',
    process.platform === 'darwin' ? '/Applications/ChatGPT.app/Contents/Resources/codex' : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return { binary: candidate, version: probe.stdout.trim() };
  }
  throw new Error('Codex CLI was not found. Install it or pass --codex-bin /path/to/codex.');
}

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
  'AS-PIT-005': { type: 'object', additionalProperties: false, required: ['strictSynchronizedRankingAllowed', 'periodEnds'], properties: { strictSynchronizedRankingAllowed: { type: 'boolean' }, periodEnds: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['ticker', 'fiscalPeriod', 'periodEnded'], properties: { ticker: { type: 'string' }, fiscalPeriod: { type: 'string' }, periodEnded: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } } } } } },
  'AS-PIT-006': { type: 'number' },
  'AS-PIT-007': { type: ['number', 'null'] },
  'AS-PIT-008': { type: 'number' },
};

export function outputSchemaFor(caseId) {
  return {
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
  };
}

export function loadTasks() {
  const dataRoot = path.join(root, 'data/v1.1');
  const benchmark = readJson(path.join(dataRoot, 'benchmark.json'));
  const evidencePackagePath = path.join(root, 'operator/evidence-v1.1.json');
  const evidencePackage = readJson(evidencePackagePath);
  const prompts = fs.readFileSync(path.join(dataRoot, 'prompts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const evidenceByCase = Object.fromEntries(evidencePackage.cases.map((item) => [item.caseId, item.evidence]));
  const tasks = prompts.map((prompt) => {
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
    return {
      source: prompt,
      materialized: { ...prompt, operatorProtocol: 'closed-evidence-v1', materializedEvidence: visibleEvidence, executionPrompt },
      executionPrompt,
      schema: outputSchemaFor(prompt.caseId),
    };
  });
  return { benchmark, evidencePackagePath, tasks };
}

export function runFrozenVerification() {
  const verification = spawnSync(process.execPath, [path.join(root, 'scripts/verify-v1.1.mjs')], { cwd: root, encoding: 'utf8' });
  if (verification.status !== 0) throw new Error(`Frozen benchmark verification failed:\n${verification.stdout}${verification.stderr}`);
  return verification.stdout.trim();
}

function extractOpenAiText(payload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n');
}

export function createCodexAdapter({ model, reasoningEffort, codexBin }) {
  const detected = discoverCodex(codexBin);
  return {
    metadata: { provider: 'OpenAI', requestedModel: model, resolvedProviderSnapshot: null, interface: 'Codex CLI', clientVersion: detected.version, reasoningEffort, temperature: null, seed: null },
    policies: { networkPolicy: 'model instructed not to browse; frozen evidence cards only', filesystemPolicy: 'read-only empty temporary directory' },
    async execute(task) {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ahasignals-pit-independent-'));
      try {
        const responseFile = path.join(tempRoot, 'response.json');
        const schemaFile = path.join(tempRoot, 'response-schema.json');
        fs.writeFileSync(schemaFile, `${JSON.stringify(task.schema, null, 2)}\n`);
        const invocation = spawnSync(detected.binary, [
          'exec', '--ephemeral', '--ignore-user-config', '--ignore-rules',
          '--model', model,
          '-c', `model_reasoning_effort="${reasoningEffort}"`,
          '--sandbox', 'read-only', '--skip-git-repo-check', '--cd', tempRoot,
          '--output-schema', schemaFile, '--json', '--output-last-message', responseFile,
          task.executionPrompt,
        ], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
        const responseText = fs.existsSync(responseFile) ? fs.readFileSync(responseFile, 'utf8') : '';
        const toolPattern = /"type":"(?:command_execution|web_search|mcp_tool_call|tool_call)"/g;
        return {
          exitStatus: invocation.status,
          responseText,
          toolUseCount: (invocation.stdout.match(toolPattern) || []).length,
          rawEvent: { interface: 'Codex CLI', exitStatus: invocation.status, stdout: invocation.stdout, stderr: invocation.stderr },
        };
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    },
  };
}

export function createOpenAiAdapter({ model, reasoningEffort, apiKey, baseUrl = 'https://api.openai.com/v1' }) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for --provider openai.');
  const endpoint = `${baseUrl.replace(/\/$/, '')}/responses`;
  return {
    metadata: { provider: 'OpenAI', requestedModel: model, resolvedProviderSnapshot: null, interface: 'OpenAI Responses API', clientVersion: 'direct-rest-v1', reasoningEffort, temperature: null, seed: null },
    policies: { networkPolicy: 'no tools requested; frozen evidence cards are the complete request evidence', filesystemPolicy: 'not applicable to provider API' },
    async execute(task) {
      const body = {
        model,
        input: task.executionPrompt,
        store: false,
        text: { format: { type: 'json_schema', name: 'pit_response', strict: true, schema: task.schema } },
      };
      if (reasoningEffort) body.reasoning = { effort: reasoningEffort };
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (error) {
        return {
          exitStatus: 1,
          responseText: '',
          toolUseCount: 0,
          rawEvent: { interface: 'OpenAI Responses API', request: { ...body, input: task.executionPrompt }, transportError: { name: error.name, message: error.message } },
        };
      }
      const responseBody = await response.text();
      let payload = null;
      try { payload = JSON.parse(responseBody); } catch {}
      return {
        exitStatus: response.ok ? 0 : response.status,
        responseText: payload ? extractOpenAiText(payload) : '',
        toolUseCount: (payload?.output || []).filter((item) => !['message', 'reasoning'].includes(item.type)).length,
        rawEvent: { interface: 'OpenAI Responses API', httpStatus: response.status, requestId: response.headers.get('x-request-id'), request: { ...body, input: task.executionPrompt }, response: payload || responseBody },
        resolvedProviderSnapshot: payload?.model || null,
      };
    },
  };
}

export function writeJsonl(filename, records) {
  fs.writeFileSync(filename, `${records.map(JSON.stringify).join('\n')}\n`);
}

export function scoreSubmission(submissionPath) {
  const scored = spawnSync(process.execPath, [path.join(root, 'scripts/score-submission.mjs'), submissionPath], { cwd: root, encoding: 'utf8' });
  if (!scored.stdout.trim()) throw new Error(`Scorer produced no report: ${scored.stderr}`);
  return { report: JSON.parse(scored.stdout), exitStatus: scored.status };
}

export function createSubmissionNote({ runId, operator, provider, model, result, score }) {
  return `# Independent result submission\n\n- Run ID: \`${runId}\`\n- Operator or organization: ${operator}\n- Benchmark: AhaSignals Financial AI Point-in-Time Integrity Benchmark v1.1.0\n- Version DOI: https://doi.org/10.5281/zenodo.22289017\n- Provider: ${provider}\n- Requested model: \`${model}\`\n- Result: **${result}**\n- Perfect responses: ${score.perfectResponseCount}/${score.responseCount}\n- Temporal-integrity failures: ${score.temporalIntegrityFailureCount}\n\nThis directory preserves the assembled prompts, raw provider responses, normalized submission, deterministic score and SHA-256 checksums. Model-access claims remain attributable to the submitter; AhaSignals can verify the public files and deterministic score but does not independently certify provider access.\n`;
}

export function finalizeRun({ runRoot, runId, operator, adapter, benchmark, evidencePackagePath, startedAt, assembledPrompts, rawEvents, rawResponses, submissions, resolvedProviderSnapshot, toolUseCount }) {
  writeJsonl(path.join(runRoot, 'prompts.jsonl'), assembledPrompts);
  writeJsonl(path.join(runRoot, 'raw-events.jsonl'), rawEvents);
  writeJsonl(path.join(runRoot, 'raw-responses.jsonl'), rawResponses);
  writeJsonl(path.join(runRoot, 'submission.jsonl'), submissions);
  const score = scoreSubmission(path.join(runRoot, 'submission.jsonl')).report;
  fs.writeFileSync(path.join(runRoot, 'score-report.json'), `${JSON.stringify(score, null, 2)}\n`);
  const completedAt = new Date().toISOString();
  const note = createSubmissionNote({ runId, operator, provider: adapter.metadata.provider, model: adapter.metadata.requestedModel, result: score.result, score: score.summary });
  fs.writeFileSync(path.join(runRoot, 'SUBMISSION.md'), note);
  const artifactNames = ['prompts.jsonl', 'raw-events.jsonl', 'raw-responses.jsonl', 'submission.jsonl', 'score-report.json', 'SUBMISSION.md'];
  const artifacts = Object.fromEntries(artifactNames.map((filename) => [filename, sha256File(path.join(runRoot, filename))]));
  const manifest = {
    runId,
    resultClass: 'independent',
    operator,
    benchmark: { id: benchmark.artifact.id, version: benchmark.artifact.version, versionDoi: benchmark.artifact.versionDoi, frozenChecksums: 'data/v1.1/checksums.sha256' },
    model: { ...adapter.metadata, resolvedProviderSnapshot: resolvedProviderSnapshot || adapter.metadata.resolvedProviderSnapshot || null },
    execution: {
      startedAt,
      completedAt,
      promptAssemblyVersion: 'closed-evidence-v1',
      evidencePackage: 'operator/evidence-v1.1.json',
      evidencePackageSha256: sha256File(evidencePackagePath),
      contextIsolation: 'one fresh request or ephemeral context per case-track pair',
      networkPolicy: adapter.policies.networkPolicy,
      filesystemPolicy: adapter.policies.filesystemPolicy,
      retryPolicy: 'one attempt per prompt; zero retries',
      manualAnswerEdits: false,
      responseCount: submissions.length,
      toolUseCount,
    },
    artifacts,
    score: score.summary,
    result: score.result,
    boundary: 'Submitter-operated independent result. AhaSignals verifies the public artifact structure and deterministic score but does not certify model-access claims, general model quality or investment performance.',
  };
  fs.writeFileSync(path.join(runRoot, 'run-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const checksumNames = [...artifactNames, 'run-manifest.json'];
  fs.writeFileSync(path.join(runRoot, 'checksums.sha256'), `${checksumNames.map((filename) => `${sha256File(path.join(runRoot, filename))}  ${filename}`).join('\n')}\n`);
  return { manifest, score, completedAt };
}

export function registerIndependentRun(manifest, relativeManifestPath) {
  const registryPath = path.join(root, 'results/index.json');
  const registry = readJson(registryPath);
  if (registry.independentRuns.some((entry) => entry.runId === manifest.runId)) throw new Error(`Run ID already exists in registry: ${manifest.runId}`);
  registry.updatedAt = manifest.execution.completedAt.slice(0, 10);
  registry.independentRuns.push({
    runId: manifest.runId,
    path: relativeManifestPath,
    operator: manifest.operator,
    provider: manifest.model.provider,
    requestedModel: manifest.model.requestedModel,
    completedAt: manifest.execution.completedAt,
    result: manifest.result,
    perfectResponseCount: manifest.score.perfectResponseCount,
    responseCount: manifest.score.responseCount,
    temporalIntegrityFailureCount: manifest.score.temporalIntegrityFailureCount,
    meanScore: manifest.score.meanScore,
  });
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}
