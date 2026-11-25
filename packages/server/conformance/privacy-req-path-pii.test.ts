// @vitest-environment happy-dom
// Spec: k.privacy, clause "Of `/u/:email` (`.pii()`), `/u/a@b.c`, `/u/a%40b.c`, `/U/a@b.c` and `/u/a@b.c/x` log `/u/[pii]`; `[secret]` if also secret."
// k.serverlog, Path "Before the scrub, a segment at a secret `params` field of any route of `routes` (any deployable's) is `[secret]` as sent, at a `.pii()` one `[pii]`, `[secret]` if both. A route lines up from the first segment, skipping empties (a prefix-param route also without it), to that param: a param fits any segment, a static one the same text once decoded and case-folded, or undecodable. A longer path is cut there, the rest joining that mark: `/:t` and `/:p/:t` (`t` secret) mark any path whole. A secret param also cuts a path as `[secret]` at a segment holding `%2F` or `%5C` (any case). Each mark and each cut also takes in the `/`s before its segment but one, and a mark at the last non-empty segment the `/`s after it, so no slash of a value is left: `/reset//<v>`, `/reset/<v>/` and `/reset/<v>//` log `/reset/[secret]`, and `//reset//<v>/` logs `//reset/[secret]`. A path no route lines up with (a static typo, an extra leading segment, a raw `/` in an earlier param, `&` for `?`) is logged as sent."
// Seed: 1337.
// The route table is a server test file, outside `keel check`, so a `.pii()` `params` field (E1111) is served. Each case runs in dev and production, in compact and json log formats.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp } from "./fixtures.ts";

const view = (): Node => document.createElement("main");
const modes = ["dev", "production"] as const;
const formats = ["compact", "json"] as const;

const Email = s.object({ email: s.string().pii("contact") });
const SecretEmail = s.object({ email: s.secret(s.string().pii("contact")) });
const PiiTwo = s.object({ email: s.string().pii("contact") });
const SecretTwo = s.object({ email: s.secret(s.string()) });

const appContract = contract("app", { "app.user": { path: "/u/:email", params: Email } });
const pii = () => manifest(appContract, { "app.user": { component: view } });
const appContract2 = contract("app", { "app.user": { path: "/u/:email", params: SecretEmail } });
const both = () => manifest(appContract2, { "app.user": { component: view } });
const appContract3 = contract("app", {
  "app.a": { path: "/u/:email", params: PiiTwo },
  "app.b": { path: "/u/:email/x", params: SecretTwo },
});
const twoRoutes = () => manifest(appContract3, { "app.a": { component: view }, "app.b": { component: view } });

async function serve(mode: "dev" | "production", format: "compact" | "json", path: string, table: unknown) {
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: table,
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
const holdsNone = (lines: readonly string[], ...values: string[]) => {
  for (const line of lines) for (const v of values) expect(line).not.toContain(v);
};

const local = fc.stringMatching(/^[a-z]{5,10}$/);

describe("k.privacy req path: a .pii() param", () => {
  for (const mode of modes)
    for (const format of formats) {
      const where = `in ${mode}, ${format}`;

      it(`Of \`/u/:email\` (\`.pii()\`), \`/u/a@b.c\`, \`/u/a%40b.c\`, \`/U/a@b.c\` and \`/u/a@b.c/x\` log \`/u/[pii]\`, no line holding the address, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(local, async (name) => {
            const addr = `${name}@b.c`;
            const enc = `${name}%40b.c`;
            const paths = [
              { path: `/u/${addr}`, logged: "/u/[pii]" },
              { path: `/u/${enc}`, logged: "/u/[pii]" },
              { path: `/U/${addr}`, logged: "/U/[pii]" },
              { path: `/u/${addr}/x`, logged: "/u/[pii]" },
            ];
            for (const { path, logged } of paths) {
              const { lines } = await serve(mode, format, path, pii());
              expect(reqPath(format, lines)).toBe(logged);
              holdsNone(lines, name);
            }
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`Of \`/u/:email\` (\`.pii()\`), a path longer than the route is cut at the pii segment and a raw \`/\` in the value leaves no tail, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(local, local, async (a, b) => {
            const { lines } = await serve(mode, format, `/u/${a}/${b}/${a}`, pii());
            expect(reqPath(format, lines)).toBe("/u/[pii]");
            holdsNone(lines, a, b);
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`Of \`/u/:email\` that is also secret, \`/u/a@b.c\`, \`/u/a%40b.c\`, \`/U/a@b.c\` and \`/u/a@b.c/x\` log \`[secret]\` at the segment, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(local, async (name) => {
            const paths = [
              { path: `/u/${name}@b.c`, logged: "/u/[secret]" },
              { path: `/u/${name}%40b.c`, logged: "/u/[secret]" },
              { path: `/U/${name}@b.c`, logged: "/U/[secret]" },
              { path: `/u/${name}@b.c/x`, logged: "/u/[secret]" },
            ];
            for (const { path, logged } of paths) {
              const { lines } = await serve(mode, format, path, both());
              expect(reqPath(format, lines)).toBe(logged);
              holdsNone(lines, name, "[pii]");
            }
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`Two routes putting a secret and a pii param at one segment log \`[secret]\` there, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(local, async (name) => {
            const { lines } = await serve(mode, format, `/u/${name}@b.c/x`, twoRoutes());
            expect(reqPath(format, lines)).toBe("/u/[secret]");
            holdsNone(lines, name);
          }),
          { seed: SEED, numRuns: 5 },
        );
      });
    }
});
