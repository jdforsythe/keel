// @vitest-environment node
// k.privacy Server log beyond its conformance: a throwing action's dev JSON error, its diag, and a throwing loader's diag
// hold no `.pii()` value of the input, a store state the action changed or another loader's output, and no revealed
// value of a `Secret` in the input. Seed 1337.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type Infer, ok, reveal, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { redacted } from "../src/internal/redacted.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";
import { scrubbedCause } from "../src/internal/scrubbedCause.ts";
import { unexpectedOf } from "../src/internal/unexpectedOf.ts";
import { textRecords } from "./textRecords.ts";

const Notes = s.object({ items: s.array(s.string().pii("content")) });
const Text = s.object({ text: s.string() });
const notesStores = () => {
  const notes = store(Notes, { items: [] }, { id: "test.notes" });
  const add = transaction(notes, "test.add", Text, (st, p) => ({ items: [...st.items, p.text] }));
  return { notes, add };
};

async function build(lines: string[]) {
  const c = contract("app", {
    "app.a": { path: "/a" },
    "app.b": { layout: true },
    "app.b.c": { path: "/b/c" },
  });
  const loadB = loader(c, "app.b", { output: s.object({ who: s.string().pii("name") }) }, async () =>
    ok({ who: "ada lovelace" }),
  );
  const loadC = loader(c, "app.b.c", { output: s.object({}) }, async () => {
    await Promise.resolve();
    throw new Error("no luck for ada lovelace");
  });
  const mail = action(
    c,
    "app.a",
    { input: s.object({ email: s.string().pii("contact") }), stores: notesStores },
    (input, { stores }) => {
      tx(stores.add, { text: "my diary entry" });
      throw new Error(`cannot mail ${input.email} about my diary entry`);
    },
  );
  const routes = manifest(c, {
    "app.a": { component: () => document.createElement("main"), POST: mail },
    "app.b": { loader: loadB, component: () => document.createElement("div") },
    "app.b.c": { layout: "app.b", loader: loadC, component: () => document.createElement("main") },
  });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    log: { format: "compact", write: (l) => lines.push(l) },
  });
}

