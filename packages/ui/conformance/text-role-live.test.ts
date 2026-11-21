// @vitest-environment happy-dom
// Spec: k.ui, clause "`Text role="status"` and `Text role="alert"` write that `role` attribute in server and client output; a `Text` without `role` writes none; any other `role` is a type error."
// Seed 1337 (RFC 0176 clause k.ui #16). The client-output half; the server-output half is packages/server/conformance/text-role-server.test.ts.
// Pending: not built. The tests that need `Text` to take `role` are skipped; `role` is reached through a variable so this file type-checks before the prop exists.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { Text } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, expectTypeOf, test } from "vitest";

const SEED = 1337;
const simCtx = createCtx({ mode: "sim", seed: 1337 });
const roles = ["status", "alert"] as const;

const clientRole = (role: string | undefined, children: string): string | null => {
  const props = role === undefined ? { id: "x", children } : { id: "x", role, children };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(() => Text(props), host, { ctx: simCtx });
  const value = document.getElementById("x")?.getAttribute("role") ?? null;
  off();
  host.remove();
  return value;
};

describe("k.ui Text role (client output)", () => {
  test.skip('`Text role="status"` and `Text role="alert"` write that `role` attribute in client output', () => {
    fc.assert(
      fc.property(fc.constantFrom(...roles), fc.stringMatching(/^[a-z]{0,10}$/), (role, children) => {
        expect(clientRole(role, children)).toBe(role);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a `Text` without `role` writes none in client output", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,10}$/), (children) => {
        expect(clientRole(undefined, children)).toBeNull();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test.skip("any other `role` is a type error: the `role` prop is `'status' | 'alert'` and optional", () => {
    type RoleProp = Parameters<typeof Text>[0] extends { readonly role?: infer R } ? R : never;
    // Before the prop exists RoleProp is never and Expected follows it, so tsc stays green; once built it must be exactly the closed pair.
    type Expected = [RoleProp] extends [never] ? never : "status" | "alert" | undefined;
    expectTypeOf<RoleProp>().toEqualTypeOf<Expected>();
    expectTypeOf<"button">().not.toExtend<RoleProp>();
    expectTypeOf<"log">().not.toExtend<RoleProp>();
    expectTypeOf<string>().not.toExtend<RoleProp>();
  });
});
