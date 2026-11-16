// A std config bound before `@keel/std-credentials` registers its schema is not checked at bind; `credentials(ctx)`
// throws E1158 naming the path. Bound after the package loaded, the same config is E1158 at bind.
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import { expect, test } from "vitest";

test("credentials(ctx) throws E1158 naming ln for a ctx bound to an invalid config before the package loaded", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  bindStd(ctx, { "@keel/std-credentials": { a: { ln: 99 } } });
  const { credentials } = await import("@keel/std-credentials/server");
  expect(() => credentials(ctx)).toThrow(/E1158.*ln/);
});

test("the same config bound after the package loads is E1158 at bind", async () => {
  await import("@keel/std-credentials/server");
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  expect(() => bindStd(ctx, { "@keel/std-credentials": { a: { ln: 99 } } })).toThrow(/E1158/);
});
