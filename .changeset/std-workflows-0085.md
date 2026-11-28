---
"@keel/std-workflows": minor
---

`workflow(id, { chart, steps?, waits?, keepMs?, limit?, attempts?, timeoutMs? })` declares a chart run per instance in one server store with transactions `start`, one per chart event, `attempt` and `forget`, and the std.jobs jobs of its steps, waits and final instances; `flows(queue, workflows)` is the runner that enqueues them. Inspect section `workflows.instances`; stdlib module `workflows`; rules E2351-E2354 from `./tools`.
