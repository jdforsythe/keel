// @vitest-environment happy-dom
// rfc:0160 conformance: `createApp` with `origin: 'https://a.example'` for a deployable framing `https://a.example` rejects with E1590.
// rfc:0160 conformance: the topology's own `origins` do not widen a policy once the static read's are passed to `createApp`.
// Spec: k.origins, Frame "A `frame` origin of the app's own is E1590 in `keel build` (a `KEEL_PEER_<NAME>`, `KEEL_ORIGIN`) and `createApp` (`origin`, a URL peer); a document drops its own from `frame-src` (dev: one E1590 logged)."
// Spec: k.origins, Policy "All read the static read's declaration: the entries pass it as `createApp({ origins })`."
// Seed 1337 (fc.assert below; sim ctx seed 1337).
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { directivesOf } from "./origins-support.ts";
import { SEED, createAppLoose, simCtx } from "./topology-fixtures.ts";

const appContract = contract("app", { "app.plain": { path: "/plain" } });
const routes = manifest(appContract, { "app.plain": { component: () => document.createElement("main") } });
const make = (extra: Record<string, unknown>, origins: Record<string, Record<string, string>> | undefined) =>
  createAppLoose({
    topology: topology({
      web: { modules: ["app"], adapter: "node", ...(origins === undefined ? {} : { origins }) },
      api: { modules: ["other"], adapter: "node" },
    }),
    deployable: "web",
    routes,
    ctx: simCtx(),
    ...extra,
  });
const framing = (o: string) => ({ frame: { [o]: "r" } });

async function rejection(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Error) return e.message;
    throw new Error("rejected with a non-Error");
  }
  return "";
}

describe("rfc:0160 conformance: createApp and an own-origin frame", () => {
  test("rfc:0160 conformance: `createApp` with `origin: 'https://a.example'` for a deployable framing `https://a.example` rejects with E1590", async () => {
    const msg = await rejection(make({ origin: "https://a.example" }, framing("https://a.example")));
    expect(msg).toMatch(/E1590/);
  });
  test("rfc:0160 conformance: `createApp` with `origin` and a deployable framing another origin resolves", async () => {
    const app = await make({ origin: "https://a.example" }, framing("https://b.example"));
    expect(typeof app.fetch).toBe("function");
  });
  test("rfc:0160 conformance: a URL peer's origin framed by the deployable rejects with E1590, for any host", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{3,10}$/), async (h) => {
        const o = `https://${h}.example`;
        expect(await rejection(make({ peers: { api: `${o}/base` } }, framing(o)))).toMatch(/E1590/);
        expect(await rejection(make({ peers: { api: `${o}/base` } }, framing(`https://${h}2.example`)))).toBe("");
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
  test("rfc:0160 conformance: the `origins` passed to `createApp` replace the topology's own, so a runtime origin the static read did not see is in no policy", async () => {
    const run = async (origins: Record<string, Record<string, Record<string, string>>> | undefined) => {
      const app = await make(
        { mode: "production", ...(origins === undefined ? {} : { origins }) },
        {
          img: { "https://evil.example": "x" },
          connect: { "https://evil.example": "x" },
          ...framing("https://evil.example"),
        },
      );
      const res = await app.fetch(new Request("http://localhost/plain"));
      return res.headers.get("content-security-policy") ?? "";
    };
    expect(await run(undefined)).toContain("https://evil.example");
    const none = await run({ web: {}, api: {} });
    expect(none).not.toContain("evil.example");
    expect(directivesOf(none)).toContain("img-src 'self'");
    const read = await run({ web: { img: { "https://seen.example": "r" } }, api: {} });
    expect(read).not.toContain("evil.example");
    expect(directivesOf(read)).toContain("img-src 'self' https://seen.example");
  });
});
