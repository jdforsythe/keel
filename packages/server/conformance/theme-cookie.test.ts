// @vitest-environment happy-dom
// Spec: k.schemes, clause "A `createApp` whose `schemes.json` is `{ \"schemes\": [\"light\"], \"themes\": [\"slate\"] }` answers `Cookie: keel-theme=slate` with `<html` carrying `data-k-theme=\"slate\"`, and `keel-theme=nope` with none; a `static` build with one scheme and a `choice` theme has the `keel-scheme` script, and with only a `print` theme none."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// k.schemes First paint: `keel build` and `keel dev` write `schemes.json` (`{ "schemes": [...], "themes": [...] }`) into a node deployable's artifacts folder; that write is in packages/cli/conformance/scheme-static-script.test.ts and an end-to-end case, and `createApp` reading it is asserted here. The `static` build half of the clause is the cli file.
// ASSUMPTIONS (as scheme-cookie.test.ts): the app's schemes and themes reach `createApp` as `schemes.json` in the folder `artifacts` names, the raw object, no envelope; a `ThemeSelect`'s value in the served document is the option the HTML marks `selected`. "Names a listed theme" is exact string equality with an entry of `themes`.
// Needs a real browser: that the first paint shows the chosen theme from the first frame is an end-to-end case (RFC 0244's runner); here the served document text is read.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import { ThemeSelect } from "@keel/ui";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";

const SEED = 1337;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const artifactsWith = (body: string | undefined): string => {
  const dir = mkdtempSync(join(tmpdir(), "keel-themes-"));
  dirs.push(dir);
  mkdirSync(dir, { recursive: true });
  if (body !== undefined) writeFileSync(join(dir, "schemes.json"), body);
  return dir;
};
const json = (schemes: readonly string[], themes?: readonly string[]): string =>
  JSON.stringify(themes === undefined ? { schemes } : { schemes, themes });
const ONE = json(["light"], ["slate"]);

const build = async (artifacts: string) => {
  const c = contract("app", { "app.home": { path: "/" } });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(c, {
      "app.home": {
        component: () =>
          ThemeSelect({ id: "theme", label: "Theme", labels: { default: "Keel", slate: "Slate", forest: "Forest" } }),
      },
    }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
    artifacts,
  });
};
const serve = async (body: string | undefined, cookie: string | undefined): Promise<Document> => {
  const app = await build(artifactsWith(body));
  const res = await app.fetch(new Request("http://localhost/", { headers: cookie === undefined ? {} : { cookie } }));
  return new DOMParser().parseFromString(await res.text(), "text/html");
};
const theme = (doc: Document): string | null => doc.documentElement.getAttribute("data-k-theme");
const scheme = (doc: Document): string | null => doc.documentElement.getAttribute("data-k-scheme");
const selected = (doc: Document): string | null => {
  const marked = Array.from(doc.querySelectorAll("#theme option")).filter((o) => o.hasAttribute("selected"));
  const only = marked.length === 1 ? marked[0] : undefined;
  return only?.getAttribute("value") ?? null;
};

describe("k.schemes: a node document's theme on the first paint", () => {
  test('A `createApp` whose `schemes.json` is `{ "schemes": ["light"], "themes": ["slate"] }` answers `Cookie: keel-theme=slate` with `<html` carrying `data-k-theme="slate"`', async () => {
    const doc = await serve(ONE, "keel-theme=slate");
    expect(theme(doc)).toBe("slate");
    expect(selected(doc)).toBe("slate");
  });

  test("and `keel-theme=nope` with none", async () => {
    const doc = await serve(ONE, "keel-theme=nope");
    expect(theme(doc)).toBeNull();
    expect(selected(doc)).toBe("default");
  });

  test("with no cookie, with no `themes` in the file, or with no `schemes.json`, the document has no `data-k-theme`, whatever the cookie", async () => {
    expect(theme(await serve(ONE, undefined))).toBeNull();
    for (const body of [json(["light"]), json(["light", "dark"]), undefined])
      expect(theme(await serve(body, "keel-theme=slate"))).toBeNull();
  });

  test("a cookie value is written only when it is exactly a listed theme, among other cookies, whatever the value", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constantFrom(
            "slate",
            "forest",
            "Slate",
            "slate%20",
            "slate ",
            "default",
            "light",
            "",
            "slate,forest",
            "x",
          ),
          fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
        ),
        fc.constantFrom("a=1; ", "", "keel-scheme=dark; "),
        async (value, other) => {
          const doc = await serve(json(["light", "dark"], ["slate", "forest"]), `${other}keel-theme=${value}`);
          // A header's field value holds no trailing white space (RFC 9110; `Headers` trims it, as does a cookie-pair's
          // parse): `slate ` reaches the server as `slate`. `slate%20` keeps its tail and is no listed theme.
          const sent = value.trimEnd();
          expect(theme(doc)).toBe(sent === "slate" || sent === "forest" ? sent : null);
        },
      ),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("the scheme cookie and the theme cookie are read independently: both are written when both are valid", async () => {
    const doc = await serve(json(["light", "dark"], ["slate"]), "keel-scheme=dark; keel-theme=slate");
    expect(scheme(doc)).toBe("dark");
    expect(theme(doc)).toBe("slate");
    const onlyTheme = await serve(json(["light", "dark"], ["slate"]), "keel-scheme=blue; keel-theme=slate");
    expect(scheme(onlyTheme)).toBeNull();
    expect(theme(onlyTheme)).toBe("slate");
  });

  test("`createApp` reads `themes` once from `artifacts`: a file rewritten after the app is built does not change its documents", async () => {
    const dir = artifactsWith(ONE);
    const app = await build(dir);
    writeFileSync(join(dir, "schemes.json"), json(["light"], []));
    const res = await app.fetch(new Request("http://localhost/", { headers: { cookie: "keel-theme=slate" } }));
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    expect(theme(doc)).toBe("slate");
  });
});
