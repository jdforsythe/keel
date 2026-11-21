// @vitest-environment happy-dom
// Spec: k.ui, clause "`Text role="status"` and `Text role="alert"` write that `role` attribute in server and client output; a `Text` without `role` writes none; any other `role` is a type error."
// Seed 1337 (RFC 0176 clause k.ui #16). The server-output half; the client half is packages/ui/conformance/text-role-live.test.ts.
// Pending: not built. The test that needs `Text` to take `role` is skipped; `role` is reached through a variable so this file type-checks before the prop exists.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import { Text } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;

const serverRole = async (role: string | undefined, children: string): Promise<string | null> => {
  const props = role === undefined ? { id: "x", children } : { id: "x", role, children };
  const appContract = contract("app", { "app.home": { path: "/" } });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.home": { component: () => Text(props) } }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
  });
  const res = await app.fetch(new Request("http://localhost/"));
  const tpl = document.createElement("template");
  tpl.innerHTML = await res.text();
  return tpl.content.getElementById("x")?.getAttribute("role") ?? null;
};

describe("k.ui Text role (server output)", () => {
  test.skip('`Text role="status"` and `Text role="alert"` write that `role` attribute in server output', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("status", "alert"),
        fc.stringMatching(/^[a-z]{0,10}$/),
        async (role, children) => {
          expect(await serverRole(role, children)).toBe(role);
        },
      ),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("a `Text` without `role` writes none in server output", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,10}$/), async (children) => {
        expect(await serverRole(undefined, children)).toBeNull();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
