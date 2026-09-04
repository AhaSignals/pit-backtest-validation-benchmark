# Update protocol

The benchmark specification, source datasets and benchmark runs have separate identities.

## Versioned objects

1. **Benchmark specification** — changes only when a case, rule, schema or expected behavior changes.
2. **Dataset release** — changes when a new filing, source version or reviewed extraction correction enters the evidence set.
3. **Benchmark run** — records one deterministic execution of one benchmark specification against named dataset releases.

## Release sequence

```text
new SEC filing
  -> candidate extraction
  -> human review of fact identity, period, unit and revision class
  -> immutable dataset release
  -> automated benchmark run
  -> checksum, regression and expected-answer checks
  -> reviewed public benchmark run
  -> mutable latest pointer moves to the approved run
```

Automation may generate a candidate report. It must not overwrite an earlier fixture, expected answer or public run. A public release requires all checks to pass and a named review state.

## Case registry rule

Published case IDs remain stable. A factual correction creates a new benchmark version and records the prior and corrected states. New failure modes receive new IDs.

Candidate future cases include:

- issuer-identified restatement in an amended periodic filing;
- IPO registration-statement history used before its first public acceptance time;
- stock split, merger or spin-off identity error;
- after-hours filing used at the same day's closing price;
- XBRL taxonomy change mistaken for an economic change.

## Financial AI submission rule

Each public version fixes the case-track prompts, expected answers, admissible accessions, forbidden future states, scoring weights and submission schema. A model or agent submission must contain exactly one JSONL response for each case-track pair.

The scorer records five dimensions: temporal admissibility, accession citation, answer accuracy, abstention discipline and evidence completeness. A future accession, future answer or incorrect answer/abstention state is a temporal-integrity hard failure. Aggregate points cannot override that status.

The evidence-restricted and knowledge-contamination tracks remain separate. A retrieval result cannot be represented as proof that a model's internal knowledge is time-bounded.

## Performance layer

Return statistics remain `not-evaluated` until a user supplies market data under a documented license or entitlement. A price-adapter revision creates a new benchmark run because execution timing, adjustment policy and source coverage can change the result.
