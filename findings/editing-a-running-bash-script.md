---
title: "Editing a bash script while it runs reorders or breaks the rest of the run"
date: 2026-11-19
group: box-and-harness
recipes: [flint]
provenance: ours
provenance_note: "Our own harness mistake, hit twice."
credit: []
evidence: ["flint/experiments/RESULTS.md:69", "flint/experiments/RESULTS.md:309"]
applies_to: "Any long sweep driven by a shell script."
---

Bash reads a script from disk as it goes, by byte offset. Saving an edit to a script that is running makes bash continue from the old offset in the new text.

It happened here twice during overnight Flint sweeps. Once it reordered the 64k runs and ended in a syntax error after the last one. Once it lost a control's prose test. The runs that completed were valid, and the missing ones had to be rerun.

For a sweep that will run for hours, copy the script before starting and run the copy, or wrap the body in a function called on the last line so bash parses the whole file first:

```
main() {
  ...
}
main "$@"
```

Put follow-up runs in a new queue script, and leave the running one alone.
