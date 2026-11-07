# RFC 0024: Spec catches up with red-team batch 2

Status: accepted

## Problem
Commit 2abd442 (backlog 0071-0089) changed behavior the spec does not state (backlog 0099): form ids came from a process counter; E1003 named only `javascript:`/`data:` in four attributes while the runtime guards seven plus `srcdoc`; action bodies had no size cap; the node adapter needed a DOM global; inspect admitted an absent `Origin` for POST; the ledger's W1706 and unsafe-count E1706 were unspecified.

## Proposal
- k.forms: `form(schema, { initial?, id? })`; field id `<formId>:<path>`, `formId` the explicit `id` else a stable schema-shape hash; a second live form with one `formId` in a render root gets `~2`, `~3`.
- k.compiler states the one URL policy: attributes `href`, `src`, `action`, `formaction`, `xlink:href`, `poster`, `ping`; schemes http/https/mailto/tel; `srcdoc` always `about:blank`. E1003 is any literal the policy blanks; its fix removes the attribute unless the prop is required. k.runtime cites it.
- k.server: body over `createApp({ maxBodyBytes })` (default 1 MiB) is 413 `keel.payloadTooLarge`, nothing runs; `node` renders without a DOM global. k.errors lists the code.
- k.cli Inspect: an absent `Origin` is admitted for GET only. k.server cites k.cli instead of restating it.
- k.testing: E1706 also when the unsafe count rose; W1706 `// Clause:` header, fix rewrites it to `// Spec:`.

## Alternatives
Revert the implementation to the old text: reopens the red-team findings. Restating each policy in every section that touches it: copies drift (0084).

## Spec diff
k.forms API, Bindings, Conformance +1 · k.compiler Escaping by context, Rules E1003, Conformance +2 · k.runtime Ops (cites the policy) · k.server Request flow, Status, Topology, Dev server, Conformance +1 · k.cli Inspect, Conformance +1 · k.testing Rules E1706, W1706 · k.errors kernel codes. New clauses append, so existing clause numbers hold. Map unchanged (E170x already k.testing).

## Conformance diff
Added only: compiler `url-poster`, `url-srcdoc-vbscript`; server `body-cap-413`, `inspect-post-origin` (k.cli clause; `createApp` lives in server); forms `form-ids-stable`.

## Migration
None; behavior shipped in 2abd442. Apps relying on hydrated form ids from the counter get hash ids; pass `id` to pin one.

## Token impact
k.forms 842 -> 953, k.compiler 937 -> 1098, k.runtime 1123 -> 1135, k.server 1126 -> 1160, k.cli 1139 -> 1171, k.testing 1306 -> 1332, k.errors 907 -> 915; all <= 1,500.
