// @vitest-environment happy-dom
// k.privacy Server log, k.errors: a thrown value built from hostile parts (a `name`, `message`, `stack` or `cause`
// getter that throws, a `toString` or `toJSON` that throws, a Proxy that throws on every trap, a revoked Proxy, a
// `null`-prototype object, a symbol) never makes the server's handling throw, never ends a runner, and no log line,
// stderr or stdout write, response body or stream line holds the request's revealed secret. Seed 1337.
import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, reveal, s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { appFrames } from "../src/internal/appFrames.ts";
import { caught } from "../src/internal/caught.ts";
import { keepRunning } from "../src/internal/keepRunning.ts";

const SEED = 1337;
const Secretly = s.secret(s.string());
const view = (): Node => document.createElement("main");

/** A fresh secret made in the running scope, revealed. */
const made = (t: string): string => {
  const m = Secretly.parse(t);
  return m.ok ? reveal(m.value) : "";
};

const thrower = (): never => {
  throw new Error("read refused");
};

/** Hostile thrown values, each holding `t` where a careless reader would print it. */
const KINDS = {
  messageThrowsSelf: (t: string): unknown => {
    const e = new Error();
    Object.assign(e, { token: t });
    Object.defineProperty(e, "message", {
      get: () => {
        throw e;
      },
    });
    return e;
  },
  nameThrows: (t: string): unknown => {
    const e = new Error(`m ${t}`);
    Object.defineProperty(e, "name", { get: thrower });
    return e;
  },
  stackThrows: (t: string): unknown => {
    const e = new Error(`m ${t}`);
    Object.defineProperty(e, "stack", { get: thrower });
    return e;
  },
  causeThrows: (t: string): unknown => {
    const e = new Error(`m ${t}`);
    Object.defineProperty(e, "cause", { get: thrower });
    return e;
  },
  toStringThrows: (t: string): unknown => ({
    token: t,
    toJSON: thrower,
    toString: thrower,
  }),
  proxy: (t: string): unknown =>
    new Proxy(
      { token: t },
      {
        get: thrower,
        has: thrower,
        ownKeys: thrower,
        getPrototypeOf: thrower,
        getOwnPropertyDescriptor: thrower,
        apply: thrower,
      },
    ),
  revoked: (t: string): unknown => {
    const p = Proxy.revocable({ token: t }, {});
    p.revoke();
    return p.proxy;
  },
  nullProto: (t: string): unknown => Object.assign(Object.create(null), { token: t }),
  symbol: (t: string): unknown => Symbol(t),
  errorInError: (t: string): unknown => {
    const inner = new Error(`inner ${t}`);
    const e = new Error("outer", { cause: inner });
    Object.defineProperty(e, "message", {
      get: () => {
        throw inner;
      },
    });
    return e;
  },
} as const satisfies Record<string, (t: string) => unknown>;
type Make = (t: string) => unknown;
const kinds = fc.constantFrom(...Object.values(KINDS));
const Out = s.object({});
const apiC = contract("api", {
  "api.l": { method: "GET", path: "/api/l", output: Out },
  "api.v": { method: "GET", path: "/api/v", output: Out, events: true },
  "api.g": { method: "GET", path: "/api/g", output: Out },
});
const appC = contract("app", { "app.a": { path: "/a" }, "app.c": { path: "/c" } });
const oneC = contract("app", { "app.a": { path: "/a" } });
const SITES = ["loader", "action", "guard", "live", "component"] as const;

let written: string[] = [];
beforeEach(() => {
  written = [];
  const keep = (chunk: unknown): boolean => {
    written.push(String(chunk));
    return true;
  };
  vi.spyOn(process.stderr, "write").mockImplementation(keep);
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void written.push(a.map(String).join(" ")));
  vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void written.push(a.map(String).join(" ")));
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void written.push(a.map(String).join(" ")));
});
afterEach(() => vi.restoreAllMocks());

