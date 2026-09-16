# Point-in-time response error controls v1.0.0

AhaSignals · 2026-09-16 · synthetic regression tests against frozen benchmark 1.1.0.

## Reproduce

With Node.js 18 or later, from the repository or extracted control package:

```sh
node scripts/verify-error-controls.mjs
```

No package installation, network, account or model call is needed. The command first verifies the generated fixtures and their source hashes, then checks the unaltered 16-response reference submission. It runs 16 further submissions, each with **exactly one changed field in one response**. The other 15 responses must remain perfect. The runner succeeds only when every expected rejection, score and diagnostic matches.

## What the comparison establishes

All 16 altered submissions fail the complete scorer. Ten trigger its temporal-integrity diagnostic. Six fail answer accuracy without that diagnostic: hiding a provenance upgrade, allowing a synchronized ranking despite unequal period ends, and retaining the withdrawn prior value after restatement, each in two tracks.

**Gate on the full report's `result`, not only `temporalIntegrityFailureCount`.** An overall fail with zero temporal failures is a real rejection. The chosen controls illustrate scorer behavior; six out of sixteen is not an empirical financial-data error rate or a model failure rate.

The ranking control deliberately retains both period ends and changes only `strictSynchronizedRankingAllowed`. In frozen v1.1 the forbidden-answer diagnostic compares complete JSON objects, so this expanded wrong answer receives an accuracy rejection rather than a temporal flag. The frozen scorer is not silently changed here. The controls document that distinction.

For the non-reliance control, `responseStatus` is changed to `answered` while the answer remains null. That deliberately inconsistent response tests the status gate. For the pre-notice citation control, the earlier correct value is retained while its citation is replaced by the later restatement accession. Values and provenance must be checked separately.

These tests operate at the answer/scorer boundary. They do not prove that a data ingestion system excludes future evidence, that an LLM has not memorized public answers, or that a backtest is tradable. Do not feed controls or reference answers to a model under evaluation.

## Files and reuse

- `controls/v1/controls.jsonl`: paired reference and changed responses, changed field, before/after values, expected score, temporal diagnostic and permanent case URL.
- `controls/v1/summary.json`: the eight control definitions and explicit denominators.
- `controls/v1/manifest.json`: hashes of source files and generated controls.
- `scripts/verify-error-controls.mjs`: offline runner; exit 0 means all expected tests behaved correctly, not that the deliberately wrong answers passed.

To test your own system, preserve its actual outputs and feed a complete submission to the canonical scorer. Run these controls in CI to confirm that your acceptance rule rejects both kinds of error. Record your own code, input and result hashes; do not present AhaSignals fixtures as independent model responses.

Cite this extension as **AhaSignals (2026), Point-in-time response error controls, v1.0.0**, with the [permanent explanation](https://ahasignals.com/research/point-in-time-financial-data/#error-controls), source commit, manifest and control IDs. Cite underlying benchmark 1.1.0 separately using DOI [10.5281/zenodo.22289017](https://doi.org/10.5281/zenodo.22289017). That DOI identifies the frozen benchmark, not this later extension. The working paper is a third, separate research object.

Code: MIT. Original control annotations and documentation: CC BY 4.0. Existing filing references are retained for evidence attribution; this extension adds no issuer documents or market-price feeds. AhaSignals is independent of referenced issuers, regulators and repositories. Research and education only.
