// @vitest-environment happy-dom
// k.serverlog, Path "Before the scrub, a segment at a secret `params` field of any route of `routes` (any deployable's) is `[secret]` as sent, at a `.pii()` one `[pii]`, `[secret]` if both. A route lines up from the first segment, skipping empties (a prefix-param route also without it), to that param: a param fits any segment, a static one the same text once decoded and case-folded, or undecodable. A longer path is cut there, the rest joining that mark: `/:t` and `/:p/:t` (`t` secret) mark any path whole. A secret param also cuts a path as `[secret]` at a segment holding `%2F` or `%5C` (any case). Each mark and each cut also takes in the `/`s before its segment but one, and a mark at the last non-empty segment the `/`s after it, so no slash of a value is left: `/reset//<v>`, `/reset/<v>/` and `/reset/<v>//` log `/reset/[secret]`, and `//reset//<v>/` logs `//reset/[secret]`. A path no route lines up with (a static typo, an extra leading segment, a raw `/` in an earlier param, `&` for `?`) is logged as sent."
// Spec: k.serverlog, clause "Of `/reset/:token` (`token` secret), `/reset//<v>`, `/reset///<v>`, `/reset/<v>/`, `/reset/<v>//` and `/reset//a%2Fb` log the `req` path `/reset/[secret]`, and `//reset//<v>/` logs `//reset/[secret]`; of `/u/:email` (`.pii()`), `/u//a@b.c/` logs `/u/[pii]`."
// Seed: 1337.
// The route table is a server test file, outside `keel check`, so a secret or `.pii()` `params` field (E1111) is served. Each case runs in dev and production, in compact and json log formats.
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

const appContract = contract("app", {
  "app.reset": { path: "/reset/:token", params: s.object({ token: s.secret(s.string()) }) },
  "app.user": { path: "/u/:email", params: s.object({ email: s.string().pii("contact") }) },
  "app.confirm": { path: "/confirm/:token/done", params: s.object({ token: s.secret(s.string()) }) },
});
const routes = () =>
  manifest(appContract, {
    "app.reset": { component: view },
    "app.user": { component: view },
    "app.confirm": { component: view },
  });

async function logged(mode: "dev" | "production", format: "compact" | "json", path: string) {
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
  let reqPath: string | undefined;
  for (const line of lines) {
    if (format === "compact") {
      if (line.startsWith("GET ")) reqPath = line.split(" ")[1];
      continue;
    }
    const rec: unknown = JSON.parse(line);
    if (typeof rec === "object" && rec !== null && Reflect.get(rec, "kind") === "req") {
      const p: unknown = Reflect.get(rec, "path");
      if (typeof p === "string") reqPath = p;
    }
  }
  return { lines, reqPath };
}
const holdsNone = (lines: readonly string[], ...values: string[]) => {
  for (const line of lines) for (const v of values) expect(line).not.toContain(v);
};

const tok = fc.stringMatching(/^tok[a-f0-9]{12}$/);
const slashes = (min: number, max: number) => fc.integer({ min, max }).map((n) => "/".repeat(n));

for (const mode of modes)
  for (const format of formats) {
    const where = `in ${mode}, ${format}`;
    describe(`k.serverlog Path: slashes beside a mark, ${where}`, () => {
      it(`Of \`/reset/:token\` (\`token\` secret), \`/reset//<v>\`, \`/reset///<v>\`, \`/reset/<v>/\` and \`/reset/<v>//\` log the \`req\` path \`/reset/[secret]\`, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(tok, async (v) => {
            for (const path of [`/reset//${v}`, `/reset///${v}`, `/reset/${v}/`, `/reset/${v}//`]) {
              const out = await logged(mode, format, path);
              expect(out.reqPath, path).toBe("/reset/[secret]");
              holdsNone(out.lines, v);
            }
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`For any run of slashes before and after the value, a mark takes them all in: \`/reset\` and \`<v>\` apart by 1 to 5 slashes, 0 to 4 after, log \`/reset/[secret]\`, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(slashes(1, 5), tok, slashes(0, 4), async (before, v, after) => {
            const out = await logged(mode, format, `/reset${before}${v}${after}`);
            expect(out.reqPath).toBe("/reset/[secret]");
            holdsNone(out.lines, v);
          }),
          { seed: SEED, numRuns: 20 },
        );
      });

      it(`Of \`/reset/:token\`, \`/reset//a%2Fb\` logs the \`req\` path \`/reset/[secret]\`, and \`//reset//<v>/\` logs \`//reset/[secret]\`: slashes before a static segment stay, ${where}.`, async () => {
        const encoded = await logged(mode, format, "/reset//a%2Fb");
        expect(encoded.reqPath).toBe("/reset/[secret]");
        await fc.assert(
          fc.asyncProperty(slashes(1, 3), slashes(1, 3), tok, slashes(0, 3), async (lead, between, v, after) => {
            const out = await logged(mode, format, `${lead}reset${between}${v}${after}`);
            expect(out.reqPath).toBe(`${lead}reset/[secret]`);
            holdsNone(out.lines, v);
          }),
          { seed: SEED, numRuns: 20 },
        );
        const exact = await logged(mode, format, "//reset//tok0123456789ab/");
        expect(exact.reqPath).toBe("//reset/[secret]");
      });

      it(`Of \`/reset/:token\`, a cut takes in the slashes before its segment but one: \`/reset//<a>//<b>//\` logs \`/reset/[secret]\`, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(slashes(1, 3), tok, slashes(1, 3), tok, slashes(0, 3), async (s1, a, s2, b, s3) => {
            const out = await logged(mode, format, `/reset${s1}${a}${s2}${b}${s3}`);
            expect(out.reqPath).toBe("/reset/[secret]");
            holdsNone(out.lines, a, b);
          }),
          { seed: SEED, numRuns: 15 },
        );
      });

      it(`Of \`/confirm/:token/done\`, a secret segment among static ones: \`/confirm//<v>/done\` logs \`/confirm/[secret]\`, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(slashes(1, 3), tok, async (before, v) => {
            const out = await logged(mode, format, `/confirm${before}${v}/done`);
            expect(out.reqPath).toBe("/confirm/[secret]");
            holdsNone(out.lines, v);
          }),
          { seed: SEED, numRuns: 10 },
        );
      });

      it(`Of \`/u/:email\` (\`.pii()\`), \`/u//a@b.c/\` logs \`/u/[pii]\`, and so does any run of slashes around the address, ${where}.`, async () => {
        const one = await logged(mode, format, "/u//a@b.c/");
        expect(one.reqPath).toBe("/u/[pii]");
        holdsNone(one.lines, "a@b.c");
        await fc.assert(
          fc.asyncProperty(
            slashes(1, 4),
            fc.stringMatching(/^[a-z]{5,10}$/),
            slashes(0, 4),
            async (before, name, after) => {
              const out = await logged(mode, format, `/u${before}${name}@b.c${after}`);
              expect(out.reqPath).toBe("/u/[pii]");
              holdsNone(out.lines, name);
            },
          ),
          { seed: SEED, numRuns: 15 },
        );
      });
    });
  }
