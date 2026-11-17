// @vitest-environment node
// k.privacy Server log: a thrown message is scrubbed whole before any clip, so a secret the 89-character clip would cut
// in two is still one mark. For each padding length 0..120 before a revealed secret, a runner, loader, action, guard
// and live loader that throw it log no line holding any of its first 4 or more characters. Seed 1337.
import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
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

/** A page route whose POST action throws at `pad`. */
const actionRoutes = (pad: number) => {
  const routes = manifest({ "app.a": { path: "/a", component: view } });
  routes.actions({ "app.a": { POST: action({ input: s.object({}) }, async () => throwAt(pad)) } });
  return routes;
};

async function requestLines(kind: Kind, pad: number): Promise<string[]> {
  const lines: string[] = [];
  const Out = s.object({});
  const routes =
    kind === "loader"
      ? manifest({
          "app.a": { path: "/a", loader: loader({ output: Out }, async () => throwAt(pad)), component: view },
        })
      : kind === "guard"
        ? manifest({
            "api.a": {
              api: true,
              path: "/api/a",
              guard: guard({}, async () => throwAt(pad)),
              loader: loader({ output: Out }, async () => ok({})),
            },
          })
        : kind === "live"
          ? manifest({
              "api.a": {
                api: true,
                path: "/api/a",
                loader: loader({ output: Out }, async function* () {
                  yield ok({});
                  throwAt(pad);
                }),
              },
            })
          : actionRoutes(pad);
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
