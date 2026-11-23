---
name: research-licence-gate
description: Check a model, dataset or checkpoint before building research or a release on top of it - licence, access gating, and where its weights or training data came from (for example distillation from a closed model) - and respond in proportion. Use before choosing a base model or dataset for training, merging, fine-tuning or evaluation, when the goal includes publishing models or results, when asked "can we use this", "is this licence ok", "is this distilled from a closed model", or when an agent instruction says to use only permissively licensed models.
---

# Research licence gate

Scope: shareable, no machine-specific facts. This is a practical screen, not legal advice; say so when the
answer matters commercially.

## The gate

For each model or dataset, record four facts with the link you read them from:

1. **Licence.** The actual licence text on the repository, not the tag. Note restrictions: non-commercial,
   research-only, attribution, share-alike, acceptable-use policies, limits on derivatives or on publishing
   benchmarks. Custom "community" licences need reading in full.
2. **Gating.** Is access gated, and do the gate's terms add conditions beyond the licence? Gate text is often
   visible only when logged in; if you cannot see it, say so.
3. **Lineage.** What is it derived from? Base model, merge parents, adapters, and the training data. Check the
   card, the config (`base_model`, merge recipes), the name, and the author's other uploads.
4. **Obvious provenance problems.** Does the card or name say it was trained on outputs of a closed model, on
   leaked weights, or on data with a conflicting licence? A derivative cannot be more permissive than its
   parents.

## Decide in proportion

- **Pass:** permissive licence, no added gate conditions, no obvious lineage problem. Use it and record the facts.
- **Pass with conditions:** usable for the intended purpose (e.g. local evaluation) but not for release, or
  needs attribution. Write the condition next to the model wherever it is listed.
- **Fail:** licence forbids the intended use, or the stated lineage is a closed model's outputs or leaked
  weights and the goal is to publish. Pick an alternative.

Proportion matters both ways. "No obvious lineage problem" is the standard; do not demand proof of a clean
history nobody can provide, and do not throw out a whole plan over one flagged model. Before narrowing the
field, do a proper search for alternatives: sort by recency and by downloads, check the organisations that
publish under permissive licences, and read cards rather than tags. A hasty search produces both false alarms
and thin shortlists.

## If the goal is to release

Check before training, not after:
- Every parent's licence allows redistribution of derivatives, under a licence you can adopt.
- Datasets used for training allow it too.
- You can state the lineage truthfully in your own card: base, data, method, and what was not verified.
- Evaluation sets are not in the training data.

## Record

Keep a short table in the project (model or dataset, licence, gate, lineage, verdict, link, date checked) and
put the rule itself in the project's agent instructions so every agent applies the same gate. Re-check when a
repository changes its licence or card.
