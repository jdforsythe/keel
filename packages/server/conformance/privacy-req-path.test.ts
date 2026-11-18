// @vitest-environment happy-dom
// Spec: k.privacy, Sinks "Server log (k.server): in a `diag` record's message and `frames` and the `req` record's path, each of `piiValues` (k.schema) of the request's decoded action input, its loaders' and actions' outputs and its factories' store states becomes `[pii]`. Each string, number and key but a declared field name (not a boolean) in a `Secret` made or revealed while the request runs (`bearer` too) becomes `[secret]`."
// Spec: k.privacy, Sinks "`req` path, first: a segment at a secret `params` field of any route of `routes` (any deployable's) is `[secret]` as sent, at a `.pii()` one `[pii]`, `[secret]` if both. A route lines up from the first segment, skipping empties (a prefix-param route also without it), to that param: a param fits any segment, a static one the same text once decoded and case-folded, or undecodable. A longer path is cut there, the rest joining that mark: `/:t` and `/:p/:t` (`t` secret) mark any path whole. A secret param also cuts a path as `[secret]` at a segment holding `%2F` or `%5C` (any case). A path no route lines up with (a static typo, an extra leading segment, a raw `/` in an earlier param, `&` for `?`) is logged as sent."
// Spec: k.privacy, Conformance "A secret route param is `[secret]` in the `req` path, escaped any way, in `/%52ESET/<v>` and `//reset//<v>/`, with and without a prefix param, and forwarded to a peer; `/reset/ab/<v>` and `/confirm/a/<v>/done` (of `/confirm/:token/done`) log `/reset/[secret]` and `/confirm/[secret]`; `/en/reset/<v>` logs as sent; a failed forward logs no path. Past 100,000 secret values a loader's throw logs `loader <id> threw: [secret]`." (the second sentence's last part is in privacy-secret-reach.test.ts)
// Spec: k.topology, Calls and peers "(unreachable: 502 `keel.unreachable` and a `diag` `peer unreachable: <name>`, the error's `name` only)"
// Spec: k.privacy, Conformance "`/reset%2F<v>`, `/RESET%2f<v>`, `/reset%5C<v>` (of `/reset/:token`), `/about` (of `/:t`) and `/en/A` (of `/:p/:t`) log `/[secret]`; `/a%2Fb` with no secret param, as sent."
// Seed: 1337.
// The route table is a server test file, outside `keel check`, so a secret `params` field (E1111) is served. Each case runs in dev and production, in compact and json log formats.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp } from "./fixtures.ts";
import { createAppLoose, writeArtifacts } from "./topology-fixtures.ts";

const view = (): Node => document.createElement("main");
const modes = ["dev", "production"] as const;
const formats = ["compact", "json"] as const;

const Reset = s.object({ token: s.secret(s.string()) });
const Code = s.object({ token: s.secret(s.int()) });
const Plain = s.object({ slug: s.string() });
const Org = s.object({ org: s.string(), key: s.secret(s.string()) });
const Callback = s.object({ code: s.secret(s.string()).optional() });
const Two = s.object({ other: s.string(), token: s.secret(s.string()) });
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
    "app.confirm": { path: "/confirm/:token/done", params: Reset, component: view },
    "app.faq": { path: "/reset/help/faq", component: view },
    "app.key": { path: "/o/:org/k/:key", params: Org, component: view },
    "app.callback": { path: "/callback", search: Callback, component: view },
    "app.k1": { path: "/k/:token/more", params: Reset, component: view },
    "app.k2": { path: "/k/:other/:token", params: Two, component: view },
  });

