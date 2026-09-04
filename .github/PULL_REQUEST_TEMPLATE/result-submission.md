## Independent result submission

- Run ID:
- Operator or organization:
- Benchmark version and DOI:
- Provider and exact model ID:
- Execution date:
- Tool and network policy:
- One fresh context per case-track pair: yes / no
- Manual answer edits: yes / no

## Verification

- [ ] The result is append-only under `results/independent/<run-id>/`.
- [ ] `results/index.json` contains the matching independent-run entry.
- [ ] Raw responses and the normalized submission are included.
- [ ] `SUBMISSION.md`, `run-manifest.json` and `checksums.sha256` are included.
- [ ] No expected-answer or reference-fixture file was exposed to the model.
- [ ] `npm run verify:independent -- results/independent/<run-id>` passes.
- [ ] `npm test` passes.
- [ ] The transfer ZIP was not committed; the append-only directory is the review object.
- [ ] The description does not claim investment performance, general model intelligence or independent certification by AhaSignals.

Describe any retries, refusals, malformed responses, parser transformations or unavailable provider settings:
