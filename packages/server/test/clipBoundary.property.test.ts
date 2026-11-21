// @vitest-environment node
// k.privacy Server log: a thrown message is scrubbed whole before any clip, so a secret the 89-character clip would cut
// in two is still one mark. For each padding length 0..120 before a revealed secret, a runner, loader, action, guard
// and live loader that throw it log no line holding any of its first 4 or more characters. Seed 1337.
import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, reveal, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SECRET = "Zq7Wv3Kp9Jm2Hb5Tn8Rc4Yd6";
const Secretly = s.secret(s.string());

/** Throws an Error whose message is `pad` x's then the revealed secret, made inside the running scope. */
const throwAt = (pad: number): never => {
  const made = Secretly.parse(SECRET);
  throw new Error(`${"x".repeat(pad)}${made.ok ? reveal(made.value) : ""}`);
};

/** The first prefix of the secret of 4 or more characters any line holds, or `undefined`. */
const leaked = (lines: readonly string[]): string | undefined => {
  for (let n = SECRET.length; n >= 4; n--) {
    const p = SECRET.slice(0, n);
    if (lines.some((l) => l.includes(p))) return p;
  }
  return undefined;
};

const pads = fc.integer({ min: 0, max: 120 });
const settle = () => new Promise<void>((done) => setTimeout(done, 0));
const view = () => document.createElement("main");

type Kind = "loader" | "action" | "guard" | "live";

const Out = s.object({});
const pageC = contract("app", { "app.a": { path: "/a" } });
const guardC = contract("api", { "api.a": { method: "GET", path: "/api/a", output: Out } });
const liveC = contract("api", { "api.a": { method: "GET", path: "/api/a", output: Out, events: true } });

/** The manifest whose `kind` handler throws at `pad`. */
const routesOf = (kind: Kind, pad: number) => {
  if (kind === "loader")
    return manifest(pageC, {
      "app.a": {
        component: view,
        loader: loader(pageC, "app.a", { output: Out }, async () => throwAt(pad)),
      },
    });
  if (kind === "action")
    return manifest(pageC, {
      "app.a": {
        component: view,
        POST: action(pageC, "app.a", { input: s.object({}) }, async () => throwAt(pad)),
      },
    });
  if (kind === "guard")
    return manifest(guardC, {
      "api.a": {
        guard: guard({}, async () => throwAt(pad)),
        loader: loader(guardC, "api.a", {}, async () => ok({})),
      },
    });
  return manifest(liveC, {
    "api.a": {
      loader: loader(liveC, "api.a", {}, async function* () {
        yield ok({});
        throwAt(pad);
      }),
    },
  });
};

async function requestLines(kind: Kind, pad: number): Promise<string[]> {
  const lines: string[] = [];
  const routes = routesOf(kind, pad);
  const app = await createApp({
    topology: topology({ web: { modules: kind === "guard" || kind === "live" ? ["api"] : ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    log: { format: "json", write: (l) => lines.push(l) },
  });
  const accept = kind === "live" ? "text/event-stream" : kind === "loader" ? "text/html" : "application/json";
  const res = await app.fetch(
    kind === "action"
      ? new Request("http://localhost/a", {
          method: "POST",
          body: "{}",
          headers: { "content-type": "application/json", accept },
        })
      : new Request(`http://localhost${kind === "loader" ? "/a" : "/api/a"}`, { headers: { accept } }),
  );
  lines.push(await res.text());
  return lines;
}

describe("a secret straddling the 89-character clip", () => {
  it("a runner's rejection logs no prefix of it", async () => {
    await fc.assert(
      fc.asyncProperty(pads, async (pad) => {
        const lines: string[] = [];
        const app = await createApp({
          topology: topology({ web: { modules: ["app"], adapter: "node" } }),
          ctx: createCtx({ mode: "sim", seed: 1337 }),
          mode: "dev",
          log: { format: "json", write: (l) => lines.push(l) },
          runners: {
            app: [
              {
                run: async () => {
                  await Promise.resolve();
                  throwAt(pad);
                },
              },
            ],
          },
        });
        await settle();
        await app.close?.();
        expect(lines.length).toBeGreaterThan(0);
        expect(leaked(lines)).toBeUndefined();
      }),
      { seed: 1337, numRuns: 121 },
    );
  });

  for (const kind of ["loader", "action", "guard", "live"] as const)
    it(`a ${kind}'s throw logs no prefix of it, nor does the dev response`, async () => {
      await fc.assert(
        fc.asyncProperty(pads, async (pad) => {
          const lines = await requestLines(kind, pad);
          expect(lines.some((l) => l.includes("keel.unexpected"))).toBe(true);
          expect(leaked(lines)).toBeUndefined();
        }),
        { seed: 1337, numRuns: 121 },
      );
    });
});
