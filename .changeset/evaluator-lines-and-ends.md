---
"@keel/compiler": patch
---

`evaluate` reads its evaluator's lines with care: a result that is no JSON, a line that is no JSON and a line past 64 MiB are E1049, and every message that crosses back loses its control characters. A `process.exit(13)` the evaluated code calls is E1049 with that exit, and only Node's exit for a top-level await that can never settle is E1048. A shell that refuses the processor-time limit still starts the evaluation.
