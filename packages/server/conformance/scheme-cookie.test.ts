// @vitest-environment happy-dom
// Spec: k.schemes, clause "A `createApp` whose `artifacts` folder holds `schemes.json` `{ \"schemes\": [\"light\", \"dark\"] }` answers a document request sent with `Cookie: keel-scheme=dark` with `<html` carrying `data-k-scheme=\"dark\"` and its `SchemeSelect` value `dark`; with `keel-scheme=blue`, with no cookie, with `{ \"schemes\": [\"light\"] }` or with no `schemes.json`, the document has no `data-k-scheme`."
// k.schemes First paint: `keel build` and `keel dev` write `schemes.json` into a node deployable's artifacts folder; that write is an end-to-end case of the build, and `createApp` reading it is asserted here.
// Seed: 1337 (fc.assert below).
// ASSUMPTIONS: the app's schemes reach `createApp` as `schemes.json` in the folder `artifacts` names, as the raw object `{ "schemes": [...] }` (no `data`/`hash` envelope: the spec prints the bare form); `routes.json` is not needed. "Read once" is asserted by rewriting the file after the app is built: the document still follows the file as it was read.
// Needs a real browser: that the first paint shows the chosen scheme without a flash, and the system preference, are end-to-end cases (RFC 0244's runner); here the served document text is read.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import { SchemeSelect } from "@keel/ui";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";

const SEED = 1337;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
/** A fresh `artifacts` folder holding `schemes.json` as `body` (none when undefined). */
const artifactsWith = (body: string | undefined): string => {
  const dir = mkdtempSync(join(tmpdir(), "keel-schemes-"));
  dirs.push(dir);
  mkdirSync(dir, { recursive: true });
  if (body !== undefined) writeFileSync(join(dir, "schemes.json"), body);
  return dir;
};
const schemesJson = (schemes: readonly string[]): string => JSON.stringify({ schemes });
const BOTH = schemesJson(["light", "dark"]);

const build = async (artifacts: string) => {
  const c = contract("app", { "app.home": { path: "/" } });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(c, {
      "app.home": {
        component: () =>
          SchemeSelect({ id: "scheme", label: "Scheme", labels: { system: "System", light: "Light", dark: "Dark" } }),
      },
    }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
    artifacts,
  });
};
const request = async (app: Awaited<ReturnType<typeof build>>, cookie: string | undefined): Promise<Document> => {
  const headers = cookie === undefined ? {} : { cookie };
  const res = await app.fetch(new Request("http://localhost/", { headers }));
  return new DOMParser().parseFromString(await res.text(), "text/html");
};
const serve = async (body: string | undefined, cookie: string | undefined): Promise<Document> =>
  request(await build(artifactsWith(body)), cookie);
const attr = (doc: Document): string | null => doc.documentElement.getAttribute("data-k-scheme");
/** The value of the option the served HTML marks `selected` (happy-dom's parsed `select.value` follows its own index, so the attribute the product wrote is read). */
const selected = (doc: Document): string | null => {
  const marked = Array.from(doc.querySelectorAll("#scheme option")).filter((o) => o.hasAttribute("selected"));
  const only = marked.length === 1 ? marked[0] : undefined;
  return only?.getAttribute("value") ?? null;
};

describe("k.schemes: a node document's first paint", () => {
  test('In an app with both schemes, a `node` document requested with `Cookie: keel-scheme=dark` has `<html` with `data-k-scheme="dark"` and its `SchemeSelect` value `dark`', async () => {
    const doc = await serve(BOTH, "keel-scheme=dark");
    expect(attr(doc)).toBe("dark");
    expect(selected(doc)).toBe("dark");
  });

  test("with `keel-scheme=blue`, or with no cookie, it has no `data-k-scheme`", async () => {
    for (const cookie of ["keel-scheme=blue", undefined]) {
      const doc = await serve(BOTH, cookie);
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
          const doc = await serve(BOTH, `${other}keel-scheme=${value}`);
          expect(attr(doc)).toBe(value === "light" || value === "dark" ? value : null);
        },
      ),
      { seed: SEED, numRuns: 15 },
    );
  });

  test('with `{ "schemes": ["light"] }` or with no `schemes.json`, the document has no `data-k-scheme`, whatever the cookie', async () => {
    for (const body of [schemesJson(["light"]), undefined])
      for (const value of ["light", "dark"]) {
        const doc = await serve(body, `keel-scheme=${value}`);
        expect(attr(doc)).toBeNull();
      }
  });

  test("`createApp` reads `schemes.json` once from `artifacts`: a file rewritten after the app is built does not change its documents", async () => {
    const dir = artifactsWith(BOTH);
    const app = await build(dir);
    writeFileSync(join(dir, "schemes.json"), schemesJson(["light"]));
    expect(attr(await request(app, "keel-scheme=dark"))).toBe("dark");
  });
});
