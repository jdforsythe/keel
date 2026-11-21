// @vitest-environment happy-dom
// A 422 re-render that shows an errorElement instead of the route's own component carries no `form` in `#k-state`
// (k.forms Submit): the password inputs that would name the keys to drop never rendered, so no submitted value
// returns. Covers a loader `err` during the re-render (400) and a component throw its errorElement catches (500).
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SECRET = "PIN-SECRET-123";

async function build(fail: "loader" | "throw" | "none") {
  const c = contract("acct", { "acct.pin": { path: "/pin" } });
  const load = loader(c, "acct.pin", { output: s.object({ n: s.int() }) }, () =>
    Promise.resolve(fail === "loader" ? err({ code: "acct.down", message: "down", data: null }) : ok({ n: 1 })),
  );
  const save = action(c, "acct.pin", { input: s.object({ name: s.string({ min: 3 }), pin: s.string() }) }, () =>
    ok(null),
  );
  const routes = manifest(c, {
    "acct.pin": {
      loader: load,
      component: () => {
        if (fail === "throw") throw new Error("page broke");
        const f = document.createElement("form");
        const name = document.createElement("input");
        name.name = "name";
        const pin = document.createElement("input");
        pin.type = "password";
        pin.name = "pin";
        f.append(name, pin);
        return f;
      },
      errorElement: ({ error }) => {
        const p = document.createElement("p");
        p.setAttribute("data-error", error.code);
        return p;
      },
      POST: save,
    },
  });
  return createApp({
    topology: topology({ web: { modules: ["acct"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
  });
}

const post = (): Request => {
  const fd = new FormData();
  fd.set("name", "a");
  fd.set("pin", SECRET);
  return new Request("http://localhost/pin", { method: "POST", body: fd });
};

const kState = (html: string): unknown => {
  const m = /<script type="application\/json" id="k-state">([\s\S]*?)<\/script>/.exec(html);
  return m === null ? null : JSON.parse(m[1] ?? "null");
};

describe("a 422 re-render at an errorElement carries no submission", () => {
  it("loader err during the re-render: 400, no form, no password", async () => {
    const res = await (await build("loader")).fetch(post());
    const html = await res.text();
    expect(res.status).toBe(400);
    expect(html).not.toContain(SECRET);
    expect(Object.hasOwn(Object(kState(html)), "form")).toBe(false);
  });

  it("component throw caught by its errorElement: 500, no form, no password", async () => {
    const res = await (await build("throw")).fetch(post());
    const html = await res.text();
    expect(res.status).toBe(500);
    expect(html).not.toContain(SECRET);
    expect(Object.hasOwn(Object(kState(html)), "form")).toBe(false);
  });

  it("the route's own component rendered: 422, form kept less the password", async () => {
    const res = await (await build("none")).fetch(post());
    const html = await res.text();
    expect(res.status).toBe(422);
    expect(html).not.toContain(SECRET);
    expect(kState(html)).toMatchObject({ form: { values: { name: "a" } } });
  });
});
