// Spec: k.user, Conformance "With `caller: { days: 30 }`, `pii.json` has `caller: { days: 30, class: 'network' }` and a std.sessions capture of a `tx` whose `meta.caller` is a hash holds a generated value; without it, `{ days: null, class: null }`."
// Untestable from the public API as specified: no spec text says how `record` learns the deployable's `caller: { days }`, or where a `tx` event's `meta` appears in a `Session`; the `pii.json` half is packages/cli/conformance/evidence-caller.test.ts.
import { test } from "vitest";

test.todo(
  "a std.sessions capture of a `tx` whose `meta.caller` is a hash holds a generated value under `caller: { days: 30 }`",
);
