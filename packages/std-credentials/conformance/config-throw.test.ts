// Spec: std.credentials, API "`credentials(ctx)` throws E1158 (k.module) for a ctx bound, before this package loaded, to a std config that fails its schema."
// Seed: 1337.
// Assumption: a std config reaches a ctx through `bindStd` of `@keel/compiler/std/bindStd`; this file imports nothing from `@keel/std-credentials` at the top, so the server entry loads inside the tests.
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { expect, test } from "vitest";

const SEED = 1337;
const BAD = { "@keel/std-credentials": { a: { ln: 99 } } };

const thrownBy = (run: () => unknown): { code?: unknown; message?: unknown } => {
  try {
    run();
  } catch (e) {
    if (typeof e === "object" && e !== null)
      return { code: Reflect.get(e, "code"), message: Reflect.get(e, "message") };
    return {};
  }
  throw new Error("expected a throw");
};

// Order matters: vitest shares one module registry per file, so the first test runs before the package has loaded.
test("`credentials(ctx)` throws E1158 (k.module) for a ctx bound, before this package loaded, to a std config that fails its schema.", async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  bindStd(ctx, BAD);
  const { credentials } = await import("@keel/std-credentials/server");
  const e = thrownBy(() => credentials(ctx));
  expect(e.code).toBe("E1158");
  expect(String(e.message)).toContain("ln");
});

test("a ctx bound to the same failing std config after the package loaded throws E1158 at the bind.", () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const e = thrownBy(() => bindStd(ctx, BAD));
  expect(e.code).toBe("E1158");
  expect(String(e.message)).toContain("ln");
});

test("a ctx bound to a valid std config hashes with that cost and nothing throws.", async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  bindStd(ctx, { "@keel/std-credentials": { a: { ln: 18 } } });
  const { credentials } = await import("@keel/std-credentials/server");
  const parsed = s.secret(s.string()).parse("s-config-secret-1");
  if (!parsed.ok) throw new Error("fixture: a string does not parse as a secret");
  const h = await credentials(ctx).hash(parsed.value);
  expect(h.ok).toBe(true);
  if (h.ok) expect(h.value.startsWith("$scrypt-sim$ln=18,")).toBe(true);
});
