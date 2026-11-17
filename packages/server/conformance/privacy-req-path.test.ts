// @vitest-environment happy-dom
// Spec: k.privacy, Sinks "Server log (k.server): in a `diag` record's message and `frames` and the `req` record's path, each of `piiValues` of the request's decoded action input, its loaders' outputs and its factories' store states becomes `[pii]`. Each string, number and key but a declared field name (not a boolean) in a `Secret` made while the request runs (`bearer` too) becomes `[secret]`."
// Spec: k.privacy, Conformance "A secret route param is `[secret]` in the `req` path. Past 100,000 secret values a loader's throw logs `loader <id> threw: [secret]`." (the first sentence; the second is in privacy-secret-reach.test.ts)
// Seed: 1337.
// The route table is a server test file, outside `keel check`, so a secret `params` field (E1111) is served. Each case runs in dev and production, in compact and json log formats.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp } from "./fixtures.ts";

const view = (): Node => document.createElement("main");
const modes = ["dev", "production"] as const;
const formats = ["compact", "json"] as const;

const Reset = s.object({ token: s.secret(s.string()) });
const Code = s.object({ token: s.secret(s.int()) });
const Plain = s.object({ slug: s.string() });
const Item = s.object({ id: s.int() });
const People = loader({ output: s.object({ name: s.string().pii("name") }) }, () =>
  Promise.resolve(ok({ name: "ada-lovelace" })),
);

const routes = () =>
  manifest({
    "app.reset": { path: "/reset/:token", params: Reset, component: view },
    "app.code": { path: "/code/:token", params: Code, component: view },
    "app.item": { path: "/item/:id", params: Item, component: view },
    "app.plain": { path: "/plain/:slug", params: Plain, component: view },
    "app.person": { path: "/people/:slug", params: Plain, loader: People, component: view },
  });

async function serve(mode: "dev" | "production", format: "compact" | "json", path: string) {
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: routes(),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format, write: (l: string) => void lines.push(l) },
  });
  const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "application/json" } }));
  await res.text();
  return { lines, status: res.status };
}
const reqPath = (format: "compact" | "json", lines: readonly string[]): string | undefined => {
  for (const line of lines) {
    if (format === "compact") {
      if (line.startsWith("GET ")) return line.split(" ")[1];
      continue;
    }
    const rec: unknown = JSON.parse(line);
    if (typeof rec === "object" && rec !== null && Reflect.get(rec, "kind") === "req") {
      const p: unknown = Reflect.get(rec, "path");
      return typeof p === "string" ? p : undefined;
    }
  }
  return undefined;
};

describe("k.privacy req path", () => {
  for (const mode of modes)
    for (const format of formats) {
      const where = `in ${mode}, ${format}`;
      it(`A secret route param is \`[secret]\` in the \`req\` path and no line holds it, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(fc.stringMatching(/^tok-[a-f0-9]{12}$/), async (token) => {
            const { lines } = await serve(mode, format, `/reset/${token}`);
            expect(reqPath(format, lines)).toBe("/reset/[secret]");
            for (const line of lines) {
              expect(line).not.toContain(token);
              expect(line).not.toContain(btoa(token));
            }
            if (format === "compact")
              expect(lines.some((l) => /^GET \/reset\/\[secret\] app\.reset 200 \d+ms$/.test(l))).toBe(true);
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`A secret param whose value fails its inner schema is \`[secret]\` in the \`req\` path and no line holds it, ${where}.`, async () => {
        const { lines, status } = await serve(mode, format, "/code/not-a-number");
        expect(status).toBe(404);
        expect(reqPath(format, lines)).toBe("/code/[secret]");
        for (const line of lines) {
          expect(line).not.toContain("not-a-number");
          expect(line).not.toContain(btoa("not-a-number"));
        }
      });

      it(`A plain param whose value fails its schema is written as it came in the \`req\` path, ${where}.`, async () => {
        const { lines, status } = await serve(mode, format, "/item/not-a-number");
        expect(status).toBe(404);
        expect(reqPath(format, lines)).toBe("/item/not-a-number");
      });

      it(`A request with no secret writes its path unchanged, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(fc.stringMatching(/^[a-z]{4,12}$/), async (slug) => {
            const { lines } = await serve(mode, format, `/plain/${slug}`);
            expect(reqPath(format, lines)).toBe(`/plain/${slug}`);
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`A loader whose output marks \`ada-lovelace\` \`.pii("name")\`, served at \`/people/ada-lovelace\`, writes \`/people/[pii]\`, ${where}.`, async () => {
        const { lines } = await serve(mode, format, "/people/ada-lovelace");
        expect(reqPath(format, lines)).toBe("/people/[pii]");
        for (const line of lines) expect(line).not.toContain("ada-lovelace");
      });
    }
});
