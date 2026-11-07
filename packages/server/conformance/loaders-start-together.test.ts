// @vitest-environment happy-dom
// Spec: k.server, clause "All loaders of a matched chain start before any of them resolves."
import { describe, expect, it } from "vitest";
import { ok } from "@keel/schema";
import { build, deferred, get } from "./fixtures.ts";

describe("k.server", () => {
  it("All loaders of a matched chain start before any of them resolves", async () => {
    const gate = deferred();
    const started = { root: deferred(), shell: deferred(), show: deferred() };
    const held = (d: ReturnType<typeof deferred>) => () => {
      d.resolve();
      return gate.promise.then(() => ok({ title: "T" }));
    };
    const { app } = await build({
      root: held(started.root),
      shell: held(started.shell),
      show: () => held(started.show)(),
    });
    const res = app.fetch(get("/orders/open"));
    // Gate stays closed until all three have started; a sequential server never gets here.
    await Promise.all([started.root.promise, started.shell.promise, started.show.promise]);
    gate.resolve();
    expect((await res).status).toBe(200);
  });
});
