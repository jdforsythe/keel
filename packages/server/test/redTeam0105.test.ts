// @vitest-environment node
// Red team of the log scrub (k.privacy Server log): an ill-formed secret or pii value never makes the scrub throw, so
// the request's diag is still written; a secret holding an object or an array marks each string and number in it;
// overlapping secrets and pii values leave no part of a secret; the matchers are kept for a request's set while it has
// not grown; and each `createApp` puts the server's listener back in the `onSecret` slot. Seed 1337.
import { createCtx } from "@keel/ctx";
import { type Manifest, type RouteDef, action, loader, manifest } from "@keel/router";
import { type ObjectSchema, ok, reveal, s } from "@keel/schema";
import { onSecret } from "@keel/schema/internal";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { matcherOf } from "../src/internal/matcherOf.ts";
import { redacted } from "../src/internal/redacted.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";

const SEED = 1337;
const ROOT = "/keel-probe-root";
const Nothing = s.object({});
const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);
const text = (v: unknown, k: string): string => {
  const f = field(v, k);
  return typeof f === "string" ? f : "";
};

async function boot(routes: Manifest<Readonly<Record<string, RouteDef>>>, mode: "dev" | "production", module = "app") {
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: [module], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    artifacts: `${ROOT}/.keel`,
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  const diags = (): unknown[] => lines.map((l): unknown => JSON.parse(l)).filter((d) => field(d, "kind") === "diag");
  return { app, lines, diags };
}

const post = (body: string): Request =>
  new Request("http://localhost/a", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", accept: "application/json" },
  });

/** An app whose `POST /a` decodes `input` and runs `run` with it. */
async function actionApp<I>(
  input: ObjectSchema<I>,
  run: (v: I) => Promise<never>,
  mode: "dev" | "production" = "production",
) {
  const routes = manifest({ "app.a": { path: "/a", component: () => document.createElement("main") } });
  routes.actions({ "app.a": { POST: action({ input }, (v) => run(v)) } });
  return boot(routes, mode);
}

afterEach(() => {
  vi.restoreAllMocks();
});

const chars = fc.oneof(
  fc.constantFrom(
    "\ud800",
    "\udbff",
    "\udc00",
    "\udfff",
    "\ud83d",
    "\ude00",
    '"',
    "'",
    "\\",
    "\n",
    "\t",
    "\u0000",
    "\u001f",
    "\u007f",
    "[",
    "]",
    "(",
    ")",
    ".",
    "*",
    "+",
    "?",
    "^",
    "$",
    "{",
    "}",
    "|",
    "/",
    "%",
    "-",
  ),
  fc.integer({ min: 0, max: 0xffff }).map((c) => String.fromCharCode(c)),
  fc.constantFrom("a", "B", "z", "0", "9", "😀", "é", "ß", "σ"),
);
const textOf = (min: number, max: number) => fc.array(chars, { minLength: min, maxLength: max }).map((a) => a.join(""));
const longOr = (t: fc.Arbitrary<string>) =>
  fc.oneof(
    { weight: 4, arbitrary: t },
    { weight: 1, arbitrary: fc.tuple(t, fc.integer({ min: 100, max: 1_500 })).map(([v, n]) => v.repeat(n)) },
  );

