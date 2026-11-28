// Spec: k.expect, clause "`keelError.denied.make({})` deep-equals `{ code: 'keel.denied', message: 'keel.denied', data: {} }`; `notFound`, `conflict`, `unreachable` and `busy` give their codes the same way; `keelError.fields.make({ 'address.city': 'Taken' })` has code `keel.fields` and that data; a guard returning `err(keelError.denied.make({}))` on a node server answers 403, and an action returning that `fields` error answers 422."
// @vitest-environment happy-dom
// Seed 1337 (fixed requests). Not yet exported: `keelError` is `@keel/schema`'s once built, so this file does not typecheck and fails for want of it until then.
// The value half of the clause is packages/schema/conformance/keel-error-makers.test.ts.
import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, keelError, ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { describe, expect, it } from "vitest";
import { SEED, createApp, get, post } from "./fixtures.ts";

const Nothing = s.object({});
const Input = s.object({ city: s.string() });

async function boot() {
  const c = contract("p", {
    "p.deny": { method: "GET", path: "/api/deny", output: Nothing },
    "p.save": { method: "POST", path: "/api/save", body: Input, output: Nothing },
  });
  const denyGuard = guard({}, async () => err(keelError.denied.make({})));
  const deny = loader(c, "p.deny", {}, async () => ok({}));
  const save = action(c, "p.save", {}, async () => err(keelError.fields.make({ city: "Taken" })));
  const routes = manifest(c, {
    "p.deny": { guard: denyGuard, loader: deny },
    "p.save": { action: save },
  });
  return createApp({
    topology: topology({ web: { modules: ["p"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "production",
  });
}

describe("k.expect Made errors: keelError on a node server", () => {
  it("a guard returning `err(keelError.denied.make({}))` on a node server answers 403", async () => {
    const app = await boot();
    const res = await app.fetch(get("/api/deny", { accept: "application/json" }));
    expect(res.status).toBe(403);
  });

  it("an action returning `err(keelError.fields.make(...))` answers 422 with the field message", async () => {
    const app = await boot();
    const res = await app.fetch(post("/api/save", { city: "x" }, { accept: "application/json" }));
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("Taken");
  });
});
