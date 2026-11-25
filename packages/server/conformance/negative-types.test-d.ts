// Negative type test (k.unsafe): type-checked by the package's `check`, never run, imported by no file. Each `@ts-expect-error` line is one claim that a call does not compile; its run-time half sits in
// `conformance/api-output-0104.test.ts`, which makes the same call untyped.
import { action, loader } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";

export function conformanceNegativeTypes(): void {
  // type-level negatives: each expected-error line asserts the server-state API rejects a misuse
  const N = s.object({ n: s.int() });
  const Notes = s.object({ items: s.array(s.int()) });
  const post = contract("api", { "api.add": { method: "POST", path: "/api/notes", body: N, output: N } });
  // @ts-expect-error `n` is an int; a string is refused by the entry's output
  action(post, "api.add", {}, async () => ok({ n: "x" }));
  const get = contract("api", { "api.notes": { method: "GET", path: "/api/notes", output: Notes } });
  // @ts-expect-error `items` is an array of ints
  loader(get, "api.notes", {}, async () => ok({ items: "x" }));
}
