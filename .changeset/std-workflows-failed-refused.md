---
"@keel/std-workflows": patch
---
A step whose `failed` event refuses the failure code no longer strands its instance in the step state: the job counts an attempt and runs again, commits `failed` with `workflows.attempts` once the attempts are used, and, if that is refused too, ends in std.jobs `failed` with the refusal's code.
