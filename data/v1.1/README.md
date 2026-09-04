# AhaSignals Financial AI Point-in-Time Integrity Benchmark

- Version: 1.1.0
- Status: release candidate
- Published package date: 2026-09-04
- Canonical research page: https://ahasignals.com/research/point-in-time-backtest-validation-benchmark/
- Public repository: https://github.com/AhaSignals/pit-backtest-validation-benchmark
- Evolving-series DOI: https://doi.org/10.5281/zenodo.22279743
- Data compilation and documentation: CC BY 4.0
- Reference scorer: MIT

## Research question

Can a financial AI system avoid using SEC information that did not exist at the stated decision time?

## Version 1.1 scope

Version 1.1 preserves the five v1.0 compatibility cases and adds three BigBear.ai cases spanning the complete knowledge-state transition: previously reported, withdrawn from reliance, and restated. Every case runs in two tracks:

1. **Evidence-restricted retrieval** — the system may use only the supplied evidence bundle.
2. **Knowledge-contamination control** — the system may have broader knowledge, but its answer must remain bounded by the historical decision time.

The suite contains 8 cases and 16 case-track prompts. The reference fixture passes all 16 responses. This validates the fixtures and scorer; it is not a third-party model result.

## Scoring

- Temporal admissibility: 40 points
- Accession citation: 25 points
- Answer accuracy: 20 points
- Abstention discipline: 10 points
- Evidence completeness: 5 points

Using a forbidden future accession, returning a forbidden future answer, or answering when the case requires abstention is a temporal-integrity failure regardless of the aggregate score.

## Files

- `benchmark.json` — complete v1.1 contract, cases, tracks and baseline.
- `decision-cases.json` — eight machine-readable cases and expected states.
- `prompts.jsonl` — sixteen case-track prompts.
- `reference-submission.jsonl` — deterministic scorer fixture, not a model result.
- `adversarial-submission.jsonl` — one deliberate future-value leak that the scorer must reject.
- `baseline-report.json` — dimension scores for the reference fixture.
- `schema.json` and `submission-schema.json` — machine-readable contracts.
- `checksums.sha256` — frozen artifact manifest.
- `scripts/score-submission.mjs` — dependency-free scorer in the public repository.

## Source research objects

- CoreWeave case study: https://doi.org/10.5281/zenodo.22288550
- BigBear.ai revision ledger: https://doi.org/10.5281/zenodo.22288546
- Benchmark v1.0: https://doi.org/10.5281/zenodo.22279744

## Publication boundary

Version 1.1 remains a release candidate until its version DOI is assigned and inserted without changing the case evidence or expected answers. The v1.0 directory remains byte-for-byte frozen.

## Boundary

AhaSignals is an independent research publisher. Company names and symbols identify SEC filers and source evidence only. AhaSignals is not affiliated with or endorsed by the referenced issuers or the SEC. Research and education only; not investment, trading, legal, accounting or tax advice.