async function serve(site: (typeof SITES)[number], kind: Make, t: string, mode: "dev" | "production") {
  const lines: string[] = [];
  const raise = (): never => {
    throw kind(made(t));
  };
  const apiRoutes = manifest(apiC, {
    "api.l": { loader: loader(apiC, "api.l", {}, async () => raise()) },
    "api.v": {
      loader: loader(apiC, "api.v", {}, async function* () {
        yield ok({});
        raise();
      }),
    },
    "api.g": {
      guard: guard({}, async () => raise()),
      loader: loader(apiC, "api.g", {}, async () => ok({})),
    },
  });
  const appRoutes = manifest(appC, {
    "app.a": { component: view, POST: action(appC, "app.a", { input: s.object({}) }, async () => raise()) },
    "app.c": { component: () => raise() },
  });
  const routes = routeTable(apiRoutes, appRoutes);
  const app = await createApp({
    topology: topology({ web: { modules: ["api", "app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  const req = {
    loader: new Request("http://localhost/api/l"),
    guard: new Request("http://localhost/api/g"),
    live: new Request("http://localhost/api/v", { headers: { accept: "text/event-stream" } }),
    component: new Request("http://localhost/c"),
    action: new Request("http://localhost/a", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", origin: "http://localhost" },
      body: "{}",
    }),
  }[site];
  const res = await app.fetch(req);
  const body = await res.text();
  await app.close();
  return { status: res.status, all: [...lines, ...written].join("\n"), body, lines };
}

describe("hostile thrown values", () => {
  it("never make a request's handling throw, and no line, body or stderr holds the secret", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...SITES),
        kinds,
        fc.stringMatching(/^tok-[a-f0-9]{12}$/),
        fc.constantFrom("dev" as const, "production" as const),
        async (site, kind, t, mode) => {
          const { status, all, body, lines } = await serve(site, kind, t, mode);
          expect(status).toBeGreaterThanOrEqual(site === "live" ? 200 : 500);
          expect(all).not.toContain(t);
          expect(body).not.toContain(t);
          if (site !== "component") expect(lines.join("\n")).toContain('"keel.unexpected"');
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  it("answer a bare 500 and print nothing when the app's own log writer throws them", async () => {
    for (const [kind, make] of Object.entries(KINDS)) {
      let serving = false;
      const app = await createApp({
        topology: topology({ web: { modules: ["app"], adapter: "node" } }),
        routes: manifest(oneC, { "app.a": { component: view } }),
        ctx: createCtx({ mode: "sim", seed: SEED }),
        mode: "dev",
        log: {
          format: "compact",
          write: () => {
            if (serving) throw make("tok-0a1b2c3d4e5f");
          },
        },
      });
      serving = true;
      const res = await app.fetch(new Request("http://localhost/a"));
      const body = await res.text();
      await app.close();
      expect(res.status, kind).toBe(500);
      expect(body, kind).not.toContain("tok-0a1b2c3d4e5f");
      expect(written.join("\n"), kind).not.toContain("tok-0a1b2c3d4e5f");
    }
  });

  it("never end a runner: it reports each rejection and runs again", async () => {
    for (const [kind, make] of Object.entries(KINDS)) {
      const ctx = createCtx({ mode: "sim", seed: SEED });
      const stop = new AbortController();
      const seen: string[] = [];
      let runs = 0;
      const done = keepRunning(
        {
          run: async () => {
            runs++;
            await Promise.resolve();
            throw make(made(`rtok-${runs}-5d3c1f`));
          },
        },
        ctx,
        stop.signal,
        (message) => void seen.push(message),
        appFrames(process.cwd(), () => undefined),
      );
      for (let i = 0; i < 3; i++) {
        await new Promise<void>((r) => setTimeout(r, 0));
        ctx.clock.advance(1000);
      }
      await new Promise<void>((r) => setTimeout(r, 0));
      stop.abort();
      await expect(done).resolves.toBeUndefined();
      expect(runs, kind).toBeGreaterThanOrEqual(2);
      expect(seen.length, kind).toBeGreaterThanOrEqual(2);
    }
  });

  it("give `caught` a keel.unexpected and no frames when the frame reader throws on them", async () => {
    for (const [kind, make] of Object.entries(KINDS)) {
      const r = await caught(
        () => Promise.reject(make("tok-0")),
        () => thrower(),
      );
      expect(r.result.ok, kind).toBe(false);
      expect(r.frames, kind).toEqual([]);
    }
  });
});
