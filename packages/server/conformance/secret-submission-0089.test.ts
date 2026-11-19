// @vitest-environment happy-dom
// Spec: k.forms, clause "No 422 response carries a submitted `s.secret` or password-input value."
// Seed 1337.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { createApp, post } from "./fixtures.ts";

const Login = s.object({
  kind: s.enum(["open", "closed"]),
  pin: s.string(),
  token: s.secret(s.string()),
  note: s.string(),
});

function input(type: string, name: string): Node {
  const e = document.createElement("input");
  e.setAttribute("type", type);
  e.setAttribute("name", name);
  return e;
}

async function build() {
  const act = action({ input: Login }, () => Promise.resolve(ok(null)));
  const routes = manifest({
    "login.show": {
      path: "/login",
      component: () => {
        const f = document.createElement("form");
        f.append(input("password", "pin"), input("text", "token"), input("text", "note"));
        return f;
      },
    },
  });
  routes.actions({ "login.show": { POST: act } });
  return createApp({
    topology: topology({ web: { modules: ["login"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
}

const htmlEscape = (v: string) =>
  v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const jsonInner = (v: string) => JSON.stringify(v).slice(1, -1);
const jsonSafe = (v: string) =>
  jsonInner(v).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");

const meta = fc.string({ unit: fc.constantFrom(..."<>\"'&\\/é☃😀 ab1"), maxLength: 12 });
const secret = meta.map((m) => `Zq7x${m}`);
const word = fc
  .array(fc.constantFrom(..."abcdefghjkmnpqrstuvwxyz"), { minLength: 8, maxLength: 12 })
  .map((a) => `n${a.join("")}`);

test("No 422 response carries a submitted `s.secret` or password-input value", async () => {
  const app = await build();
  await fc.assert(
    fc.asyncProperty(secret, word, async (sec, note) => {
      const pin = sec;
      const token = `${sec}k`;
      const forms = { pin, token, note };
      const doc = await app.fetch(post("/login", forms));
      expect(doc.status).toBe(422);
      const html = await doc.text();
      const rt = await app.fetch(post("/login", forms, { accept: "application/json", "x-keel": "1" }));
      expect(rt.status).toBe(422);
      const json = await rt.text();
      for (const body of [html, json]) {
        for (const v of [pin, token]) {
          for (const form of [v, htmlEscape(v), jsonInner(v), jsonSafe(v)]) expect(body).not.toContain(form);
        }
      }
      expect(html).toContain(note);
    }),
    { seed: 1337, numRuns: 30 },
  );
});
