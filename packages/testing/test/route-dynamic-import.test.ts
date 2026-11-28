// @vitest-environment happy-dom
// k.testing Harness: `renderRoute` resolves once a loader that awaits a first dynamic `import()` has resolved, and a loader
// that never resolves rejects with "fire did not settle" naming its route. Seed: 1337.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";

const text = (t: string): Node => {
  const e = document.createElement("p");
  e.id = "dyn.text";
  e.textContent = t;
  return e;
};
const Out = s.object({ text: s.string() });
const c = contract("dyn", {
  "dyn.page": { path: "/dyn" },
  "dyn.never": { path: "/never" },
});
const routes = manifest(c, {
  "dyn.page": {
    loader: loader(c, "dyn.page", { output: Out }, async () => {
      const m = await import("./support/lazyText.ts");
      return ok({ text: m.lazyText });
    }),
    component: (props) => text(String(Reflect.get(Object(props.data), "text"))),
  },
  "dyn.never": {
    loader: loader(c, "dyn.never", { output: Out }, async () => {
      await new Promise<never>(() => undefined);
      return ok({ text: "never" });
    }),
    component: () => text("never"),
  },
});

describe("renderRoute with a loader that loads a module", () => {
  it("resolves with the loader's data rendered after its first dynamic import", async () => {
    const t = await renderRoute("dyn.page", { routes, ctx: createCtx({ mode: "sim", seed: 1337 }) });
    expect(t.route()).toMatchObject({ id: "dyn.page", pending: false });
    expect(document.getElementById("dyn.text")?.textContent).toBe("loaded lazily");
    t.dispose();
  });

  it(
    "a loader that never resolves rejects with keel.unexpected naming the route",
    async () => {
      await expect(renderRoute("dyn.never", { routes, ctx: createCtx({ mode: "sim", seed: 1337 }) })).rejects.toThrow(
        /^keel\.unexpected fire did not settle: dyn\.never still loading after 200000 macrotask turns/,
      );
    },
    fixedTime(30_000),
  );
});
