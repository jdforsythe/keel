// @vitest-environment happy-dom
// k.forms Submit, k.server: a 422 re-render drops the value of each input the served page renders as a password,
// however the component made it (the `type` property, an attribute in any case, markup set as `innerHTML` in any
// quoting), since the server's serializer writes each one as `type="password"`. A field whose input the browser alone
// makes a password is not one the server sees; an `s.secret` field is dropped whatever its input. Seed 1337.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const V = "pw-value-4c1e";

async function post(fields: readonly string[], make: () => Node) {
  const shape: Record<string, ReturnType<typeof s.string>> = {};
  for (const f of fields) shape[f] = s.string();
  const input = s.object({ ...shape, hidden: s.secret(s.string()), age: s.int() });
  const routes = manifest({ "app.f": { path: "/f", component: make } });
  routes.actions({ "app.f": { POST: action({ input }, () => ok(null)) } });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    log: { format: "json", write: () => undefined },
  });
  const fd = new FormData();
  for (const f of fields) fd.set(f, `${V}-${f}`);
  fd.set("hidden", `${V}-hidden`);
  fd.set("age", "x");
  const res = await app.fetch(new Request("http://localhost/f", { method: "POST", body: fd }));
  const body = await res.text();
  await app.close();
  return { status: res.status, body };
}

describe("a password input in the served page", () => {
  it("is dropped however the component made it", async () => {
    const { status, body } = await post(["a", "b", "c", "d", "e", "plain"], () => {
      const f = document.createElement("form");
      const a = document.createElement("input");
      a.type = "password";
      a.name = "a";
      const b = document.createElement("input");
      b.setAttribute("TYPE", "PassWord");
      b.setAttribute("NAME", "b");
      const box = document.createElement("div");
      box.innerHTML = `<input type=password name=c><INPUT NAME='d' TYPE='PASSWORD'><input name="e"\ttype="password">`;
      const plain = document.createElement("input");
      plain.name = "plain";
      f.append(a, b, box, plain);
      return f;
    });
    expect(status).toBe(422);
    for (const k of ["a", "b", "c", "d", "e", "hidden"]) expect(body).not.toContain(`${V}-${k}`);
    expect(body).toContain(`${V}-plain`);
  });
});
