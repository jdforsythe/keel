// @vitest-environment happy-dom
// k.privacy Server log: a value sent for a secret route param is `[secret]` in the `req` path whatever spelling the
// client chose for it: any mix of raw characters and upper- or lower-case percent-escapes, an escape that does not
// decode (`%`, `%zz`, an over-long `%C0%AF`), a `+`, a `;`, whether or not it passes the param's schema. The segment
// the route's secret param stands at is marked whole. Seed 1337.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type AppOptions, createApp, topology } from "../src/index.ts";

const SEED = 1337;
const view = (): Node => document.createElement("main");

const ROUTES = manifest({
  "app.reset": { path: "/reset/:token", params: s.object({ token: s.secret(s.string()) }), component: view },
  "app.code": { path: "/code/:n/x", params: s.object({ n: s.secret(s.int()) }), component: view },
  "app.plain": { path: "/plain/:slug", params: s.object({ slug: s.string() }), component: view },
});

async function reqPath(
  url: string,
  routes: AppOptions["routes"] = ROUTES,
): Promise<{ path: unknown; lines: string[] }> {
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  await (await app.fetch(new Request(`http://localhost${url}`, { headers: { accept: "application/json" } }))).text();
  await app.close();
  const req = lines
    .map((l): unknown => JSON.parse(l))
    .find((r) => typeof r === "object" && r !== null && Reflect.get(r, "kind") === "req");
  return { path: typeof req === "object" && req !== null ? Reflect.get(req, "path") : undefined, lines };
}

const hex = (c: string): string => c.charCodeAt(0).toString(16).padStart(2, "0");
/** One spelling of `c`: as is, `%XX` or `%xx`. */
const spelt = (c: string, how: number): string =>
  how === 0 ? c : how === 1 ? `%${hex(c).toUpperCase()}` : `%${hex(c).toLowerCase()}`;

describe("a secret route param in the req path", () => {
  it("is [secret] under any mix of escapes the client chose, and no line holds the value", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^tok-[a-f0-9]{12}$/),
        fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 16, maxLength: 16 }),
        async (token, hows) => {
          const sent = [...token].map((c, i) => spelt(c, hows[i] ?? 0)).join("");
          const { path, lines } = await reqPath(`/reset/${sent}`);
          expect(path).toBe("/reset/[secret]");
          for (const l of lines) {
            expect(l).not.toContain(token);
            expect(l).not.toContain(sent);
          }
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });

  for (const sent of [
    "%74ok-9a8b7c6d5e4f",
    "tok%2D9a8b7c6d5e4f",
    "tok%2d9a8b7c6d5e4f",
    "tok-9a8b7c6d5e4f%",
    "tok-9a8b%zz7c6d5e4f",
    "tok-9a8b%C0%AF7c6d5e4f",
    "tok-9a8b+7c6d5e4f",
    "tok-9a8b7c6d5e4f;x=1",
    "%2574ok-9a8b7c6d5e4f",
  ])
    it(`is [secret] when sent as ${sent}`, async () => {
      const { path, lines } = await reqPath(`/reset/${sent}`);
      expect(path).toBe("/reset/[secret]");
      for (const l of lines) expect(l).not.toContain("9a8b");
    });

  it("is [secret] with a trailing slash, and a longer path is cut at the secret whether or not it parses", async () => {
    expect((await reqPath("/reset/tok-9a8b7c6d5e4f/")).path).toBe("/reset/[secret]/");
    expect((await reqPath("/code/9081726354/x")).path).toBe("/code/[secret]");
    expect((await reqPath("/code/not-a-number-9a8b/x")).path).toBe("/code/[secret]");
    expect((await reqPath("/code/%39081726354/x")).path).toBe("/code/[secret]");
  });

  it("leaves a plain param and a path no secret route matches as they came", async () => {
    expect((await reqPath("/plain/tok%2D9a8b")).path).toBe("/plain/tok%2D9a8b");
    expect((await reqPath("/elsewhere/tok-9a8b")).path).toBe("/elsewhere/tok-9a8b");
    // A typo in a static segment or a leading segment no route declares is a path no route has.
    expect((await reqPath("/rest/tok-9a8b")).path).toBe("/rest/tok-9a8b");
    expect((await reqPath("/en/reset/tok-9a8b")).path).toBe("/en/reset/tok-9a8b");
  });
});

