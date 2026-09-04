#!/usr/bin/env node
import { assertSupportedNode, createCodexAdapter, createOpenAiAdapter, parseArgs, runFrozenVerification, validateRunIdentity } from './lib/independent-runner.mjs';

const help = `Usage:
  npm run preflight:independent -- --provider codex --model MODEL --operator "NAME"
  npm run preflight:independent -- --provider openai --model MODEL --operator "NAME"

Options:
  --provider       codex or openai
  --model          exact requested model ID
  --operator       person or organization responsible for the run
  --reasoning      provider reasoning effort (default: high)
  --codex-bin      optional Codex CLI path
  --openai-base-url optional OpenAI-compatible Responses API base URL
`;

const args = parseArgs(process.argv.slice(2));
if (args.has('--help')) {
  console.log(help);
  process.exit(0);
}

const provider = args.get('--provider', 'codex');
const model = args.get('--model');
const operator = args.get('--operator');
const reasoningEffort = args.get('--reasoning', 'high');
assertSupportedNode();
validateRunIdentity({ operator, model });

const frozenVerification = runFrozenVerification();
let adapter;
if (provider === 'codex') {
  adapter = createCodexAdapter({ model, reasoningEffort, codexBin: args.get('--codex-bin') });
} else if (provider === 'openai') {
  adapter = createOpenAiAdapter({ model, reasoningEffort, apiKey: process.env.OPENAI_API_KEY, baseUrl: args.get('--openai-base-url', 'https://api.openai.com/v1') });
} else {
  throw new Error(`Unsupported provider: ${provider}. Supported providers: codex, openai.`);
}

console.log(JSON.stringify({
  status: 'ready',
  provider,
  model,
  operator,
  interface: adapter.metadata.interface,
  clientVersion: adapter.metadata.clientVersion,
  frozenBenchmark: frozenVerification,
  notice: 'Preflight does not call the model or incur provider usage.',
}, null, 2));