describe("finding 1: no secret or pii value makes the scrub throw", () => {
  it("an ill-formed value is still marked as written and in its JSON form, and gives no URL form", () => {
    const v = "ab\ud800cd";
    const one = (m: string) => scrubbed(m, [[new Set([v]), "[secret]"]]);
    expect(one(`k ${v} end`)).toBe("k [secret] end");
    expect(one(`k ${JSON.stringify(v)} end`)).toBe('k "[secret]" end');
    expect(scrubbed(`k ${v}`, [[new Set([v]), "[pii]"]])).toBe("k [pii]");
    expect(scrubbed("x \udc00\udc00\udc00 y", [[new Set(["\udc00\udc00\udc00"]), "[secret]"]])).toBe("x [secret] y");
  });

  it("a value that ends in a lone high surrogate is marked where the text pairs it with a low one", () => {
    const v = "ab\ud83d";
    const out = scrubbed(`k ${v}\ude00 end`, [[new Set([v]), "[secret]"]]);
    expect(out.split("[secret]").some((p) => p.includes(v))).toBe(false);
    const w = "\ude00cd";
    const back = scrubbed(`k \ud83d${w} end`, [[new Set([w]), "[secret]"]]);
    expect(back.split("[secret]").some((p) => p.includes(w))).toBe(false);
  });

  it("a value longer than one expression holds is marked, and many values do not overflow an expression", () => {
    const long = "k3y-".repeat(20_000);
    expect(scrubbed(`x ${long} y ${long.toUpperCase()}`, [[new Set([long]), "[secret]"]])).toBe(
      "x [secret] y [secret]",
    );
    const many = new Set(Array.from({ length: 20_000 }, (_, i) => `bulk-key-${i}-0f0f0f0f0f0f0f0f`));
    const one = "bulk-key-19999-0f0f0f0f0f0f0f0f";
    expect(scrubbed(`a ${one} b`, [[many, "[secret]"]])).toBe("a [secret] b");
  });

  for (const mode of ["dev", "production"] as const) {
    it(`an action whose secret input holds a lone surrogate logs one scrubbed diag, nothing to the console (${mode})`, async () => {
      const printed: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void printed.push(a.map(String).join(" ")));
      const input = s.object({ k: s.secret(s.string()) });
      const t = await actionApp(
        input,
        async (v) => {
          await Promise.resolve();
          throw new Error(`boom db down ${reveal(v.k)}`);
        },
        mode,
      );
      const res = await t.app.fetch(post('{"k":"ab\\ud800cd"}'));
      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).not.toContain("URIError");
      expect(body).not.toContain("ab\ud800cd");
      const diags = t.diags();
      expect(diags).toHaveLength(1);
      expect(text(diags[0], "message")).toContain("boom db down [secret]");
      expect(text(diags[0], "message")).not.toContain("ab\ud800cd");
      expect(printed).toEqual([]);
    });
  }

  it("an action whose pii input holds a lone surrogate logs one scrubbed diag", async () => {
    const input = s.object({ name: s.string().pii("name") });
    const t = await actionApp(input, async (v) => {
      throw new Error(`hi ${v.name}`);
    });
    const res = await t.app.fetch(post('{"name":"ab\\ud800cd"}'));
    expect(res.status).toBe(500);
    const diags = t.diags();
    expect(diags).toHaveLength(1);
    expect(text(diags[0], "message")).toContain("hi [pii]");
  });

  it("a live loader parsing a secret with a lone surrogate writes its diag and err line, nothing to the console", async () => {
    const printed: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void printed.push(a.map(String).join(" ")));
    const K = s.secret(s.string());
    const live = loader({ output: Nothing }, async function* () {
      yield ok({});
      const k = K.parse("x\ud800yz");
      if (k.ok) throw new Error(`sur ${reveal(k.value)}`);
    });
    const t = await boot(manifest({ "api.live": { api: true, path: "/api/live", loader: live } }), "dev", "api");
    const res = await t.app.fetch(
      new Request("http://localhost/api/live", { headers: { accept: "text/event-stream" } }),
    );
    const data = (await res.text()).split("\n").filter((l) => l.startsWith("data: "));
    expect(data).toHaveLength(2);
    expect(data[1]).toContain("keel.unexpected");
    expect(data[1]).not.toContain("x\ud800yz");
    const diags = t.diags();
    expect(diags).toHaveLength(1);
    expect(text(diags[0], "message")).toContain("sur [secret]");
    expect(printed).toEqual([]);
  });

  it("property: the scrub never throws and leaves no copy of a secret or pii value, whatever their text", () => {
    fc.assert(
      fc.property(
        longOr(textOf(3, 12)),
        longOr(textOf(3, 12)),
        textOf(0, 20),
        textOf(0, 20),
        textOf(0, 20),
        (secret, pii, before, between, after) => {
          const message = `${before}${secret}${between}${pii}${between}${secret}${after}`;
          const out = redacted(message, { secrets: new Set([secret]), pii: new Set([pii]) });
          for (const piece of out.split(/\[secret\]|\[pii\]/)) {
            expect(piece.includes(secret)).toBe(false);
            expect(piece.includes(pii)).toBe(false);
          }
          const plain = scrubbed(message, [[new Set([secret]), "[secret]"]]);
          for (const piece of plain.split("[secret]")) expect(piece.includes(secret)).toBe(false);
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });
});

describe("finding 2: a secret holding an object or an array marks each string and number in it", () => {
  it("an action's object and array secrets are marked in its diag", async () => {
    const Cfg = s.secret(s.object({ id: s.string(), key: s.string(), n: s.number() }));
    const Keys = s.secret(s.array(s.string()));
    const t = await actionApp(Nothing, async () => {
      await Promise.resolve();
      const c = Cfg.parse({ id: "client-1", key: "objkey-55aa77cc", n: 918273 });
      const k = Keys.parse(["arrkey-0f0f0f0f"]);
      if (!c.ok || !k.ok) throw new Error("fixture");
      const cv = reveal(c.value);
      throw new Error(`refused ${cv.key} ${cv.n} ${reveal(k.value)[0]}`);
    });
    await t.app.fetch(post("{}"));
    const diags = t.diags();
    expect(diags).toHaveLength(1);
    expect(text(diags[0], "message")).toContain("refused [secret] [secret] [secret]");
    for (const l of t.lines)
      for (const v of ["objkey-55aa77cc", "918273", "arrkey-0f0f0f0f"]) expect(l).not.toContain(v);
  });
});

describe("finding 4: overlapping values leave no part of a secret", () => {
  const rq = (secrets: string[], pii: string[] = []) => ({ secrets: new Set(secrets), pii: new Set(pii) });
  it("a secret that holds a pii value is marked whole", () => {
    expect(redacted("k abcd-XYZW-9876", rq(["abcd-XYZW-9876"], ["XYZW"]))).toBe("k [secret]");
  });

  it("a pii value that holds a secret is marked whole, as the longer one", () => {
    const out = redacted("to john-SECRETX-doe now", rq(["SECRETX"], ["john-SECRETX-doe"]));
    expect(out).toBe("to [pii] now");
  });

  it("of two secrets where one is a prefix, a suffix or an infix of the other, the longer is marked whole", () => {
    expect(redacted("x aaaa-bbbb y", rq(["aaaa", "aaaa-bbbb"]))).toBe("x [secret] y");
    expect(redacted("x aaaa-bbbb y", rq(["bbbb", "aaaa-bbbb"]))).toBe("x [secret] y");
    expect(redacted("x aaaa-bbbb y", rq(["a-bb", "aaaa-bbbb"]))).toBe("x [secret] y");
  });

  it("two secrets that overlap without one holding the other are marked as one run", () => {
    expect(redacted("joined aaaa-bbbb-cccc", rq(["aaaa-bbbb", "bbbb-cccc"]))).toBe("joined [secret]");
  });

  it("through an app, a pii input inside a secret input leaves none of the secret", async () => {
    const input = s.object({ k: s.secret(s.string()), name: s.string().pii("name") });
    const t = await actionApp(input, async (v) => {
      throw new Error(`k ${reveal(v.k)}`);
    });
    await t.app.fetch(post('{"k":"abcd-XYZW-9876","name":"XYZW"}'));
    const diags = t.diags();
    expect(diags).toHaveLength(1);
    expect(text(diags[0], "message")).toContain("k [secret]");
    for (const l of t.lines) for (const part of ["abcd", "9876"]) expect(l).not.toContain(part);
  });
});

describe("finding 5: the matchers are kept for a set while it has not grown", () => {
  it("gives the same matchers for the same values and builds new ones when the set grows", () => {
    const set = new Set(["tok-1111", "tok-2222"]);
    const first = matcherOf(set);
    expect(matcherOf(set)).toBe(first);
    set.add("tok-3333");
    const grown = matcherOf(set);
    expect(grown).not.toBe(first);
    expect(scrubbed("a tok-3333 b", [[set, "[secret]"]])).toBe("a [secret] b");
    set.delete("tok-1111");
    set.add("tok-4444");
    expect(scrubbed("a tok-4444 b", [[set, "[secret]"]])).toBe("a [secret] b");
  });
});

describe("finding 7: each createApp puts the server's listener back", () => {
  it("a stray onSecret and its off before a later createApp leave that app's scrub on", async () => {
    await actionApp(Nothing, async () => {
      throw new Error("unused");
    });
    const off = onSecret(() => undefined);
    off();
    const input = s.object({ k: s.secret(s.string()) });
    const t = await actionApp(input, async (v) => {
      throw new Error(`k ${reveal(v.k)}`);
    });
    await t.app.fetch(post('{"k":"slot-secret-456"}'));
    const diags = t.diags();
    expect(diags).toHaveLength(1);
    expect(text(diags[0], "message")).toContain("k [secret]");
    for (const l of t.lines) expect(l).not.toContain("slot-secret-456");
  });
});
