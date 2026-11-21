// Type-only fixture for conformance/api-output-0104.test.ts (in unsafe/ because it needs expected-error directives):
// checked by tsc, never run. The conformance file makes the same calls untyped.
import { action, loader } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";

export function conformanceNegativeTypes(): void {
  const N = s.object({ n: s.int() });
  const Notes = s.object({ items: s.array(s.int()) });
  const post = contract("api", { "api.add": { method: "POST", path: "/api/notes", body: N, output: N } });
  // @ts-expect-error `n` is an int; a string is refused by the entry's output
  action(post, "api.add", {}, async () => ok({ n: "x" }));
  const get = contract("api", { "api.notes": { method: "GET", path: "/api/notes", output: Notes } });
  // @ts-expect-error `items` is an array of ints
  loader(get, "api.notes", {}, async () => ok({ items: "x" }));
}
