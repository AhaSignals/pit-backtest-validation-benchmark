# AhaSignals Point-in-Time Backtest Validation Benchmark

- Version: 1.0.0
- Published: 2026-09-03
- Canonical research page: https://ahasignals.com/research/point-in-time-backtest-validation-benchmark/
- Public repository: https://github.com/AhaSignals/pit-backtest-validation-benchmark
- Data compilation and documentation: CC BY 4.0
- Reference verifier: MIT

## Research question

Could a historical backtest have known and used the selected filing value at the stated decision time?

## Version 1 scope

Version 1 contains five frozen cases with explicit expected answers:

1. AS-PIT-001 — later comparative value backfilled into an earlier CoreWeave decision.
2. AS-PIT-002 — later CoreWeave comparative changes the sign of a historical value.
3. AS-PIT-003 — preliminary Super Micro evidence treated as a completed filing.
4. AS-PIT-004 — an unchanged derived value hides an evidence and comparability upgrade.
5. AS-PIT-005 — different NVIDIA and AMD fiscal period ends are treated as one synchronized quarter.

The source fixtures contain 28 CoreWeave vintage observations across 14 matched fact identities. The six-issuer release comparison contains 24 metric cells, including 4 source upgrades and 1 primary-matrix admission.

## Pass condition

A filing fact is selected only when its SEC acceptance timestamp is on or before the decision time. Later comparative values remain separately addressable and cannot overwrite the earlier information set. Missing or ineligible observations are never converted to zero.

## What version 1 does not claim

This is a data-integrity benchmark. It does not establish factor alpha, information coefficient, portfolio return, Sharpe ratio or drawdown. Market prices and corporate-action adjustments are not bundled. The optional price adapter schema lets researchers connect data they are licensed to use without changing the frozen filing fixtures.

## Files

- `benchmark.json` — complete benchmark specification, cases and baseline result.
- `observation-vintages.csv` — 28 CoreWeave fact vintages with source clocks and lineage.
- `decision-cases.json` — five machine-readable test cases and expected answers.
- `baseline-report.json` — deterministic AhaSignals reference run.
- `schema.json` — benchmark JSON Schema.
- `price-adapter-schema.json` — optional external daily-price contract.
- `checksums.sha256` — SHA-256 manifest for the frozen artifacts.
- `scripts/verify.mjs` — dependency-free verifier in the public repository.

## Source archive

The AI-infrastructure source cross-section is archived at https://doi.org/10.5281/zenodo.22239714.

## Boundary

AhaSignals is an independent research publisher. Company names and symbols identify SEC filers and source evidence only. AhaSignals is not affiliated with or endorsed by the referenced issuers or the SEC. Research and education only; not investment, trading, legal, accounting or tax advice.
