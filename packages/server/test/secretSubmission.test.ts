// @vitest-environment happy-dom
// A rejected submission never echoes a secret value (k.server Request flow, k.forms Submit): a field whose input
// schema is `s.secret` (any nesting) or that the page renders as a `type="password"` input is absent from the 422
// document (`#k-state` included), the runtime JSON 422 body, and the dev log stream; the other fields keep their
// values and every field error still shows. Property (seed 1337) over secret strings with HTML and JSON metacharacters.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { secretKey } from "../src/internal/secretKey.ts";
import { withoutPasswords } from "../src/internal/withoutPasswords.ts";

const SEED = 1337;
const BASE = "http://localhost";

const Input = s.object({
  name: s.string({ min: 3 }),
  pin: s.string({ min: 99 }),
  creds: s.object({ token: s.secret(s.string({ min: 99 })) }),
  keys: s.array(s.secret(s.string())).optional(),
  age: s.int(),
});

const control = (type: string, name: string): HTMLInputElement => {
  const el = document.createElement("input");
  el.type = type;
  el.name = name;
  return el;
};

async function build() {
  const lines: string[] = [];
  let called = 0;
  const c = contract("acct", { "acct.signup": { path: "/signup" } });
  const signup = action(c, "acct.signup", { input: Input }, () => {
    called += 1;
    return ok(null);
  });
  const routes = manifest(c, {
    "acct.signup": {
      component: () => {
        const f = document.createElement("form");
        f.append(control("text", "name"), control("password", "pin"), control("text", "creds.token"));
        return f;
      },
      POST: signup,
    },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["acct"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  return { app, lines, calls: () => called };
}

type Sent = { name: string; pin: string; token: string; key: string };

const formOf = (v: Sent): FormData => {
  const fd = new FormData();
  fd.set("name", v.name);
  fd.set("pin", v.pin);
  fd.set("creds.token", v.token);
  fd.append("keys", v.key);
  fd.append("keys", v.key);
  fd.set("age", "not a number");
  return fd;
};

const documentPost = (v: Sent): Request => new Request(`${BASE}/signup`, { method: "POST", body: formOf(v) });
const runtimePost = (v: Sent): Request =>
  new Request(`${BASE}/signup`, {
    method: "POST",
    body: JSON.stringify({
      name: v.name,
      pin: v.pin,
      creds: { token: v.token },
      keys: [v.key],
      age: "x",
    }),
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-keel": "1",
    },
  });
const runtimeForm = (v: Sent): Request =>
  new Request(`${BASE}/signup`, {
    method: "POST",
    body: formOf(v),
    headers: { accept: "application/json" },
  });

const kState = (html: string): unknown => {
  const m = /<script type="application\/json" id="k-state">([\s\S]*?)<\/script>/.exec(html);
  return m === null ? null : JSON.parse(m[1] ?? "null");
};
const formIn = (state: unknown): unknown =>
  typeof state === "object" && state !== null ? Reflect.get(state, "form") : undefined;

// Distinct, recognisable secret strings with HTML and JSON metacharacters around a random core.
const secretText = fc
  .tuple(
    fc.constantFrom("", "<", ">", "&", '"', "'", "\\", "</script>", "\u2028", "{", "}", "\n"),
    fc.stringMatching(/^[a-zA-Z0-9]{12,24}$/),
    fc.constantFrom("", "<", "&amp;", '"', "\\u003c", "]", "\t"),
  )
  .map(([a, core, b]) => `${a}S3cr3t${core}${b}`);

// Every way the string could show in a response: raw, HTML-escaped, JSON-escaped, `#k-state`-escaped.
const shapes = (secret: string): string[] => {
  const json = JSON.stringify(secret).slice(1, -1);
  const html = secret
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const state = json.replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
  const core = /S3cr3t[a-zA-Z0-9]+/.exec(secret)?.[0] ?? secret;
  return [secret, json, html, state, core];
};

describe("a rejected submission never echoes a secret", () => {
  it("document 422: the password and s.secret values are absent; others kept; errors shown", async () => {
    const { app, lines, calls } = await build();
    const v = {
      name: "al",
      pin: "hunter2-pin",
      token: "tok-SECRET-1",
      key: "key-SECRET-2",
    };
    const res = await app.fetch(documentPost(v));
    const html = await res.text();
    expect(res.status).toBe(422);
    expect(calls()).toBe(0);
    for (const secret of [v.pin, v.token, v.key]) {
      expect(html).not.toContain(secret);
      expect(lines.join("\n")).not.toContain(secret);
    }
    const form = formIn(kState(html));
    expect(form).toMatchObject({ values: { name: "al", age: "not a number" } });
    expect(Object.keys(Reflect.get(Object(form), "values"))).toEqual(["name", "age"]);
    expect(Object.keys(Reflect.get(Object(form), "errors"))).toEqual(
      expect.arrayContaining(["name", "pin", "creds.token", "age"]),
    );
    expect(html).toContain('data-field="pin"');
    expect(html).toContain('data-field="creds.token"');
  });

  it("runtime 422 (JSON body and FormData): no secret in the body or the log", async () => {
    const { app, lines } = await build();
    const v = {
      name: "al",
      pin: "hunter2-pin",
      token: "tok-SECRET-1",
      key: "key-SECRET-2",
    };
    for (const req of [runtimePost(v), runtimeForm(v)]) {
      const res = await app.fetch(req);
      const body = await res.text();
      expect(res.status).toBe(422);
      for (const secret of [v.pin, v.token, v.key]) expect(body).not.toContain(secret);
    }
    for (const secret of [v.pin, v.token, v.key]) expect(lines.join("\n")).not.toContain(secret);
  });

  it("property: no generated secret string reaches any 422 response (seed 1337)", async () => {
    const { app, lines } = await build();
    await fc.assert(
      fc.asyncProperty(secretText, secretText, secretText, async (pin, token, key) => {
        const v = { name: "al", pin, token, key };
        const bodies: string[] = [];
        for (const req of [documentPost(v), runtimePost(v), runtimeForm(v)]) {
          const res = await app.fetch(req);
          expect(res.status).toBe(422);
          bodies.push(await res.text());
        }
        const seen = [...bodies, ...lines].join("\n");
        for (const secret of [pin, token, key]) for (const shape of shapes(secret)) expect(seen).not.toContain(shape);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});

describe("secretKey and withoutPasswords", () => {
  const Deep = s.object({
    a: s.string(),
    b: s.secret(s.string()).optional(),
    list: s.array(s.object({ k: s.secret(s.string()), n: s.int() })),
    map: s.record(s.secret(s.string())),
    pick: s.union("t", [
      s.object({ t: s.literal("x"), v: s.secret(s.string()) }),
      s.object({ t: s.literal("y"), v: s.string() }),
    ]),
    whole: s.secret(s.object({ in: s.string() })),
  });
  it("a key reaching an s.secret node at any nesting is secret; others are not", () => {
    // Under an array, record or union holding a secret every key is secret (`list.0.n`, `pick.t`): the safe direction.
    const hidden = [
      "b",
      "b[]",
      "list.0.k",
      "list.0.n",
      "list",
      "map.anything",
      "map.a.b",
      "pick.v",
      "pick.t",
      "whole",
      "whole.in",
    ];
    const shown = ["a", "missing", "", "a.b"];
    for (const k of hidden) expect(secretKey(Deep.node, k), k).toBe(true);
    for (const k of shown) expect(secretKey(Deep.node, k), k).toBe(false);
    expect(secretKey(s.secret(s.string()).node, "anything")).toBe(true);
  });
  it("withoutPasswords drops only keys named by a password input in the html", () => {
    const html = '<input type="text" name="a"><input name="p&amp;q" TYPE="password"><input type="PASSWORD" name="c">';
    expect(withoutPasswords({ a: "1", "p&q": "2", c: "3", d: "4" }, html)).toEqual({ a: "1", d: "4" });
    expect(withoutPasswords({ a: "1" }, '<input type="password" name="a">')).toEqual({});
  });
});
