// @vitest-environment node
// Red team of the log scrub (k.privacy Server log): an ill-formed secret or pii value never makes the scrub throw, so
// the request's diag is still written; a secret holding an object or an array marks each string and number in it;
// overlapping secrets and pii values leave no part of a secret; the automaton is kept for a request's set while it has
// not grown; a long value is marked whole; and each `createApp` puts the server's listener back in the `onSecret` slot. Seed 1337.
import { createCtx } from "@keel/ctx";
import { type RouteTable, action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type ObjectSchema, ok, reveal, s } from "@keel/schema";
import { onSecret } from "@keel/schema/internal";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, topology } from "../src/index.ts";
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

async function boot(routes: RouteTable, mode: "dev" | "production", module = "app") {
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
  const c = contract("app", { "app.a": { path: "/a" } });
  const save = action(c, "app.a", { input }, (v) => run(v));
  const routes = manifest(c, { "app.a": { component: () => document.createElement("main"), POST: save } });
  return boot(routes, mode);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("no secret or pii value makes the scrub throw", () => {
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
    const c = contract("api", { "api.live": { method: "GET", path: "/api/live", output: Nothing, events: true } });
    const live = loader(c, "api.live", {}, async function* () {
      yield ok({});
      const k = K.parse("x\ud800yz");
      if (k.ok) throw new Error(`sur ${reveal(k.value)}`);
    });
    const t = await boot(manifest(c, { "api.live": { loader: live } }), "dev", "api");
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
});

describe("a secret holding an object or an array marks each string and number in it", () => {
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

describe("overlapping values leave no part of a secret", () => {
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

describe("the automaton is kept for a set while it has not grown", () => {
  it("builds once for the same set and again when it grows", () => {
    const set = new Set(["tok-1111", "tok-2222"]);
    const count = { build: 0, walk: 0, forms: 0 };
    scrubbed("a b", [[set, "[secret]"]], count);
    const first = count.build;
    expect(first).toBeGreaterThan(0);
    scrubbed("a tok-1111 b", [[set, "[secret]"]], count);
    expect(count.build).toBe(first);
    set.add("tok-3333");
    expect(scrubbed("a tok-3333 b", [[set, "[secret]"]], count)).toBe("a [secret] b");
    expect(count.build).toBeGreaterThan(first);
    set.add("tok-4444");
    expect(scrubbed("a tok-4444 b", [[set, "[secret]"]])).toBe("a [secret] b");
  });
});

describe("each createApp puts the server's listener back", () => {
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

describe("a long value is marked whole", () => {
  it("a long secret is still marked whole, twice and in another case, with a short secret as its prefix", () => {
    const long = `${"x".repeat(997)}ABCDEFG${"y".repeat(1_500)}`;
    const out = scrubbed(`a ${long} b ${long.toLowerCase()} c`, [[new Set([long, "xxxx"]), "[secret]"]]);
    expect(out).toBe("a [secret] b [secret] c");
    const near = scrubbed(`a ${long.slice(0, 1_250)}Q${long.slice(1_251)} b`, [[new Set([long]), "[secret]"]]);
    expect(near).toBe(`a ${long.slice(0, 1_250)}Q${long.slice(1_251)} b`);
  });
});

describe("base64 copies with or without padding, in both alphabets", () => {
  const one = (m: string, v: string) => scrubbed(m, [[new Set([v]), "[secret]"]]);
  it("marks an unpadded, a padded and a base64url copy of a secret encoded on its own", () => {
    expect(one("m aHVudGVyMjI", "hunter22")).toBe("m [secret]");
    expect(one("m aHVudGVyMjI=", "hunter22")).toBe("m [secret]");
    expect(one("m aHVudGVyMg==", "hunter2")).toBe("m [secret]");
    expect(one(`m ${btoa("??>?hunter").replace(/=+$/, "").replace(/\+/g, "-")}`, "??>?hunter")).toBe("m [secret]");
    expect(one(`m ${btoa("??>?hunter")}`, "??>?hunter")).toBe("m [secret]");
  });
});

describe("an unpadded base64 form only for a value of at least 8 bytes", () => {
  const one = (m: string, v: string) => scrubbed(m, [[new Set([v]), "[secret]"]]);
  it("a 2-character secret leaves ordinary words alone and is marked as a token and as padded base64", () => {
    expect(one("node code mode", "81")).toBe("node code mode");
    expect(one("node_modules", "81")).toBe("node_modules");
    expect(one("pin 81 sent", "81")).toBe("pin [secret] sent");
    expect(one(`b64 ${btoa("81")} end`, "81")).toBe("b64 [secret] end");
  });

  it("a 7-byte secret gets no unpadded form and an 8-byte one does", () => {
    expect(one(`m ${btoa("seven77").replace(/=+$/, "")} end`, "seven77")).toBe(
      `m ${btoa("seven77").replace(/=+$/, "")} end`,
    );
    expect(one(`m ${btoa("eight888").replace(/=+$/, "")} end`, "eight888")).toBe("m [secret] end");
  });

  it("property: for a 1 to 7 byte secret, only its raw form and padded base64 change the text", () => {
    const word = fc.stringMatching(/^[a-z]{1,9}$/);
    fc.assert(
      fc.property(
        fc.stringMatching(/^[ -~]{1,7}$/),
        fc.array(word, { minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: 2 }),
        (secret, words, put) => {
          const shown = [secret, btoa(secret), ""][put] ?? "";
          const message = `${words.join(" ")} ${shown}`;
          const out = scrubbed(message, [[new Set([secret]), "[secret]"]]);
          const forms = [secret, JSON.stringify(secret).slice(1, -1), btoa(secret), encodeURIComponent(secret)];
          const low = message.toLowerCase();
          // Its raw, JSON and URL forms are what it had before base64 lost its padding; none standing means no change.
          if (!forms.some((f) => low.includes(f.toLowerCase()))) expect(out).toBe(message);
          else expect(out.split("[secret]").some((p) => p.includes(secret) && secret.length >= 3)).toBe(false);
        },
      ),
      { seed: 1337, numRuns: 300 },
    );
  });
});
