---
"@keel/std-workflows": patch
---

E2352 and W2353 report on the workflow file and read its chart from that file or from the chart file among the project's code files, whether or not the chart file is itself checked. A chart event named `start`, `attempt` or `forget` is E2355: `workflow` throws it and `keel check` reports it at the workflow's `chart`.
