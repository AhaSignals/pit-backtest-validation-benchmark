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

[The dataset card](../distribution/huggingface/README.md) describes separately loadable prompts, answers and case annotations. These tables are ready for a dataset host, but their presence in this repository does not imply that any particular external host has published them.

```sh
npm run build:distribution
npm run verify:distribution
```

The generator copies frozen files byte-for-byte and records source and output SHA-256 hashes. Verification reconstructs each original JSON object from its table row and replays the answer table through the unchanged scorer. Never provide the case annotations or answer table to the evaluated model.
