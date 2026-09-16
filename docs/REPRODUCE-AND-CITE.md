# Reproduce a point-in-time failure and cite the right object

## A five-minute check

1. Open the [paper companion](https://ahasignals.com/research/point-in-time-financial-data/). Select a case and inspect its decision time, accession and expected response.
2. Download the replication ZIP linked there. Read its README and manifest, then extract it.
3. With Node.js 18 or later, run `node verify.mjs`. It verifies packaged hashes and checks both the reference and seeded-negative scorer fixtures.
4. Expect 16/16 perfect reference responses, then 15/16 perfect responses and one temporal-integrity failure for the seeded-negative fixture. The latter deliberately answers during a non-reliance interval when abstention is required.
5. To evaluate a model, use the repository's independent-run protocol. The offline package does not execute a model or establish predictive performance.

The standalone adversarial scoring command intentionally exits with code 1. That is an expected rejection; the combined verifier exits 0 only when the rejection matches the fixture.

## Three objects, three uses

| Object | Purpose | Citation |
| --- | --- | --- |
| Working paper | Explain the research argument and method | [SSRN record 7415198](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7415198), with the manuscript version actually read |
| Frozen benchmark 1.1.0 | Identify the cases, expected answers and scoring contract | [Version DOI](https://doi.org/10.5281/zenodo.22289017) and case IDs |
| Input checker | Check declared dependencies in a user's own calculation | [Tool page](https://ahasignals.com/research/point-in-time-input-checker/) plus the code/input hashes from the downloaded report |

The paper author is the author named on the manuscript. AhaSignals is the organizational creator of the benchmark. Do not replace manuscript authors with a platform or dataset creator, or describe repository acceptance as journal peer review.

An independent run is a fourth object: cite its own preserved manifest and responses. A reference fixture is not an independent run.

## Portable tables

[The public dataset](https://huggingface.co/datasets/AhaSignals/financial-ai-pit-integrity) has separately loadable prompts, reference answers and annotated cases. [The dataset card](../distribution/huggingface/README.md) documents their limitations. The verified distribution revision is pinned in `distribution/published-hub.json`.

```sh
npm run build:distribution
npm run verify:distribution
```

The generator copies frozen files byte-for-byte and records source and output SHA-256 hashes. Verification reconstructs each original JSON object from its table row and replays the answer table through the unchanged scorer. Never provide the case annotations or answer table to the evaluated model.

## Export verified prompts without loading answers

From this repository, with Node.js 18 or later:

```sh
npm run export:hub-prompts -- --hub --out pit-prompts
```

This makes three public reads at the pinned Hugging Face commit: manifest, prompt table and original prompts. It checks the pinned manifest hash, file hashes and exact round trip, then writes only `prompts.jsonl` and `receipt.json` to a new directory. It refuses to overwrite an existing directory. The receipt records verification time, version and code/input hashes; it is not a historical observation receipt. No API key, model request or remote code is involved.

For an offline check of the repository copy:

```sh
npm run export:hub-prompts -- --local distribution/huggingface --out pit-prompts-local
```

The prompts still require the evidence allowed by the independent-run protocol. Export does not run a model or make public answers into a held-out test.

For users of the Python `datasets` library, pin the same revision and load only the prompt configuration:

```python
import json
from datasets import load_dataset
rows = load_dataset(
    "AhaSignals/financial-ai-pit-integrity", "prompts",
    split="calibration", revision="4b7c5ec4ad3f0d14187d1eada3bef9f85df5b229",
)
prompts = [json.loads(row["prompt_json"]) for row in rows]
```

The `datasets` example selects a fixed revision but does not replace the explicit hash verification above. See the [upstream loading documentation](https://huggingface.co/docs/datasets/en/loading).

## Test the acceptance rule

Run `npm run verify:controls`. Read [the single-field error-control guide](../controls/v1/README.md) before interpreting its results. Six selected wrong responses have no temporal diagnostic but still fail the complete scorer; checking only the temporal count would miss them. These are synthetic tests, not model measurements or estimates of error prevalence.
