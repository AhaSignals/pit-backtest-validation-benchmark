#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createOpenAiAdapter, loadTasks, root, sha256File } from './lib/independent-runner.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ahasignals-independent-tooling-'));
const runId = 'independent-tooling-calibration';
const runRoot = path.join(root, 'results/independent', runId);
const automaticZipPath = path.join(root, 'results/independent', `${runId}.zip`);
const registryPath = path.join(root, 'results/index.json');
const registryBefore = fs.readFileSync(registryPath);

try {
  assert.ok(!fs.existsSync(runRoot), `Reserved test run already exists: ${runRoot}`);
  const mockCodex = path.join(tempRoot, 'mock-codex');
  const referencePath = path.join(root, 'data/v1.1/reference-submission.jsonl');
  fs.writeFileSync(mockCodex, `#!/usr/bin/env node
import fs from 'node:fs';
if (process.argv.includes('--version')) {
  console.log('mock-codex 1.0.0');
  process.exit(0);
}
const outputIndex = process.argv.indexOf('--output-last-message');
const outputPath = process.argv[outputIndex + 1];
const prompt = process.argv.at(-1);
const caseId = prompt.match(/caseId: (AS-PIT-00[1-8])/)[1];
const track = prompt.match(/track: (retrieval|knowledge-contamination)/)[1];
const records = fs.readFileSync(process.env.AHASIGNALS_TEST_REFERENCE, 'utf8').trim().split('\\n').map(JSON.parse);
const response = records.find((item) => item.caseId === caseId && item.track === track);
fs.writeFileSync(outputPath, JSON.stringify(response));
console.log(JSON.stringify({ type: 'response.completed', caseId, track }));
`);
  fs.chmodSync(mockCodex, 0o755);

  const run = spawnSync(process.execPath, [
    path.join(root, 'scripts/run-independent.mjs'),
    '--provider', 'codex', '--model', 'mock-model-v1', '--operator', 'Independent Tooling Test',
    '--run-id', runId, '--codex-bin', mockCodex, '--execute',
  ], { cwd: root, encoding: 'utf8', env: { ...process.env, AHASIGNALS_TEST_REFERENCE: referencePath } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /"status": "complete"/);
  assert.ok(fs.existsSync(automaticZipPath), 'The one-command runner must create a verified transfer ZIP.');

  const verify = spawnSync(process.execPath, [path.join(root, 'scripts/verify-independent-result.mjs'), runRoot], { cwd: root, encoding: 'utf8' });
  assert.equal(verify.status, 0, `${verify.stdout}${verify.stderr}`);
  const submissionNotePath = path.join(runRoot, 'SUBMISSION.md');
  const submissionNote = fs.readFileSync(submissionNotePath);
  fs.appendFileSync(submissionNotePath, '\nundisclosed change\n');
  const tampered = spawnSync(process.execPath, [path.join(root, 'scripts/verify-independent-result.mjs'), runRoot], { cwd: root, encoding: 'utf8' });
  assert.notEqual(tampered.status, 0, 'Verifier must reject a modified public artifact.');
  fs.writeFileSync(submissionNotePath, submissionNote);
  const zipPath = path.join(tempRoot, `${runId}.zip`);
  const pack = spawnSync(process.execPath, [path.join(root, 'scripts/package-independent-result.mjs'), runRoot, '--output', zipPath], { cwd: root, encoding: 'utf8' });
  assert.equal(pack.status, 0, `${pack.stdout}${pack.stderr}`);
  const archive = fs.readFileSync(zipPath);
  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  assert.ok(archive.includes(Buffer.from(`${runId}/checksums.sha256`)));
  const secondZipPath = path.join(tempRoot, `${runId}-second.zip`);
  const secondPack = spawnSync(process.execPath, [path.join(root, 'scripts/package-independent-result.mjs'), runRoot, '--output', secondZipPath], { cwd: root, encoding: 'utf8' });
  assert.equal(secondPack.status, 0, `${secondPack.stdout}${secondPack.stderr}`);
  assert.equal(sha256File(zipPath), sha256File(secondZipPath), 'Independent result ZIP must be deterministic.');
  const unzip = spawnSync('unzip', ['-t', zipPath], { encoding: 'utf8' });
  if (!unzip.error || unzip.error.code !== 'ENOENT') assert.equal(unzip.status, 0, `${unzip.stdout}${unzip.stderr}`);
  const help = spawnSync(process.execPath, [path.join(root, 'scripts/run-independent.mjs'), '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /16 model requests/);

  const firstTask = loadTasks().tasks[0];
  const firstReference = JSON.parse(fs.readFileSync(referencePath, 'utf8').trim().split('\n')[0]);
  let receivedRequest = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    receivedRequest = { url, authorization: init.headers.Authorization, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      id: 'resp_test_123', model: 'mock-openai-snapshot',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(firstReference) }] }],
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req_test_123' } });
  };
  try {
    const secret = 'test-key-must-not-be-recorded';
    const adapter = createOpenAiAdapter({ model: 'mock-openai-model', reasoningEffort: 'high', apiKey: secret });
    const executed = await adapter.execute(firstTask);
    assert.equal(executed.exitStatus, 0);
    assert.equal(executed.resolvedProviderSnapshot, 'mock-openai-snapshot');
    assert.equal(receivedRequest.authorization, `Bearer ${secret}`);
    assert.equal(receivedRequest.body.store, false);
    assert.equal(receivedRequest.body.text.format.type, 'json_schema');
    assert.equal(receivedRequest.body.tools, undefined);
    assert.ok(!JSON.stringify(executed).includes(secret), 'Provider credential must not enter public run evidence.');
    globalThis.fetch = async () => { throw new TypeError('simulated transport failure'); };
    const failed = await adapter.execute(firstTask);
    assert.equal(failed.exitStatus, 1);
    assert.equal(failed.rawEvent.transportError.name, 'TypeError');
    assert.ok(!JSON.stringify(failed).includes(secret), 'Provider credential must not enter transport-error evidence.');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('PASS independent tooling: Codex and OpenAI adapters, end-to-end isolated runner, registry, tamper rejection, verifier and deterministic valid ZIP packager.');
} finally {
  fs.writeFileSync(registryPath, registryBefore);
  fs.rmSync(runRoot, { recursive: true, force: true });
  fs.rmSync(automaticZipPath, { force: true });
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
