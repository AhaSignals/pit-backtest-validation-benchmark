# AhaSignals Point-in-Time Backtest Validation Benchmark

[![Version](https://img.shields.io/badge/version-1.0.0-087653)](https://ahasignals.com/research/point-in-time-backtest-validation-benchmark/)
[![Reference cases](https://img.shields.io/badge/reference_cases-5%2F5_pass-087653)](data/v1/baseline-report.json)
[![Benchmark DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22279744.svg)](https://doi.org/10.5281/zenodo.22279744)
[![Source dataset DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22239714.svg)](https://doi.org/10.5281/zenodo.22239714)

Could a historical backtest have known and used the selected filing value at the stated decision time?

This repository contains five open, source-dated tests for common failures in SEC-filing backtests. Every case identifies the decision time, the expected source vintage and the later state that must remain unavailable.

## What version 1 tests

| Case | Failure mode | Reference evidence |
| --- | --- | --- |
| `AS-PIT-001` | Later comparative value backfilled into an earlier decision | CoreWeave Q2 2025 revenue |
| `AS-PIT-002` | A later comparative changes the sign of a historical value | CoreWeave H1 2025 other investing activities |
| `AS-PIT-003` | Preliminary evidence is treated as a completed filing | Super Micro preliminary release and completed Form 10-K |
| `AS-PIT-004` | An unchanged value hides an evidence and comparability upgrade | Super Micro cross-section transition |
| `AS-PIT-005` | Different fiscal period ends are treated as one synchronized quarter | NVIDIA and AMD role-matched comparison |

The reference fixtures contain 28 CoreWeave vintage observations across 14 matched fact identities. The linked six-issuer release comparison contains 24 metric cells, four source upgrades and one primary-matrix admission.

## Run the reference verifier

Requirements: Node.js 18 or later. No package installation is required.

```bash
npm test
```

The verifier checks:

- all five case IDs and expected answers;
- source-vintage eligibility at the stated decision time;
- the CoreWeave later-value and sign-flip traps;
- the Super Micro preliminary-to-filed transition;
- the fiscal-period mismatch rejection rule;
- benchmark payload integrity and every frozen file checksum;
- the explicit absence of return or Sharpe claims.

## Selection rule

```text
selected vintage = latest SEC acceptance timestamp <= decision time
```

The economic period and the public-information time are separate. A later comparative, amended filing or extraction correction creates a new version and never overwrites a frozen predecessor. Missing or ineligible observations are never converted to zero.

## Repository layout

```text
data/v1/
  benchmark.json
  observation-vintages.csv
  decision-cases.json
  baseline-report.json
  schema.json
  price-adapter-schema.json
  checksums.sha256
scripts/
  verify.mjs
docs/
  UPDATE-PROTOCOL.md
```

## What passing version 1 does not prove

This is a data-integrity test suite. It does not establish factor alpha, information coefficient, portfolio return, Sharpe ratio or drawdown. Passing five known cases does not establish that a pipeline is free from every form of look-ahead, survivorship or execution bias.

Market prices and corporate-action adjustments are not bundled. `price-adapter-schema.json` allows a researcher to connect data they are licensed to use without changing the frozen filing fixtures.

## Research and citation

- Canonical explanation: https://ahasignals.com/research/point-in-time-backtest-validation-benchmark/
- Frozen version 1.0.0 DOI: https://doi.org/10.5281/zenodo.22279744
- All-versions concept DOI: https://doi.org/10.5281/zenodo.22279743
- Underlying source cross-section DOI: https://doi.org/10.5281/zenodo.22239714
- Citation metadata: [`CITATION.cff`](CITATION.cff)
- Release protocol: [`docs/UPDATE-PROTOCOL.md`](docs/UPDATE-PROTOCOL.md)

Cite the version DOI for results tied to the frozen 1.0.0 files. Cite the concept DOI when referring to the benchmark series across versions.

## Rights and boundary

The reference verifier is licensed under the MIT License. The original benchmark compilation, fixtures and documentation are licensed under CC BY 4.0; underlying factual information remains attributable to the cited SEC filings and issuers.

AhaSignals is an independent research publisher. Company names and ticker symbols identify SEC filers and source evidence only. AhaSignals is not affiliated with or endorsed by the referenced issuers or the SEC. Research and education only; not investment, trading, legal, accounting or tax advice.
