# Zenodo new-version checklist for v1.1.0

- Current frozen v1.0 DOI: https://doi.org/10.5281/zenodo.22279744
- All-versions concept DOI: https://doi.org/10.5281/zenodo.22279743
- Create v1.1 by selecting **New version** on the v1.0 record. Do not create a separate concept record.

## Resource type

Software

## Title

AhaSignals Financial AI Point-in-Time Integrity Benchmark

## Version

1.1.0

## Publication date

2026-09-04

## Creator

AhaSignals

## Description

Eight open, source-dated conformance cases for testing whether a financial AI system respects SEC acceptance-time cutoffs, accession lineage, non-reliance windows and required abstention. Version 1.1 preserves the five v1.0 compatibility cases and adds three BigBear.ai cases spanning the previously reported, non-reliance and restated knowledge states. Every case runs in evidence-restricted retrieval and knowledge-contamination tracks. A future accession, future answer or incorrect answer/abstention state is a temporal-integrity failure. The deterministic 16-of-16 reference fixture validates the scorer and is not a third-party model result. The benchmark evaluates data-time integrity, not investment performance or general model intelligence.

## License

MIT for the verifier. The original benchmark fixtures and documentation are CC BY 4.0; state the dual-license boundary in the description because Zenodo exposes one primary license field.

## Keywords

- point-in-time financial data
- financial AI evaluation
- backtest validation
- look-ahead bias
- SEC filings
- financial data revisions
- reproducible research
- quantitative finance

## Related identifiers

- Is new version of: https://doi.org/10.5281/zenodo.22279744 — frozen v1.0 benchmark
- Is derived from: https://doi.org/10.5281/zenodo.22288550 — CoreWeave comparative-leakage case study
- Is derived from: https://doi.org/10.5281/zenodo.22288546 — BigBear.ai accession-level PIT Revision Ledger
- Is documented by: https://ahasignals.com/research/point-in-time-backtest-validation-benchmark/

## Repository URL

https://github.com/AhaSignals/pit-backtest-validation-benchmark

## Files and finalization

Upload the exact archive attached to the future GitHub `v1.1.0` release. Do not regenerate it after upload. Record its SHA-256 here and in the release notes, then add the assigned version DOI to `benchmark.json`, root `CITATION.cff`, `data/v1.1/CITATION.cff` and the canonical website page before the final public tag.

Do not modify the frozen files in `data/v1/` or alter tag `v1.0.0`.
