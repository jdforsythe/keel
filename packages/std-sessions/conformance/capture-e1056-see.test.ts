// Spec: k.docs, clause "A diagnostic with `see` `k.ui` prints `see: keel docs k.ui` in compact and pretty, and `\"see\":\"k.ui\"` in json." (OUTPUT.md: `see` is a spec section id.)
// RFC 0247, Conformance (after the second review): k.inspect holds E1056, so `keel session capture`'s E1056 carries `see` `k.inspect`, not `k.cli`.
// @vitest-environment node
// Seed 1337
// ASSUMED: the section that holds a code is the `see` of its diagnostic. std.sessions Commands still writes "E1056 (k.cli)": the spec sentence to make exact.
import { run } from "@keel/cli";
import "@keel/std-sessions/tools";
import { expect, test } from "vitest";

const doc = { live: true, graph: { nodes: [], edges: [] }, stores: {}, ids: {}, a11y: {}, routes: {}, sections: {} };

test("`keel session capture` with no `sessions.live` section emits E1056 whose `see` is k.inspect, in compact and json", async () => {
  const io = {
    cwd: ".",
    files: [],
    fetch: () => Promise.resolve(new Response(JSON.stringify(doc), { status: 200 })),
    apply: () => undefined,
  };
  const c = await run(["session", "capture", "http://localhost:5173", "--format=compact"], io);
  expect(c.stdout).toMatch(/^E1056 /m);
  expect(c.stdout).toMatch(/^\s*see: (?:pnpm )?keel docs k\.inspect$/m);
  expect(c.stdout).not.toContain("k.cli");
  const j = await run(["session", "capture", "http://localhost:5173", "--format=json"], io);
  expect(j.stdout).toContain('"see":"k.inspect"');
});
