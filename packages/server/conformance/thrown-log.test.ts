// @vitest-environment happy-dom
// Spec: k.serverlog, clause "In production mode, a loader `p.def` throwing `new Error('user jane@x.com failed')`, the string `token=abc123`, the object `{ ssn: '078-05-1120' }` or `defect('user failed', { data: { email: 'jane@x.com' } })`, none of them a value the request declared, logs a `diag` whose message matches `^loader p\.def threw: (Error|value|Defect) #[0-9a-f]{8}( at \S+:\d+)?$`, and no logged line, compact or json, holds `jane`, `abc123` or `078`."
// Spec: k.serverlog, clause "Two requests that throw `new Error('a')` from one place log the same fingerprint, also from a second process with the same `KEEL_SECRET`; `new Error('b')` there, and `new Error('a')` under another `KEEL_SECRET`, log another."
// Spec: k.serverlog, clause "A loader throwing `defect('no row', { code: 'E2801', cause: e })`, `e` the error of `s.error('shop.gone', s.object({}))`, logs a message that starts `loader p.def threw: Defect E2801 #` and ends ` <- Result shop.gone`; with `e` the object `{ code: 'jane@x.com', message: 'm', data: null }` it ends ` <- Result [code]`."
// Spec: k.serverlog, clause "An `Error` whose `name` was set to `jane@x.com` logs the class `Error`; a `TypeError` logs `TypeError`."
// Spec: k.serverlog, clause "With `mode: 'dev'`, that first loader's `Error` logs that `diag` and then one whose message is `loader p.def threw: Error: user jane@x.com failed`; where `jane@x.com` is a `.pii()` value of the request's input the second is `loader p.def threw: Error: user [pii] failed`."
// Spec: k.serverlog, clause "With `KEEL_LOG_THROWN` an instant one hour after start, a throw logs two `diag` records before that instant and one after it; set to `yes`, empty, or to an instant 25 hours after start, `createApp` fails with E1596 and the record holds no part of the value."
// Seed 1337 (fixed throws; no random input).
// Assumption: "the same fingerprint from a second process" is a second `createApp` in this process with the same `KEEL_SECRET` (the key is read from the environment at start).
// Assumption: "an instant one hour after start" is read from the sim ctx clock the app is given; the process-start reading of a real server is the builder's to match.
// NOT REACHED: a late rejection (E1577) is a process-level record of server.mjs, asserted beside leave-process.test.ts, not here.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { defect, ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { describe, expect, it } from "vitest";
import { SEED, createApp, get } from "./fixtures.ts";
import { isoOfEpochMs } from "./iso-instant.ts";
import { createAppLoose, flush, pageManifest } from "./topology-fixtures.ts";

type Format = "compact" | "json";
const Nothing = s.object({});
const Input = s.object({ email: s.string().pii("contact") });
const Gone = s.error("shop.gone", s.object({}));
const FORMATS: readonly Format[] = ["compact", "json"];
/** The ISO instant `ms` after the injected sim clock's now: a format of the sim clock's reading, by arithmetic (iso-instant.ts). */
const isoAfter = (ctx: ReturnType<typeof createCtx>, ms: number): string => isoOfEpochMs(Number(ctx.clock.now()) + ms);
const PATTERN = /^loader p\.def threw: (Error|value|Defect) #[0-9a-f]{8}( at \S+:\d+)?$/;