async function serve(mode: "dev" | "production", format: "compact" | "json", path: string, table: unknown = routes()) {
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

const tok = fc.stringMatching(/^tok[a-f0-9]{12}$/);
const toks = fc.tuple(tok, tok).filter(([a, b]) => a !== b);
const holdsNone = (lines: readonly string[], ...values: string[]) => {
  for (const line of lines) for (const v of values) expect(line).not.toContain(v);
};

// One letter of `reset`, in either case, raw or percent-encoded (hex in either case).
const letter = (c: string) =>
  fc.tuple(fc.boolean(), fc.boolean(), fc.boolean()).map(([upper, enc, upHex]) => {
    const ch = upper ? c.toUpperCase() : c;
    if (!enc) return ch;
    const hex = ch.charCodeAt(0).toString(16);
    return `%${upHex ? hex.toUpperCase() : hex}`;
  });
const escapedReset = fc.tuple(...[..."reset"].map(letter)).map((parts) => parts.join(""));
const slashes = (min: number) => fc.integer({ min, max: 3 }).map((n) => "/".repeat(n));

describe("k.privacy req path: marks by the route table", () => {
  for (const mode of modes)
    for (const format of formats) {
      const where = `in ${mode}, ${format}`;

      it(`A secret route param is \`[secret]\` in the \`req\` path, escaped any way (\`/%52ESET/<v>\`), a static segment compared after one decode and a case fold, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(escapedReset, tok, async (seg, token) => {
            const { lines } = await serve(mode, format, `/${seg}/${token}`);
            expect(reqPath(format, lines)).toBe(`/${seg}/[secret]`);
            holdsNone(lines, token);
          }),
          { seed: SEED, numRuns: 15 },
        );
        const { lines } = await serve(mode, format, "/%52ESET/tok0123456789ab");
        expect(reqPath(format, lines)).toBe("/%52ESET/[secret]");
      });

      it(`A static segment that does not decode still lines up, so the param after it is \`[secret]\`, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(tok, async (token) => {
            const { lines } = await serve(mode, format, `/%ZZ/${token}`);
            expect(reqPath(format, lines)).toBe("/%ZZ/[secret]");
            holdsNone(lines, token);
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`A secret route param is \`[secret]\` in \`//reset//<v>/\`, empty segments skipped, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(slashes(1), slashes(1), fc.constantFrom("", "/", "//"), tok, async (a, b, c, token) => {
            const { lines } = await serve(mode, format, `${a}reset${b}${token}${c}`);
            expect(reqPath(format, lines)).toBe(`${a}reset${b}[secret]${c}`);
            holdsNone(lines, token);
          }),
          { seed: SEED, numRuns: 15 },
        );
      });

      it(`A secret route param is \`[secret]\` with and without a prefix param (\`/:lang/acct/:token\`), ${where}.`, async () => {
        const Lang = s.enum(["en", "de"], { pathDefault: "en" });
        const table = manifest({
          "app.acct": {
            path: "/:lang/acct/:token",
            params: s.object({ lang: Lang, token: s.secret(s.string()) }),
            component: view,
          },
        });
        await fc.assert(
          fc.asyncProperty(tok, async (token) => {
            const bare = await serve(mode, format, `/acct/${token}`, table);
            expect(reqPath(format, bare.lines)).toBe("/acct/[secret]");
            holdsNone(bare.lines, token);
            const withLang = await serve(mode, format, `/de/acct/${token}`, table);
            expect(reqPath(format, withLang.lines)).toBe("/de/acct/[secret]");
            holdsNone(withLang.lines, token);
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`\`/reset/ab/<v>\` and \`/confirm/a/<v>/done\` log \`/reset/[secret]\` and \`/confirm/[secret]\`, no line holding either half of \`<v>\`, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(toks, async ([a, b]) => {
            const reset = await serve(mode, format, `/reset/${a}/${b}`);
            expect(reqPath(format, reset.lines)).toBe("/reset/[secret]");
            holdsNone(reset.lines, a, b);
            const confirm = await serve(mode, format, `/confirm/${a}/${b}/done`);
            expect(reqPath(format, confirm.lines)).toBe("/confirm/[secret]");
            holdsNone(confirm.lines, a, b);
          }),
          { seed: SEED, numRuns: 8 },
        );
      });

      it(`A path longer than a secret route is cut at the secret, the whole tail one \`[secret]\`, so the slash count is hidden, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(fc.array(tok, { minLength: 2, maxLength: 5 }), async (parts) => {
            const { lines } = await serve(mode, format, `/reset/${parts.join("/")}`);
            expect(reqPath(format, lines)).toBe("/reset/[secret]");
            holdsNone(lines, ...parts);
          }),
          { seed: SEED, numRuns: 10 },
        );
      });

      it(`The cut does not depend on a route matching: a served longer path of a plain route (\`/reset/help/faq\`) logs \`/reset/[secret]\`, ${where}.`, async () => {
        const { lines, status } = await serve(mode, format, "/reset/help/faq");
        expect(status).toBe(200);
        expect(reqPath(format, lines)).toBe("/reset/[secret]");
        if (format === "compact")
          expect(lines.some((l) => /^GET \/reset\/\[secret\] app\.faq 200 \d+ms$/.test(l))).toBe(true);
        for (const line of lines) expect(line).not.toContain("help/faq");
      });

      it(`With several routes lined up the earliest cut wins (\`/k/:token/more\` and \`/k/:other/:token\`), ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(toks, async ([a, b]) => {
            const { lines } = await serve(mode, format, `/k/${a}/${b}`);
            expect(reqPath(format, lines)).toBe("/k/[secret]");
            holdsNone(lines, a, b);
          }),
          { seed: SEED, numRuns: 8 },
        );
      });

      it(`Stated limit: \`/en/reset/<v>\`, an extra leading segment, logs as sent, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(tok, async (token) => {
            const { lines } = await serve(mode, format, `/en/reset/${token}`);
            expect(reqPath(format, lines)).toBe(`/en/reset/${token}`);
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`Stated limit: a raw \`/\` in a plain param before the secret (\`/o/a/b/k/<v>\` of \`/o/:org/k/:key\`) logs as sent, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(tok, tok, async (org, token) => {
            const { lines } = await serve(mode, format, `/o/${org}/b/k/${token}`);
            expect(reqPath(format, lines)).toBe(`/o/${org}/b/k/${token}`);
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`Stated limit: a typo in a static segment, a double encoding or a trailing dot logs as sent, ${where}.`, async () => {
        for (const seg of ["rezet", "%2552eset", "reset."]) {
          const { lines } = await serve(mode, format, `/${seg}/tok0123456789ab`);
          expect(reqPath(format, lines)).toBe(`/${seg}/tok0123456789ab`);
        }
      });

      it(`Stated limit: a secret \`search\` value in a link missing its \`?\` (\`/callback&code=<v>\`) logs as sent, and with its \`?\` the query is not logged, ${where}.`, async () => {
        const lost = await serve(mode, format, "/callback&code=tok0123456789ab");
        expect(reqPath(format, lost.lines)).toBe("/callback&code=tok0123456789ab");
        const kept = await serve(mode, format, "/callback?code=tok0123456789ab");
        expect(reqPath(format, kept.lines)).toBe("/callback");
        holdsNone(kept.lines, "tok0123456789ab");
      });
    }
});

describe("k.privacy req path: an encoded separator and an over-mark", () => {
  const Tok = s.object({ t: s.secret(s.string()) });
  const Lead = s.object({ p: s.string(), t: s.secret(s.string()) });
  const Files = s.object({ name: s.string() });
  const lone = () => manifest({ "app.t": { path: "/:t", params: Tok, component: view } });
  const led = () => manifest({ "app.pt": { path: "/:p/:t", params: Lead, component: view } });
  const files = () => manifest({ "app.file": { path: "/files/:name", params: Files, component: view } });

  for (const mode of modes)
    for (const format of formats) {
      const where = `in ${mode}, ${format}`;

      it(`\`/reset%2F<v>\`, \`/RESET%2f<v>\` and \`/reset%5C<v>\` (of \`/reset/:token\`) log \`/[secret]\` and no line holds \`<v>\`, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(tok, async (token) => {
            for (const path of [`/reset%2F${token}`, `/RESET%2f${token}`, `/reset%5C${token}`, `/reset%5c${token}`]) {
              const { lines } = await serve(mode, format, path);
              expect(reqPath(format, lines)).toBe("/[secret]");
              holdsNone(lines, token);
            }
          }),
          { seed: SEED, numRuns: 8 },
        );
      });

      it(`\`/about\` (of \`/:t\`) and \`/en/A\` (of \`/:p/:t\`) log \`/[secret]\`, ${where}.`, async () => {
        const one = await serve(mode, format, "/about", lone());
        expect(reqPath(format, one.lines)).toBe("/[secret]");
        holdsNone(one.lines, "about");
        const two = await serve(mode, format, "/en/A", led());
        expect(reqPath(format, two.lines)).toBe("/[secret]");
        holdsNone(two.lines, "/en/");
      });

      it(`\`/a%2Fb\` with no secret param is logged as sent, ${where}.`, async () => {
        for (const path of ["/a%2Fb", "/files/a%2Fb", "/files/a%5Cb"]) {
          const { lines } = await serve(mode, format, path, files());
          expect(reqPath(format, lines)).toBe(path);
        }
      });
    }
});

describe("k.privacy req path: a route of a second deployable and a failed peer", () => {
  const Api = s.object({ token: s.secret(s.string()) });
  const table = () =>
    manifest({
      "app.home": { path: "/", component: view },
      "api.reset": { path: "/reset/:token", params: Api, component: view },
    });

  async function front(
    mode: "dev" | "production",
    format: "compact" | "json",
    path: string,
    peer: (req: Request) => Promise<Response>,
  ) {
    const lines: string[] = [];
    const ctx = createCtx({ mode: "sim", seed: SEED });
    ctx.net.route("http://api.test/*", peer);
    const app = await createAppLoose({
      topology: topology({ web: { modules: ["app"], adapter: "node" }, api: { modules: ["api"], adapter: "node" } }),
      deployable: "web",
      routes: table(),
      ctx,
      mode,
      peers: { api: "http://api.test" },
      artifacts: writeArtifacts(table()),
      log: { format, write: (l: string) => void lines.push(l) },
    });
    const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "application/json" } }));
    await res.text();
    return { lines, status: res.status };
  }

  for (const mode of modes)
    for (const format of formats) {
      const where = `in ${mode}, ${format}`;

      it(`A secret route param of a route of another deployable is \`[secret]\` in the \`req\` path of the front server, forwarded to a peer, and a longer path is cut, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(toks, async ([a, b]) => {
            const seen: string[] = [];
            const peer = (req: Request) => {
              seen.push(new URL(req.url).pathname);
              return Promise.resolve(new Response("{}", { headers: { "content-type": "application/json" } }));
            };
            const one = await front(mode, format, `/reset/${a}`, peer);
            expect(seen).toEqual([`/reset/${a}`]);
            expect(reqPath(format, one.lines)).toBe("/reset/[secret]");
            holdsNone(one.lines, a);
            const two = await front(mode, format, `/reset/${a}/${b}`, peer);
            expect(reqPath(format, two.lines)).toBe("/reset/[secret]");
            holdsNone(two.lines, a, b);
          }),
          { seed: SEED, numRuns: 5 },
        );
      });

      it(`A failed peer forward logs its error's \`name\` only, no path and no message, ${where}.`, async () => {
        await fc.assert(
          fc.asyncProperty(tok, async (token) => {
            const peer = (req: Request) =>
              Promise.reject(new TypeError(`fetch failed: ${req.url} ${new URL(req.url).pathname}`));
            const { lines } = await front(mode, format, `/reset/${token}`, peer);
            holdsNone(lines, token, "fetch failed", "api.test");
            expect(lines.some((l) => l.includes("peer unreachable: TypeError"))).toBe(true);
          }),
          { seed: SEED, numRuns: 5 },
        );
      });
    }
});
