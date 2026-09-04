#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertSupportedNode,
  createCodexAdapter,
  createOpenAiAdapter,
  finalizeRun,
  loadTasks,
  parseArgs,
  registerIndependentRun,
  root,
  runFrozenVerification,
  slug,
  validateRunIdentity,
  writeJsonl,
} from './lib/independent-runner.mjs';

const help = `Run an independently operated Financial AI PIT Integrity Benchmark.

Usage:
  npm run run:independent -- --provider codex --model MODEL --operator "NAME" --execute
  npm run run:independent -- --provider openai --model MODEL --operator "NAME" --execute

Required:
  --model          exact requested model ID
  --operator       person or organization responsible for the run
  --execute        confirms 16 model requests and possible provider charges

Options:
  --provider       codex (default) or openai
  --reasoning      provider reasoning effort (default: high)
  --run-id         lowercase stable identifier; generated when omitted
  --codex-bin      optional Codex CLI path
  --openai-base-url optional OpenAI-compatible Responses API base URL

Environment:
  OPENAI_API_KEY   required only for --provider openai
  CODEX_BIN        optional alternative to --codex-bin
`;

const args = parseArgs(process.argv.slice(2));
if (args.has('--help')) {
  console.log(help);
  process.exit(0);
}
if (!args.has('--execute')) throw new Error('Refusing to call a model without --execute. Run preflight:independent first.');

const provider = args.get('--provider', 'codex');
const model = args.get('--model');
const operator = args.get('--operator');
const reasoningEffort = args.get('--reasoning', 'high');
assertSupportedNode();
validateRunIdentity({ operator, model });
runFrozenVerification();

let adapter;
if (provider === 'codex') {
  adapter = createCodexAdapter({ model, reasoningEffort, codexBin: args.get('--codex-bin') });
} else if (provider === 'openai') {
  adapter = createOpenAiAdapter({ model, reasoningEffort, apiKey: process.env.OPENAI_API_KEY, baseUrl: args.get('--openai-base-url', 'https://api.openai.com/v1') });
} else {
  throw new Error(`Unsupported provider: ${provider}. Supported providers: codex, openai.`);
}

const now = new Date();
const generatedRunId = `${slug(provider)}-${slug(model)}-${now.toISOString().replace(/[:.]/g, '-').toLowerCase()}`;
const runId = args.get('--run-id', generatedRunId);
if (!/^[a-z0-9][a-z0-9._-]+$/.test(runId)) throw new Error('run-id must contain lowercase letters, numbers, dots, underscores or hyphens.');
const runRoot = path.join(root, 'results/independent', runId);
if (fs.existsSync(runRoot)) throw new Error(`Run directory already exists: ${runRoot}`);
fs.mkdirSync(runRoot, { recursive: true });

const { benchmark, evidencePackagePath, tasks } = loadTasks();
const assembledPrompts = [];
const rawEvents = [];
const rawResponses = [];
const submissions = [];
const startedAt = new Date().toISOString();
let resolvedProviderSnapshot = null;
let toolUseCount = 0;

try {
  for (const task of tasks) {
    assembledPrompts.push(task.materialized);
    const executed = await adapter.execute(task);
    if (executed.resolvedProviderSnapshot) resolvedProviderSnapshot = executed.resolvedProviderSnapshot;
    toolUseCount += executed.toolUseCount || 0;
    let parsed = null;
    try { parsed = JSON.parse(executed.responseText); } catch {}
    rawEvents.push({ caseId: task.source.caseId, track: task.source.track, ...executed.rawEvent });
    rawResponses.push({ caseId: task.source.caseId, track: task.source.track, exitStatus: executed.exitStatus, responseText: executed.responseText, parsed });
    if (executed.exitStatus !== 0 || !parsed) throw new Error(`Model execution failed or returned invalid JSON for ${task.source.caseId}:${task.source.track}.`);
    if (executed.toolUseCount) throw new Error(`Disallowed tool activity detected for ${task.source.caseId}:${task.source.track}.`);
    submissions.push(parsed);
  }

  const { manifest, score } = finalizeRun({ runRoot, runId, operator: operator.trim(), adapter, benchmark, evidencePackagePath, startedAt, assembledPrompts, rawEvents, rawResponses, submissions, resolvedProviderSnapshot, toolUseCount });
  const packagePath = path.join(root, 'results/independent', `${runId}.zip`);
  const packaged = spawnSync(process.execPath, [path.join(root, 'scripts/package-independent-result.mjs'), runRoot, '--output', packagePath], { cwd: root, encoding: 'utf8' });
  if (packaged.status !== 0) throw new Error(`Completed artifacts failed verification or packaging:\n${packaged.stdout}${packaged.stderr}`);
  registerIndependentRun(manifest, `independent/${runId}/run-manifest.json`);
  console.log(JSON.stringify({
    status: 'complete',
    runId,
    runRoot,
    package: packagePath,
    result: score.result,
    summary: score.summary,
    next: `Open a pull request containing results/independent/${runId}/ and its results/index.json entry. The ZIP is a transfer copy and is ignored by Git.`,
  }, null, 2));
} catch (error) {
  if (assembledPrompts.length) writeJsonl(path.join(runRoot, 'prompts.jsonl'), assembledPrompts);
  if (rawEvents.length) writeJsonl(path.join(runRoot, 'raw-events.jsonl'), rawEvents);
  if (rawResponses.length) writeJsonl(path.join(runRoot, 'raw-responses.jsonl'), rawResponses);
  if (submissions.length) writeJsonl(path.join(runRoot, 'submission.partial.jsonl'), submissions);
  fs.writeFileSync(path.join(runRoot, 'INCOMPLETE.md'), `# Incomplete independent run\n\nRun ID: \`${runId}\`\n\nThe runner stopped after the first failed or malformed response. It did not retry. Partial raw evidence has been retained for diagnosis. Do not submit this directory as a completed result.\n`);
  throw new Error(`${error.message} Partial raw evidence retained in ${runRoot}.`);
}