describe("diag scrub", () => {
  it("a throwing action returns and logs neither its marked input nor a marked store value it wrote", async () => {
    const lines: string[] = [];
    const app = await build(lines);
    const res = await app.fetch(
      new Request("http://localhost/a", {
        method: "POST",
        body: JSON.stringify({ email: "ada@example.test" }),
        headers: { "content-type": "application/json", accept: "application/json" },
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.text();
    const diag = textRecords(lines).filter((l) => l.startsWith("keel.unexpected "));
    expect(diag).toEqual(["keel.unexpected action app.a threw: Error: cannot mail [pii] about [pii]"]);
    for (const text of [body, ...lines]) {
      expect(text).not.toContain("ada@example.test");
      expect(text).not.toContain("diary");
    }
  });

  it("a throwing loader's diag drops a marked output of its layout's loader", async () => {
    const lines: string[] = [];
    const app = await build(lines);
    await app.fetch(new Request("http://localhost/b/c"));
    expect(textRecords(lines).filter((l) => l.startsWith("keel.unexpected "))).toEqual([
      "keel.unexpected loader app.b.c threw: Error: no luck for [pii]",
    ]);
  });
});

describe("marked record keys", () => {
  it("a throwing action's diag drops the keys of a marked record in its input", async () => {
    const lines: string[] = [];
    const c = contract("app", { "app.a": { path: "/a" } });
    const input = s.object({ notes: s.record(s.string()).pii("content") });
    const file = action(c, "app.a", { input }, (v) => {
      throw new Error(`cannot file ${Object.keys(v.notes).join(" ")}`);
    });
    const routes = manifest(c, { "app.a": { component: () => document.createElement("main"), POST: file } });
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      mode: "dev",
      log: { format: "compact", write: (l) => lines.push(l) },
    });
    const res = await app.fetch(
      new Request("http://localhost/a", {
        method: "POST",
        body: JSON.stringify({ notes: { "maria hernandez": "x1y" } }),
        headers: { "content-type": "application/json", accept: "application/json" },
      }),
    );
    expect(res.status).toBe(500);
    expect(textRecords(lines).filter((l) => l.startsWith("keel.unexpected "))).toEqual([
      "keel.unexpected action app.a threw: Error: cannot file [pii]",
    ]);
    expect(await res.text()).not.toContain("maria");
  });
});

describe("scrubbed", () => {
  const addr = 'Flat "2"\n1 Main St';
  it("replaces a value's URL-encoded, JSON-escaped, case-folded and base64 forms", () => {
    const one = (m: string, v: string) => scrubbed(m, [[new Set([v]), "[pii]"]]);
    expect(one(`bad ${encodeURIComponent("ada@example.test")}`, "ada@example.test")).toBe("bad [pii]");
    expect(one(`bad ${JSON.stringify({ addr })}`, addr)).toBe('bad {"addr":"[pii]"}');
    expect(one("hi ADA LOVELACE and Ada Lovelace", "ada lovelace")).toBe("hi [pii] and [pii]");
    expect(one(`token ${btoa("ada lovelace")}`, "ada lovelace")).toBe("token [pii]");
    expect(one("a+b (c) [d]", "(c)")).toBe("a+b [pii] [d]");
  });

  it("replaces a value under 3 characters only as a whole token", () => {
    const four = new Set(["4"]);
    expect(scrubbed("store orders.v4 failed at 14:04, qty 4", [[four, "[pii]"]])).toBe(
      "store orders.v4 failed at 14:04, qty [pii]",
    );
    expect(scrubbed("id ab, tab, AB.", [[new Set(["ab"]), "[pii]"]])).toBe("id [pii], tab, [pii].");
  });

  it("property: no form of a marked word survives, and unmarked digits stay", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,12}( [a-z]{1,8})?$/), fc.integer({ min: 0, max: 3 }), (v, form) => {
        const shown = [v, encodeURIComponent(v), v.toUpperCase(), JSON.stringify(v).slice(1, -1)][form] ?? v;
        const out = scrubbed(`x 123 ${shown} 456`, [[new Set([v]), "[pii]"]]);
        expect(out).toBe("x 123 [pii] 456");
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});

describe("scrubbed with the [secret] mark", () => {
  const key = 'k"1\n+/z';
  const one = (m: string, v: string) => scrubbed(m, [[new Set([v]), "[secret]"]]);
  it("replaces a value as is and in its URL-encoded, JSON-escaped, case-folded and base64 forms", () => {
    expect(one("bad tok-7f3a9c.", "tok-7f3a9c")).toBe("bad [secret].");
    expect(one(`bad ${encodeURIComponent(key)}`, key)).toBe("bad [secret]");
    expect(one(`bad ${JSON.stringify({ key })}`, key)).toBe('bad {"key":"[secret]"}');
    expect(one("hi TOK-7F3A9C", "tok-7f3a9c")).toBe("hi [secret]");
    expect(one(`token ${btoa("tok-7f3a9c")}`, "tok-7f3a9c")).toBe("token [secret]");
  });

  it("replaces a value under 3 characters only as a whole token", () => {
    expect(one("pin 7 of 17 at 07:07, v7", "7")).toBe("pin [secret] of 17 at 07:07, v7");
    expect(one("ok: a token, a.", "a")).toBe("ok: [secret] token, [secret].");
  });

  it("leaves the message as it is when the set is empty", () => {
    expect(scrubbed("nothing to hide", [[new Set(), "[secret]"]])).toBe("nothing to hide");
  });

  it("property: no form of a secret survives, and other text stays", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,12}[-_ ][a-z0-9]{1,8}$/), fc.integer({ min: 0, max: 4 }), (v, form) => {
        const shown = [v, encodeURIComponent(v), v.toUpperCase(), JSON.stringify(v).slice(1, -1), btoa(v)][form] ?? v;
        expect(one(`x 123 ${shown} 456`, v)).toBe("x 123 [secret] 456");
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});

describe("redacted", () => {
  const rq = { pii: new Set(["ada@example.test"]), secrets: new Set(["tok-7f3a9c", "ada@example.test"]) };
  it("marks a pii value and a secret in one message, each with its own mark", () => {
    const apart = { pii: rq.pii, secrets: new Set(["tok-7f3a9c"]) };
    expect(redacted("mail ada@example.test with tok-7f3a9c failed", apart)).toBe("mail [pii] with [secret] failed");
  });

  it("a value in both sets reads [secret]", () => {
    expect(redacted("ADA@EXAMPLE.TEST", rq)).toBe("[secret]");
  });

  it("with no secret noted, writes what the [pii] pass writes", () => {
    expect(redacted("mail ada@example.test with tok-7f3a9c", { pii: rq.pii, secrets: new Set() })).toBe(
      "mail [pii] with tok-7f3a9c",
    );
  });
});

describe("scrubbedCause", () => {
  const thrown = (message: string) => {
    return unexpectedOf(new Error(message));
  };
  it("drops secrets and pii values from the cause and the message", () => {
    const rq = { pii: new Set(["ada lovelace"]), secrets: new Set(["tok-7f3a9c"]) };
    const clean = scrubbedCause(thrown("ada lovelace sent tok-7f3a9c"), rq);
    expect(clean).toEqual({
      code: "keel.unexpected",
      message: "Error: [pii] sent [secret]",
      data: { cause: "Error: [pii] sent [secret]" },
    });
  });

  it("clips the message again from the scrubbed cause, so no clipped half of a secret is left", () => {
    const secret = "s3cr3t-value-0123456789";
    const e = thrown(`${"x".repeat(72)} ${secret} tail`);
    expect(e.message.endsWith(" s3cr3t-v…")).toBe(true);
    const clean = scrubbedCause(e, { pii: new Set(), secrets: new Set([secret]) });
    expect(clean.data.cause).toBe(`Error: ${"x".repeat(72)} [secret] tail`);
    expect(clean.message).toBe(`Error: ${"x".repeat(72)} [secret]…`);
    expect(clean.message.length).toBe(89);
  });
});

describe("secret scrub over a request", () => {
  const TOKEN = "tok-7f3a9c";
  const input = s.object({
    email: s.string().pii("contact"),
    creds: s.object({ key: s.secret(s.string()), pins: s.array(s.secret(s.int())) }),
  });
  const sent = { email: "ada@example.test", creds: { key: TOKEN, pins: [48213, 7] } };
  type Sent = Infer<typeof input>;
  async function run(mode: "dev" | "production", fail: (v: Sent) => unknown, accept: string) {
    const lines: string[] = [];
    const c = contract("app", { "app.a": { path: "/a" } });
    const load = loader(c, "app.a", { output: s.object({}) }, async () => {
      await Promise.resolve();
      throw new Error(`loader saw ${TOKEN}`);
    });
    const save = action(c, "app.a", { input }, (v) => {
      throw fail(v);
    });
    const routes = manifest(c, {
      "app.a": { loader: load, component: () => document.createElement("main"), POST: save },
    });
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      mode,
      log: { format: "compact", write: (l) => lines.push(l) },
    });
    const res = await app.fetch(
      new Request("http://localhost/a", {
        method: "POST",
        body: JSON.stringify(sent),
        headers: { "content-type": "application/json", accept },
      }),
    );
    return {
      status: res.status,
      body: await res.text(),
      diags: textRecords(lines).filter((l) => l.startsWith("keel.unexpected ")),
    };
  }

  it("a pii value and a secret in one thrown message each take their mark, in the log and the dev response", async () => {
    const out = await run("dev", (v) => new Error(`mail ${v.email} key ${reveal(v.creds.key)}`), "application/json");
    expect(out.status).toBe(500);
    expect(out.diags).toEqual(["keel.unexpected action app.a threw: Error: mail [pii] key [secret]"]);
    expect(out.body).toContain("mail [pii] key [secret]");
    expect(out.body).not.toContain(TOKEN);
  });

  it("a thrown object holding the secret logs its JSON with the mark", async () => {
    const out = await run("dev", (v) => ({ token: reveal(v.creds.key) }), "application/json");
    expect(out.diags).toEqual(['keel.unexpected action app.a threw: {"token":"[secret]"}']);
    expect(out.body).not.toContain(TOKEN);
  });

  it("a number secret in an array is marked; a one-digit one only as a whole token", async () => {
    const out = await run(
      "dev",
      (v) => new Error(`pins ${v.creds.pins.map((p) => reveal(p)).join(" ")} of 17 tried`),
      "application/json",
    );
    expect(out.diags).toEqual(["keel.unexpected action app.a threw: Error: pins [secret] [secret] of 17 tried"]);
  });

  it("a loader's diag of the same request takes the same pass, as does the rendered page", async () => {
    const out = await run("dev", (v) => reveal(v.creds.key), "text/html");
    expect(out.diags).toEqual([
      "keel.unexpected action app.a threw: [secret]",
      "keel.unexpected loader app.a threw: Error: loader saw [secret]",
    ]);
    expect(out.body).not.toContain(TOKEN);
  });
});
