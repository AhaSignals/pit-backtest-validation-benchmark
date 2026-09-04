# Version 1.1.0 — release candidate

Adds a financial-AI conformance layer without changing the frozen version 1.0 files.

## Added

- three BigBear.ai cases covering the previously reported, non-reliance and restated knowledge states;
- two evaluation tracks: evidence-restricted retrieval and knowledge-contamination control;
- 16 machine-readable case-track prompts and one deterministic reference submission;
- weighted scoring for temporal admissibility, accession citation, answer accuracy, abstention discipline and evidence completeness;
- an automatic temporal-integrity hard failure for future accessions, future answers or an incorrect answer/abstention state;
- a dependency-free JSONL scorer and submission schema;
- byte-identity checks for all frozen v1.0 artifacts.

## Source research objects

- CoreWeave later-comparatives case study: https://doi.org/10.5281/zenodo.22288550
- BigBear.ai accession-level PIT Revision Ledger: https://doi.org/10.5281/zenodo.22288546

The v1.1 version DOI will be added after the release candidate passes review and is uploaded as a new version of the existing Zenodo record.

# Version 1.0.0

Initial public release of the AhaSignals Point-in-Time Backtest Validation Benchmark.

Permanent archive: https://doi.org/10.5281/zenodo.22279744. The all-versions concept DOI is https://doi.org/10.5281/zenodo.22279743.

## Included

- five frozen failure cases with explicit expected answers;
- 28 CoreWeave source-vintage observations across 14 matched facts;
- later-value, sign-flip, preliminary-source, evidence-upgrade and fiscal-period mismatch tests;
- deterministic AhaSignals baseline report;
- benchmark and optional price-adapter JSON Schemas;
- dependency-free Node.js verifier;
- SHA-256 manifest for the frozen data artifacts.

## Research boundary

Version 1 tests data integrity. It does not report factor alpha, information coefficient, portfolio return, Sharpe ratio or drawdown. Market prices and corporate-action adjustments are not bundled.

## Source archive

The underlying AI-infrastructure cross-section is archived at https://doi.org/10.5281/zenodo.22239714.
