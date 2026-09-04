# Financial AI PIT Integrity Results Protocol

This protocol governs public results produced against the frozen AhaSignals Financial AI Point-in-Time Integrity Benchmark v1.1.0.

The benchmark and its DOI remain immutable. Results are separate, append-only research objects. A result may fail. Failed runs are retained because the purpose is to locate temporal-integrity errors, not to manufacture a passing model claim.

## Result classes

- `calibration` — deterministic fixtures used to test the scorer. These are not model results.
- `operator-run` — a run executed by AhaSignals under this protocol.
- `independent` — a run executed and submitted by an unaffiliated third party.

The public registry must never combine these classes into one leaderboard.

## Required operator controls

1. Use benchmark version `1.1.0` and verify its frozen checksums before execution.
2. Start one fresh context for every case-track prompt. No response may see another response.
3. Do not expose `benchmark.json`, `decision-cases.json`, `reference-submission.jsonl`, `adversarial-submission.jsonl` or any expected answer to the evaluated model.
4. Materialize evidence using `operator/evidence-v1.1.json`:
   - retrieval receives only evidence accepted at or before `decisionTime`;
   - knowledge-contamination receives every evidence state, including later states, and must enforce the cutoff itself.
5. Disable web, repository and filesystem retrieval during the model response. The frozen evidence cards are the complete evidence surface for this operator protocol.
6. Use exactly one attempt per prompt. A malformed or refused response remains part of the result; it is not silently regenerated.
7. Preserve the assembled prompts, raw provider/CLI event stream, final responses, normalized submission, deterministic score report and SHA-256 manifest.
8. Do not manually edit model answers. Deterministic JSON parsing and field-order normalization are allowed and must be disclosed.

## Required run metadata

Every run manifest records:

- benchmark ID, version and DOI;
- run ID, result class, operator and timestamps;
- provider, exact requested model ID, interface and client version;
- reasoning setting, tool policy, context-isolation policy and retry policy;
- prompt-assembly version and evidence-package SHA-256;
- whether any response was manually edited;
- hashes for every public run artifact;
- score summary and a plain-language interpretation boundary.

Unknown provider settings must be recorded as `null`, not guessed.

## Public artifacts

An `operator-run` directory contains:

```text
run-manifest.json
prompts.jsonl
raw-events.jsonl
raw-responses.jsonl
submission.jsonl
score-report.json
checksums.sha256
```

`raw-events.jsonl` stores one object per case-track pair. Each object contains the unmodified stdout and stderr returned by the execution client. It may be large; it is evidence, not presentation copy.

An `independent` directory contains the same machine-verifiable evidence plus `SUBMISSION.md`, which summarizes the operator, provider, requested model, result and interpretation boundary. The independent runner does not store provider credentials.

## Interpretation

The primary outcome is temporal integrity:

- zero future-accession citations;
- zero forbidden future answers;
- correct response status, including required abstention.

A top-level `pass` additionally requires every response to receive 100 points. One run does not establish general model quality, investment value, alpha, information coefficient or portfolio performance. Public expected answers make this an open-book conformance suite and do not measure resistance to benchmark memorization.

## Independent submissions

Independent submitters should open a pull request containing an append-only directory under `results/independent/`. The submission must identify the operator and preserve raw responses. AhaSignals verifies the format and deterministic score; it does not certify the submitter's model-access claims.

The supported execution path is:

```bash
npm run preflight:independent -- --provider codex --model MODEL --operator "NAME"
npm run run:independent -- --provider codex --model MODEL --operator "NAME" --execute
npm run verify:independent -- results/independent/RUN_ID
```

Use `--provider openai` with `OPENAI_API_KEY` for the OpenAI Responses API. Every provider call is a fresh request, no tools are supplied, the runner performs no retries and the normalized answers are not manually edited. A malformed response stops the run and preserves partial raw evidence in an unregistered `INCOMPLETE` directory.

The runner adds a completed result to `results/index.json`. Do not combine independent and AhaSignals-operated results in one ranking. A submitted result may fail the benchmark; failing results remain valid research objects when their evidence package is complete.

Model and provider names are recorded only as submitter-supplied execution metadata. Their inclusion does not imply provider participation, endorsement or independent certification of the run.