const withEnv = async <T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> => {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

/** Boot an app whose loader `p.def` throws what `make` makes, request it once per element of `times`, and return every log line. */
async function throwFromLoader(
  mode: "dev" | "production",
  format: Format,
  make: () => unknown,
  times = 1,
  ctx = createCtx({ mode: "sim", seed: SEED }),
): Promise<string[]> {
  const lines: string[] = [];
  const c = contract("p", { "p.def": { method: "GET", path: "/api/def", output: Nothing } });
  const def = loader(c, "p.def", {}, async () => {
    throw make();
  });
  const routes = Reflect.apply(manifest, undefined, [c, { "p.def": { loader: def } }]);
  const app = await createApp({
    topology: topology({ web: { modules: ["p"], adapter: "node" } }),
    routes,
    ctx,
    mode,
    log: { format, write: (l: string) => void lines.push(l) },
  });
  for (let i = 0; i < times; i++) {
    const res = await app.fetch(get("/api/def", { accept: "application/json" }));
    await res.text();
  }
  return lines;
}
const diagMessages = (format: Format, lines: readonly string[]): string[] =>
  lines.flatMap((l) => {
    if (format === "compact") return /^[A-Z]+ \//.test(l) ? [] : [l.slice(l.indexOf(" ") + 1)];
    const v: unknown = JSON.parse(l);
    return typeof v === "object" && v !== null && Reflect.get(v, "kind") === "diag"
      ? [String(Reflect.get(v, "message"))]
      : [];
  });

const THROWS: readonly (readonly [string, () => unknown, string[]])[] = [
  ["new Error('user jane@x.com failed')", () => new Error("user jane@x.com failed"), ["jane", "abc123", "078"]],
  ["the string `token=abc123`", () => "token=abc123", ["abc123"]],
  ["the object `{ ssn: '078-05-1120' }`", () => ({ ssn: "078-05-1120" }), ["078", "1120"]],
  [
    "defect('user failed', { data: { email: 'jane@x.com' } })",
    () => defect("user failed", { data: { email: "jane@x.com" } }),
    ["jane", "user failed"],
  ],
];

describe("k.serverlog: production logs hold no thrown text", () => {
  for (const format of FORMATS) {
    for (const [name, make, secrets] of THROWS) {
      it(`loader p.def throwing ${name} logs a diag matching the stated form and no line holds the text (${format})`, async () => {
        const lines = await throwFromLoader("production", format, make);
        const msgs = diagMessages(format, lines).filter((m) => m.startsWith("loader p.def threw"));
        expect(msgs).toHaveLength(1);
        expect(msgs[0]).toMatch(PATTERN);
        for (const secret of secrets) for (const l of lines) expect(l).not.toContain(secret);
      });
    }
  }

  it("the same throw from an action logs `action <id> threw: <class> #<fingerprint>` and no text", async () => {
    const lines: string[] = [];
    const c = contract("p", { "p.act": { method: "POST", path: "/api/act", body: Input, output: Nothing } });
    const act = action(c, "p.act", {}, async () => {
      throw new Error("user jane@x.com failed");
    });
    const routes = Reflect.apply(manifest, undefined, [c, { "p.act": { action: act } }]);
    const app = await createApp({
      topology: topology({ web: { modules: ["p"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
      log: { format: "json", write: (l: string) => void lines.push(l) },
    });
    const res = await app.fetch(
      new Request("http://localhost/api/act", {
        method: "POST",
        body: JSON.stringify({ email: "jane@x.com" }),
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
      }),
    );
    await res.text();
    const msgs = diagMessages("json", lines).filter((m) => m.startsWith("action p.act threw"));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/^action p\.act threw: Error #[0-9a-f]{8}( at \S+:\d+)?$/);
    for (const l of lines) expect(l).not.toContain("jane");
  });

  it("a runner (job) rejecting with an Error holding an email logs `runner`'s diag with the class and a fingerprint and no text", async () => {
    const lines: string[] = [];
    let first = true;
    const run = (_ctx: unknown, signal: AbortSignal): Promise<void> => {
      if (first) {
        first = false;
        return Promise.reject(new Error("user jane@x.com failed"));
      }
      return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
    };
    const app = await createAppLoose({
      topology: topology({ x: { modules: ["a"], adapter: "node" } }),
      routes: pageManifest("a", "/a", "A"),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
      log: { format: "json", write: (l: string) => void lines.push(l) },
      runners: { a: [{ run }] },
    });
    await flush();
    await app.close?.();
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).not.toContain("jane");
    expect(lines.some((l) => /#[0-9a-f]{8}/.test(l))).toBe(true);
  });

  it("two requests that throw new Error('a') from one place log the same fingerprint; new Error('b') there logs another", async () => {
    const fp = (m: string[]): string[] => m.map((x) => /#([0-9a-f]{8})/.exec(x)?.[1] ?? "");
    const two = await withEnv({ KEEL_SECRET: "k".repeat(32) }, async () =>
      fp(diagMessages("json", await throwFromLoader("production", "json", () => new Error("a"), 2))),
    );
    expect(two).toHaveLength(2);
    expect(two[0]).toBe(two[1]);
    const other = await withEnv({ KEEL_SECRET: "k".repeat(32) }, async () =>
      fp(diagMessages("json", await throwFromLoader("production", "json", () => new Error("b"), 1))),
    );
    expect(other[0]).not.toBe(two[0]);
  });

  it("a second process with the same KEEL_SECRET logs the same fingerprint; another KEEL_SECRET logs another", async () => {
    const fpOf = async (secret: string): Promise<string | undefined> =>
      withEnv({ KEEL_SECRET: secret }, async () => {
        const lines = await throwFromLoader("production", "json", () => new Error("a"));
        return /#([0-9a-f]{8})/.exec(diagMessages("json", lines).join("\n"))?.[1];
      });
    const a1 = await fpOf("k".repeat(32));
    const a2 = await fpOf("k".repeat(32));
    const b = await fpOf("j".repeat(32));
    expect(a1).toBeDefined();
    expect(a1).toBe(a2);
    expect(b).not.toBe(a1);
  });

  it("defect('no row', { code: 'E2801', cause: e }) with e a declared KeelError logs `Defect E2801 #...` ending ` <- Result shop.gone`", async () => {
    const lines = await throwFromLoader("production", "json", () =>
      defect("no row", { code: "E2801", cause: Gone.make({}) }),
    );
    const m = diagMessages("json", lines).find((x) => x.startsWith("loader p.def threw")) ?? "";
    expect(m.startsWith("loader p.def threw: Defect E2801 #")).toBe(true);
    expect(m.endsWith(" <- Result shop.gone")).toBe(true);
  });

  it("with e the object { code: 'jane@x.com', message: 'm', data: null } the cause is ` <- Result [code]` and the text is nowhere", async () => {
    const lines = await throwFromLoader("production", "json", () =>
      defect("no row", { code: "E2801", cause: { code: "jane@x.com", message: "m", data: null } }),
    );
    const m = diagMessages("json", lines).find((x) => x.startsWith("loader p.def threw")) ?? "";
    expect(m.endsWith(" <- Result [code]")).toBe(true);
    for (const l of lines) expect(l).not.toContain("jane");
  });

  it("an Error whose name was set to jane@x.com logs the class Error; a TypeError logs TypeError", async () => {
    const named = Object.assign(new Error("x"), { name: "jane@x.com" });
    const l1 = await throwFromLoader("production", "json", () => named);
    expect(diagMessages("json", l1).find((x) => x.startsWith("loader p.def threw"))).toMatch(
      /^loader p\.def threw: Error #/,
    );
    for (const l of l1) expect(l).not.toContain("jane");
    const l2 = await throwFromLoader("production", "json", () => new TypeError("x"));
    expect(diagMessages("json", l2).find((x) => x.startsWith("loader p.def threw"))).toMatch(
      /^loader p\.def threw: TypeError #/,
    );
  });
});

describe("k.serverlog: dev mode and KEEL_LOG_THROWN print the text", () => {
  it("with mode: 'dev' the first diag is the same and a second is `loader p.def threw: Error: user jane@x.com failed`", async () => {
    const lines = await throwFromLoader("dev", "json", () => new Error("user jane@x.com failed"));
    const msgs = diagMessages("json", lines).filter((m) => m.startsWith("loader p.def threw"));
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatch(PATTERN);
    expect(msgs[1]).toBe("loader p.def threw: Error: user jane@x.com failed");
  });

  it("where jane@x.com is a .pii() value of the request's input the second is `loader p.def threw: Error: user [pii] failed`", async () => {
    const lines: string[] = [];
    const c = contract("p", { "p.def": { method: "POST", path: "/api/def", body: Input, output: Nothing } });
    const act = action(c, "p.def", {}, async ({ email }) => {
      if (email.length > 0) throw new Error(`user ${email} failed`);
      return ok({});
    });
    const routes = Reflect.apply(manifest, undefined, [c, { "p.def": { action: act } }]);
    const app = await createApp({
      topology: topology({ web: { modules: ["p"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "dev",
      log: { format: "json", write: (l: string) => void lines.push(l) },
    });
    const res = await app.fetch(
      new Request("http://localhost/api/def", {
        method: "POST",
        body: JSON.stringify({ email: "jane@x.com" }),
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
      }),
    );
    await res.text();
    const msgs = diagMessages("json", lines).filter((m) => m.includes("threw"));
    expect(msgs[1]).toBe("action p.def threw: Error: user [pii] failed");
  });

  it("with KEEL_LOG_THROWN an instant one hour after start, a throw logs two diag records before that instant and one after it", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const instant = isoAfter(ctx, 3_600_000);
    await withEnv({ KEEL_LOG_THROWN: instant }, async () => {
      const before = await throwFromLoader("production", "json", () => new Error("user jane@x.com failed"), 1, ctx);
      expect(diagMessages("json", before).filter((m) => m.startsWith("loader p.def threw"))).toHaveLength(2);
      ctx.clock.advance(3_600_001);
      const afterLines = await throwFromLoader("production", "json", () => new Error("user jane@x.com failed"), 1, ctx);
      expect(diagMessages("json", afterLines).filter((m) => m.startsWith("loader p.def threw"))).toHaveLength(1);
    });
  });

  it("KEEL_LOG_THROWN set to `yes` fails createApp with E1596 and the record holds no part of the value", async () => {
    const lines: string[] = [];
    const got: unknown = await withEnv({ KEEL_LOG_THROWN: "yes" }, () =>
      throwFromLoader("production", "json", () => new Error("x")).then(
        () => undefined,
        (e: unknown) => e,
      ),
    );
    expect(String(got instanceof Error ? got.message : got)).toMatch(/^E1596/);
    expect(String(got instanceof Error ? got.message : got)).not.toContain("yes");
    expect(lines).toEqual([]);
  });

  it("KEEL_LOG_THROWN set empty fails createApp with E1596", async () => {
    const got: unknown = await withEnv({ KEEL_LOG_THROWN: "" }, () =>
      throwFromLoader("production", "json", () => new Error("x")).then(
        () => undefined,
        (e: unknown) => e,
      ),
    );
    expect(String(got instanceof Error ? got.message : got)).toMatch(/^E1596/);
  });

  it("KEEL_LOG_THROWN an instant 25 hours after start fails createApp with E1596", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const instant = isoAfter(ctx, 25 * 3_600_000);
    const got: unknown = await withEnv({ KEEL_LOG_THROWN: instant }, () =>
      throwFromLoader("production", "json", () => new Error("x"), 1, ctx).then(
        () => undefined,
        (e: unknown) => e,
      ),
    );
    const text = String(got instanceof Error ? got.message : got);
    expect(text).toMatch(/^E1596/);
    expect(text).not.toContain(instant);
  });

  it("KEEL_LOG_THROWN an instant exactly 24 hours after start is taken, and one millisecond more is E1596", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const taken = await withEnv({ KEEL_LOG_THROWN: isoAfter(ctx, 24 * 3_600_000) }, () =>
      throwFromLoader("production", "json", () => new Error("x"), 1, ctx).then(
        () => "served",
        (e: unknown) => String(e instanceof Error ? e.message : e),
      ),
    );
    expect(taken).toBe("served");
    const over = await withEnv({ KEEL_LOG_THROWN: isoAfter(ctx, 24 * 3_600_000 + 1) }, () =>
      throwFromLoader("production", "json", () => new Error("x"), 1, ctx).then(
        () => "served",
        (e: unknown) => String(e instanceof Error ? e.message : e),
      ),
    );
    expect(over).toMatch(/^E1596/);
  });

  it("the instant format of the sim clock's reading round-trips known days", () => {
    expect(isoOfEpochMs(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(isoOfEpochMs(951_782_400_000 + 86_399_999)).toBe("2000-02-29T23:59:59.999Z");
    expect(isoOfEpochMs(1_700_000_000_000)).toBe("2023-11-14T22:13:20.000Z");
  });
});
