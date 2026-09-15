---
language:
  - en
license: cc-by-4.0
size_categories:
  - n<1K
tags:
  - finance
  - point-in-time
  - reproducibility
  - look-ahead-bias
  - evaluation
configs:
  - config_name: prompts
    default: true
    data_files:
      - split: calibration
        path: tables/prompts.jsonl
  - config_name: reference_answers
    data_files:
      - split: calibration
        path: tables/reference_answers.jsonl
  - config_name: cases
    data_files:
      - split: calibration
        path: tables/cases.jsonl
---

# Financial AI Point-in-Time Integrity Benchmark v1.1

AhaSignals · benchmark 1.1.0 · portable table distribution 2026-09-16-v1

**Eight selected cases, five issuers, sixteen case-track prompts. All answers are public. This is a conformance suite, not a held-out test set or a representative sample of financial-data errors.**

[Inspect the cases](https://ahasignals.com/research/point-in-time-financial-data/) · [Paper on SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7415198) · [Frozen dataset DOI](https://doi.org/10.5281/zenodo.22289017) · [Scorer and source repository](https://github.com/AhaSignals/pit-backtest-validation-benchmark)

## What can be checked?

The tasks require a financial answer at an explicit historical decision time. They cover later comparative values, preliminary versus filed evidence, unequal fiscal periods, and formal non-reliance followed by restatement. A correct response must select the eligible source accession or abstain when no reliable number is available under the case's rules.

One worked sequence follows the same BigBear.ai annual net-loss cell before a non-reliance notice, during the non-reliance interval and after the restated filing. These are three knowledge states for one financial period, not three independent issuers or three performance periods.

## Files and fields

| Configuration | Rows | Contents |
| --- | ---: | --- |
| `prompts` | 16 | `case_id`, `track`, `decision_time`, `task`, `prompt_json` |
| `reference_answers` | 16 | `case_id`, `track`, `response_status`, `reference_answer_json` |
| `cases` | 8 | `case_id`, `title`, `failure_mode`, `decision_time`, `case_json` |

Each JSON string column preserves the complete original object, including nested values, arrays and nulls. Parse it with `json.loads` or `JSON.parse`; do not treat the displayed string as a new annotation. Join prompts and answers on **both** `case_id` and `track`. Each case appears in two tracks, so the sixteen prompts are not sixteen independent cases.

The `original/data/v1.1/` directory contains byte-identical frozen files. `manifest.json` records their hashes and those of the derived tables. No case, cutoff, answer or scoring rule is changed by this distribution.

## Run without an account

Download the [offline replication package](https://ahasignals.com/data/replication/pit-v1-1/replication-kit.zip), extract it and run with Node.js 18 or later:

```sh
node verify.mjs
```

Expected: the reference fixture gives 16 perfect responses and zero temporal-integrity failures; the seeded-negative fixture gives 15 perfect responses and one temporal-integrity failure. The verifier succeeds only when both outcomes match. These are scorer calibration results, not model results. No network access, API key or model requests are required.

Read the local table with Python's standard library:

```python
import json
from pathlib import Path

rows = [json.loads(line) for line in Path("tables/prompts.jsonl").read_text().splitlines()]
prompt = json.loads(rows[0]["prompt_json"])
print(prompt["caseId"], prompt["track"], prompt["decisionTime"])
```

## Avoid leaking the answer during evaluation

Send only the selected original prompt and the evidence allowed by the execution protocol to the system being tested. **Do not send `case_json`, reference answers, forbidden-future values or the whole dataset card as model context.** The case table deliberately includes answer and future-evidence annotations for auditing.

The prompts preserve the frozen suite's supplied-evidence policy. They are not standalone copies of full filings. For model execution, follow the repository's independent-run protocol and record any additional evidence access; do not infer that the metadata-only prompt contains all source text needed to answer.

Keep raw model responses, exact model identifiers, evidence access, attempts, run times and hashes. Score responses with the canonical scorer. Public cases can be memorized; high scores establish conformance on these cases, not generalization, investment performance or deployment readiness.

## Sources, clocks and limitations

- Purposively selected source-linked cases, with human-readable tasks and reference annotations. This is not an all-stock point-in-time database.
- SEC acceptance is the suite's regulatory event clock, with zero added operational lag. It is not proof of dissemination, vendor availability, ingestion time or tradability.
- The historical examples were reconstructed from disclosed evidence. This package does not contain contemporaneous collection receipts from those historical dates.
- The separate [input checker](https://ahasignals.com/research/point-in-time-input-checker/) checks declared source and calculation clocks. Its synthetic controls are not additional benchmark observations.
- No model outputs or seeded-negative responses are represented here as measured issuer facts. The original adversarial fixture intentionally contains an incorrect response to test the scorer.

## License and citation

Original compilation, annotations and documentation: CC BY 4.0; see `DATA-LICENSE.md`. Referenced issuer documents retain their rights and are not mirrored here. Scorer code in the upstream repository has its separate MIT license. AhaSignals is independent of the issuers, regulator and hosting platforms. Research and education only.

Cite the dataset as **AhaSignals (2026), Financial AI Point-in-Time Integrity Benchmark, version 1.1.0, DOI 10.5281/zenodo.22289017**; `citation.bib` preserves the frozen citation. Cite the paper separately as listed on SSRN. This table conversion is a distribution of the existing benchmark, not a new benchmark release or a new DOI.

Report an incorrect source, cutoff or answer through the [source repository](https://github.com/AhaSignals/pit-backtest-validation-benchmark), identifying the case ID and accession. Frozen versions are retained; corrections require a documented subsequent version.
