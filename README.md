# AhaSignals Financial AI Point-in-Time Integrity Benchmark

[![Version](https://img.shields.io/badge/version-1.1.0-087653)](https://doi.org/10.5281/zenodo.22289017)
[![Reference responses](https://img.shields.io/badge/reference_responses-16%2F16_pass-087653)](data/v1.1/baseline-report.json)
[![Series DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22279743.svg)](https://doi.org/10.5281/zenodo.22279743)
[![Frozen v1.0 DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22279744.svg)](https://doi.org/10.5281/zenodo.22279744)
[![Frozen v1.1 DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22289017.svg)](https://doi.org/10.5281/zenodo.22289017)

Can a financial AI system avoid using SEC information that did not exist at the stated decision time?

Version 1.1 is an open, deterministic conformance suite for testing whether a financial AI system respects SEC acceptance-time cutoffs, cites the controlling accession and abstains when an issuer has withdrawn reliance but no restated value is yet public.

## What changed in v1.1

The five v1.0 cases remain frozen. Version 1.1 adds a reviewed BigBear.ai restatement sequence and runs all eight cases in two tracks:

| Track | Question |
| --- | --- |
| Evidence-restricted retrieval | Can the system select and cite the admissible item from the supplied evidence bundle? |
| Knowledge-contamination control | Can the system keep broader or later knowledge outside an explicitly historical answer? |

The new cases preserve three distinct states for one issuer-labelled restatement cell:

1. **Previously reported** — use the prior value before the non-reliance notice.
2. **Non-reliance window** — abstain after the 8-K and before the restated Form 10-K.
3. **Restated** — use the revised value only after the restated filing is accepted.

## Case registry

| Case | Failure mode | Reference evidence |
| --- | --- | --- |
| `AS-PIT-001` | Later comparative imported into an earlier decision | CoreWeave Q2 2025 revenue |
| `AS-PIT-002` | Later comparative reverses a historical sign | CoreWeave H1 2025 other investing activities |
| `AS-PIT-003` | Preliminary evidence represented as a completed filing | Super Micro source transition |
| `AS-PIT-004` | An unchanged value hides a provenance upgrade | Super Micro release comparison |
| `AS-PIT-005` | Different fiscal period ends represented as synchronized | NVIDIA and AMD role-matched comparison |
| `AS-PIT-006` | Restated value backfilled before non-reliance | BigBear.ai pre-notice state |
| `AS-PIT-007` | Numeric answer returned during non-reliance | BigBear.ai 8-K-to-10-K quarantine interval |
| `AS-PIT-008` | Withdrawn prior value retained after restatement | BigBear.ai restated Form 10-K |

## Run the verifier and scorer

Requirements: Node.js 18 or later. No package installation is required.

```bash
npm test
```

Score a conforming 16-line JSONL submission:

```bash
npm run score -- path/to/submission.jsonl
```

The bundled `reference-submission.jsonl` is an oracle fixture for testing the scorer. It is not a result for a third-party model or agent.

## Public results

Results are append-only objects separate from the frozen benchmark. Read [`RESULTS-SPEC.md`](RESULTS-SPEC.md) before interpreting or submitting a run.

- `results/calibration/` records the reference and adversarial scorer fixtures. They are not model results.
- `results/operator-run/` records AhaSignals-operated runs with raw prompts, raw client events, unedited responses, deterministic scores and checksums.
- `results/independent/` is reserved for third-party submissions.

Operator runs use one fresh context per case-track prompt and the reviewed, checksum-addressable evidence cards in `operator/evidence-v1.1.json`. They are reported separately from independent submissions and are not a general model leaderboard.

## Scoring

| Dimension | Weight |
| --- | ---: |
| Temporal admissibility | 40 |
| Accession citation | 25 |
| Answer accuracy | 20 |
| Abstention discipline | 10 |
| Evidence completeness | 5 |

Any forbidden future accession, forbidden future answer or incorrect response status is a **temporal-integrity failure**, regardless of aggregate points.

## Repository layout

```text
data/v1/                   # immutable version 1.0.0
data/v1.1/                 # frozen version 1.1.0
  benchmark.json
  decision-cases.json
  prompts.jsonl
  reference-submission.jsonl
  adversarial-submission.jsonl
  baseline-report.json
  schema.json
  submission-schema.json
  checksums.sha256
scripts/
  verify.mjs               # verifies frozen v1.0
  verify-v1.1.mjs          # verifies v1.1 and v1.0 byte identity
  score-submission.mjs     # deterministic v1.1 scorer
  verify-results.mjs       # verifies calibration and public result artifacts
  run-codex-operator.mjs   # isolated Codex CLI operator runner
operator/
  evidence-v1.1.json       # reviewed closed evidence surface for operator runs
  single-response.schema.json
  run-manifest.schema.json
results/
  index.json
  calibration/
  operator-run/
  independent/
docs/
  UPDATE-PROTOCOL.md
```

`adversarial-submission.jsonl` differs from the reference fixture in one deliberately contaminated response: it imports BigBear.ai's later restated value into the non-reliance interval. The verifier requires the scorer to reject that submission with a temporal-integrity failure.

## Research objects

- Canonical explanation: https://ahasignals.com/research/point-in-time-backtest-validation-benchmark/
- Benchmark series DOI: https://doi.org/10.5281/zenodo.22279743
- Frozen version 1.0.0 DOI: https://doi.org/10.5281/zenodo.22279744
- Frozen version 1.1.0 DOI: https://doi.org/10.5281/zenodo.22289017
- CoreWeave case-study DOI: https://doi.org/10.5281/zenodo.22288550
- BigBear.ai Revision Ledger DOI: https://doi.org/10.5281/zenodo.22288546

Version 1.1 is frozen under its version DOI. Its evidence, expected answers and score weights are checksum-locked; any later benchmark change requires a new version.

## Interpretation boundary

This suite evaluates data-time integrity. It does not establish factor alpha, information coefficient, portfolio return, Sharpe ratio, drawdown or general model intelligence. Public expected answers make the benchmark reproducible, but do not measure resistance to benchmark memorization.

The reference scorer is licensed under the MIT License. The original benchmark compilation, fixtures and documentation are licensed under CC BY 4.0; underlying factual information remains attributable to the cited SEC filings and issuers.

AhaSignals is an independent research publisher. Company names and ticker symbols identify SEC filers and source evidence only. AhaSignals is not affiliated with or endorsed by the referenced issuers or the SEC. Research and education only; not investment, trading, legal, accounting or tax advice.
