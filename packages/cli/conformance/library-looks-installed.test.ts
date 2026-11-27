// Spec: k.looks, clause "In the fixed project, a test under `test/` that renders with `render` (k.testing) an app component rendering `<Badge id=\"shop.b\" />` finds `shop.b.text` under `keel test`, and the stylesheet `keel dev` serves for `/` declares `--k-color-acme-accent:#0B5CAD`."
// k.looks, Shipped tokens: "`keel check`, `keel build`, `keel dev` and `keel test` evaluate it this one way, the library linked or installed" (a library installed from a packed tarball: its `./tokens` entry's `keel` target is a `.ts` source under `node_modules`, which Node does not strip types from).
// Seed: 1337 (no generated input: one fixture, one `keel test` and one `keel dev` on a free port from a closed port-0 listener, never 8080, 5173, 5214 or 5432; the child's group ended in `finally`).
// How the fixture is installed: the library is written as a folder, packed by `pnpm pack` into a tarball, and the tarball is unpacked as REAL FILES under `<app>/node_modules/.keel-store/@acme+ui/node_modules/@acme/ui` (a package manager's isolated layout, library-support.ts `installTarball`);
// the app's `node_modules/@acme/ui` is a link to that folder, so the library's real path lies under a `node_modules` folder and is no workspace folder. Each case first asserts that real path and that its `src/acmeTokens.ts` is a regular file, not a link.
// ASSUMPTIONS (spec silent): the "fixed project" is k.looks' Conformance fixture (module `acme`, `acmeTokens` shipping `acme.accent` `#0B5CAD`) in an app whose `static` deployable `site` serves `/`, with `tokens.ts` composing the shipped object as E1810's fix writes it;
// the test builds `render`'s component by giving `modules/shop/Wrap.tsx`'s default export a `Props` (`s.object({})`), on a sim ctx; "the stylesheet `keel dev` serves for `/`" is every `<link rel="stylesheet">` of the document at `/`, fetched from the same port.
import { lstatSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, afterEach, expect, test } from "vitest";
import {
  LEDGER,
  type Tree,
  cleanup,
  installTarball,
  keel,
  manifestOf,
  materialize,
  packTarball,
  project,
  write,
} from "./library-support.ts";
import { SLOW, freePort, get, served, startDev, stop, stopAll, stylesheetsOf } from "./static-support.ts";

const NAME = "@acme/ui";
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
afterEach(async () => {
  await stopAll();
});

// The joined environment line keeps vitest from reading it as this file's own.
const ENV = ["// @vitest", "environment happy-dom"].join("-");
const TEST = `${ENV}
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { expect, it } from "vitest";
import Wrap from "../modules/shop/Wrap.tsx";

it("finds shop.b.text", () => {
  const t = render(Object.assign(Wrap, { Props: s.object({}) }), { props: {}, ctx: createCtx({ mode: "sim", seed: 1337 }) });
  expect(t.find("shop.b.text").id).toBe("shop.b.text");
  t.dispose();
});
`;
const BADGE_USE = (fn: string): string =>
  `import { Badge } from '${NAME}'\nexport default function ${fn}() {\n  return <Badge id="shop.b" />\n}\n`;
const APP_TOKENS =
  'import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "@acme/ui/tokens";\n\nexport const tokens = defineTokens({ ...brandTokens, color: { ...brandTokens.color, ...acmeTokens.color }, look: { ...brandTokens.look, ...acmeTokens.look } });\n';

/** The files of k.looks' fixture library, relative to its package folder. */
const libraryFiles = (): Tree => ({
  "package.json": `${JSON.stringify({
    name: NAME,
    version: "1.0.0",
    type: "module",
    keel: "library",
    exports: {
      ".": { keel: "./src/index.ts", default: "./index.js" },
      "./tokens": { keel: "./src/acmeTokens.ts", default: "./index.js" },
    },
  })}\n`,
  "index.js": "export {}\n",
  "module.ts": manifestOf("acme", [], ["Badge"]),
  "src/index.ts": "export { default as Badge } from './Badge.tsx'\n",
  "src/Badge.tsx":
    "import { Text } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return <Text id={`${props.id}.text`} look=\"acme.badge\">x</Text> }\n",
  "src/acmeTokens.ts":
    "import { defineTokens } from '@keel/ui'\nexport const acmeTokens = defineTokens({ color: { 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF' }, look: { 'acme.badge': { bg: 'acme.accent', fg: 'acme.ink' } } })\n",
  ".keel/ledger.json": LEDGER,
});

