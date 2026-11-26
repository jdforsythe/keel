// @vitest-environment happy-dom
// Spec: k.schemes, clause "In an app with both schemes, a `node` document requested with `Cookie: keel-scheme=dark` has `<html` with `data-k-scheme=\"dark\"` and its `SchemeSelect` value `dark`; with `keel-scheme=blue`, or with no cookie, it has no `data-k-scheme`."
// k.schemes, First paint: "In an app with both schemes, a `node` deployable's document writes `data-k-scheme=\"<value>\"` on `<html>` when the request's `keel-scheme` cookie is `light` or `dark`, and none for any other value."
// Seed: 1337 (fc.assert below).
// ASSUMPTIONS (spec names no way to hand `createApp` the app's tokens): `createApp({ ..., tokens })` takes the app's tokens object, as the compiler's `projectTokens` carries them (RFC 0243 Build plan); an app with one scheme is `createApp` given `brandTokens`.
// Needs a real browser: that the first paint shows the chosen scheme without a flash, and the system preference, are end-to-end cases; here the served document text is read.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import { SchemeSelect, defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const both = () =>
  defineTokens({ ...brandTokens, color: { ...brandTokens.color, mine: { light: "#111111", dark: "#eeeeee" } } });

const serve = async (tokens: ReturnType<typeof defineTokens>, cookie: string | undefined): Promise<Document> => {
  const c = contract("app", { "app.home": { path: "/" } });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(c, {
      "app.home": {
        component: () =>
          SchemeSelect({ id: "scheme", label: "Scheme", labels: { system: "System", light: "Light", dark: "Dark" } }),
      },
    }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
    tokens,
  });
  const headers = cookie === undefined ? {} : { cookie };
  const res = await app.fetch(new Request("http://localhost/", { headers }));
  return new DOMParser().parseFromString(await res.text(), "text/html");
};
const attr = (doc: Document): string | null => doc.documentElement.getAttribute("data-k-scheme");
const selected = (doc: Document): string | null => {
  const el = doc.getElementById("scheme");
  return el instanceof HTMLSelectElement ? el.value : null;
};

describe("k.schemes: a node document's first paint", () => {
  test('In an app with both schemes, a `node` document requested with `Cookie: keel-scheme=dark` has `<html` with `data-k-scheme="dark"` and its `SchemeSelect` value `dark`', async () => {
    const doc = await serve(both(), "keel-scheme=dark");
    expect(attr(doc)).toBe("dark");
    expect(selected(doc)).toBe("dark");
  });

  test("with `keel-scheme=blue`, or with no cookie, it has no `data-k-scheme`", async () => {
    for (const cookie of ["keel-scheme=blue", undefined]) {
      const doc = await serve(both(), cookie);
      expect(attr(doc)).toBeNull();
      expect(selected(doc)).toBe("system");
    }
  });

  test("the cookie `light` or `dark` is written as is, any other value (case, padding, a list) writes none, among other cookies", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constantFrom("light", "dark", "Light", "DARK", "", " dark", "dark,light", "system", "x"),
          fc.stringMatching(/^[a-z]{0,6}$/),
        ),
        fc.constantFrom("a=1; ", "", "z=2; "),
        async (value, other) => {
          const doc = await serve(both(), `${other}keel-scheme=${value}`);
          expect(attr(doc)).toBe(value === "light" || value === "dark" ? value : null);
        },
      ),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("in an app with one scheme (`brandTokens`) no cookie value writes `data-k-scheme`", async () => {
    for (const value of ["light", "dark"]) expect(attr(await serve(brandTokens, `keel-scheme=${value}`))).toBeNull();
  });
});