/** A static segment as a mistyped link may carry it: each letter's case flipped or not and spelt raw or escaped. */
const perturbed = (word: string, flips: readonly number[], hows: readonly number[]): string =>
  [...word].map((c, i) => spelt((flips[i] ?? 0) === 1 ? c.toUpperCase() : c, hows[i] ?? 0)).join("");

describe("a secret route param in the req path of a mistyped link", () => {
  it("is [secret] under a tail, empty segments, a served prefix, case flips, escapes or a bad escape", async () => {
    const word = fc.stringMatching(/^[a-z]{4,8}$/);
    const bits = fc.array(fc.integer({ min: 0, max: 1 }), { minLength: 8, maxLength: 8 });
    const hows = fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 16, maxLength: 16 });
    const lead = fc.array(fc.record({ word, flips: bits, hows, bad: fc.boolean() }), { minLength: 1, maxLength: 3 });
    const how = fc.record({
      lang: fc.constantFrom("none", "omitted", "en", "fr"),
      tail: fc.array(word, { maxLength: 3 }),
      empties: fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
    });
    await fc.assert(
      fc.asyncProperty(
        lead,
        fc.array(word, { maxLength: 2 }),
        fc.stringMatching(/^tok-[a-f0-9]{12}$/),
        hows,
        how,
        async (statics, after, token, spell, h) => {
          const body = `${statics.map((x) => x.word).join("/")}/:token${after.map((w) => `/${w}`).join("")}`;
          const lang = s.enum(["en", "fr"], { pathDefault: "en" });
          const routes = manifest({
            "app.r":
              h.lang === "none"
                ? { path: `/${body}`, params: s.object({ token: s.secret(s.string()) }), component: view }
                : { path: `/:lang/${body}`, params: s.object({ lang, token: s.secret(s.string()) }), component: view },
            "app.plain": { path: "/plain/:slug", params: s.object({ slug: s.string() }), component: view },
          });
          const sent = [...token].map((c, i) => spelt(c, spell[i] ?? 0)).join("");
          const parts = [
            ...(h.lang === "en" || h.lang === "fr" ? [h.lang] : []),
            ...statics.map((x) => `${perturbed(x.word, x.flips, x.hows)}${x.bad ? "%zz" : ""}`),
            sent,
            ...after,
            ...h.tail,
          ];
          const url = `/${parts.map((p, i) => (h.empties[i] === true ? `/${p}` : p)).join("/")}`;
          const { path, lines } = await reqPath(url, routes);
          expect(typeof path).toBe("string");
          for (const l of lines) {
            expect(l.toLowerCase()).not.toContain(token);
            expect(l.toLowerCase()).not.toContain(sent.toLowerCase());
            expect(l).not.toContain(token.slice(4));
          }
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  const typed: readonly (readonly [string, string])[] = [
    ["/reset/tok-9a8b7c6d5e4f/extra", "/reset/[secret]"],
    ["//reset/tok-9a8b7c6d5e4f", "//reset/[secret]"],
    ["/reset//tok-9a8b7c6d5e4f", "/reset//[secret]"],
    ["/Reset/tok-9a8b7c6d5e4f", "/Reset/[secret]"],
    ["/RESET/tok-9a8b7c6d5e4f", "/RESET/[secret]"],
    ["/res%zzet/tok-9a8b7c6d5e4f", "/res%zzet/[secret]"],
    ["/r%65set/tok-9a8b7c6d5e4f", "/r%65set/[secret]"],
    ["/code/9081726354/x/more", "/code/[secret]"],
    ["/code/9081726354/y", "/code/[secret]"],
  ];
  for (const [sent, want] of typed)
    it(`is [secret] in ${sent}`, async () => {
      const { path, lines } = await reqPath(sent);
      expect(path).toBe(want);
      for (const l of lines) expect(l).not.toContain("9a8b");
    });
});