/** An app that lists the library, with the library packed into a tarball and installed as real files in its `node_modules` store. */
function installedApp(): { app: string; real: string } {
  const lib = mkdtempSync(join(realpathSync(tmpdir()), "keel-looks-lib-"));
  made.push(lib);
  write(lib, libraryFiles());
  const t = packTarball(lib, true);
  expect(t.status, t.output.slice(-800)).toBe(0);
  const out = t.tgz === undefined ? "" : t.tgz;
  expect(out).not.toBe("");
  made.push(join(out, ".."));
  const tree: Tree = {
    ...project({ adapter: "static", page: false, deps: [NAME], libraries: [] }),
    "tokens.ts": APP_TOKENS,
    "modules/shop/Home.tsx": `import { Box } from '@keel/ui'\nimport { Badge } from '${NAME}'\nexport default function Home() {\n  return (\n    <Box as="main">\n      <Badge id="shop.b" />\n    </Box>\n  )\n}\n`,
    "modules/shop/Wrap.tsx": BADGE_USE("Wrap"),
    "test/badge.test.ts": TEST,
  };
  const app = realpathSync(materialize(tree));
  made.push(app);
  const real = installTarball(app, out, NAME);
  return { app, real };
}

/** The fixture is installed, not linked into a workspace: the real path is under a `node_modules` folder and the library's files are regular files. */
function expectInstalled(app: string, real: string): void {
  expect(realpathSync(join(app, "node_modules", NAME))).toBe(realpathSync(real));
  expect(real.split("/")).toContain("node_modules");
  expect(real.startsWith(`${app}/node_modules/`)).toBe(true);
  for (const f of ["package.json", "src/acmeTokens.ts", "src/Badge.tsx"]) {
    const st = lstatSync(join(real, f));
    expect(st.isFile() && !st.isSymbolicLink(), f).toBe(true);
  }
}

test(
  'In the fixed project, a test under `test/` that renders with `render` (k.testing) an app component rendering `<Badge id="shop.b" />` finds `shop.b.text` under `keel test`, with the library installed from a packed tarball',
  () => {
    const { app, real } = installedApp();
    expectInstalled(app, real);
    const r = keel(app, ["test"]);
    const summary = r.records.find((x) => x.kind === "summary");
    expect(
      r.records.filter((x) => x.kind === "diag" && x.code === "E1807"),
      "no E1807: the shipped tokens are evaluated as a module made from the literal",
    ).toEqual([]);
    expect(summary?.ok, JSON.stringify(r.records).slice(0, 900)).toBe(true);
    expect(r.status).toBe(0);
  },
  fixedTime(SLOW),
);

test(
  "In the fixed project, the stylesheet `keel dev` serves for `/` declares `--k-color-acme-accent:#0B5CAD`, with the library installed from a packed tarball",
  async () => {
    const { app, real } = installedApp();
    expectInstalled(app, real);
    const port = await freePort();
    const p = startDev(app, port);
    try {
      expect(await served(p, port), p.out()).toBe(true);
      const doc = await get(port, "/");
      expect(doc?.status).toBe(200);
      const hrefs = stylesheetsOf(doc?.body ?? "");
      expect(hrefs.length, doc?.body.slice(0, 600)).toBeGreaterThan(0);
      const sheets = await Promise.all(hrefs.map((h) => get(port, h)));
      const css = sheets.map((s) => s?.body ?? "").join("\n");
      expect(css, p.out().slice(-600)).toContain("--k-color-acme-accent:#0B5CAD");
    } finally {
      await stop(p);
    }
  },
  fixedTime(SLOW),
);
