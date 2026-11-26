// k.library In an app, the clause on the `.keel/` artifacts, quoted whole
// In an app (compiler): "The compiler resolves imports with the `keel` condition on every surface (dev, build, test) and transforms a library's files as the app's, read at `modules/<id>/<f>`: JSX, element ids, and style props into the app's CSS file against the app's `tokens.ts`; the `.keel/` artifacts derive from a library's files at those paths as from the app's, and E1005 compares them over the same files, so a reader of an artifact (E1702, the inspector) judges a library's element as an app's. A linked library's imports resolve from its real folder, as Node's do, so the kernel packages it imports must resolve there to the app's (one workspace install)."
// Spec: k.library, clause "In that project, with the app's `tokens.ts` and a `static` deployable `site` whose `/` page renders `<Badge id=\"shop.badge\" />`, `keel build`'s `dist/site/index.html` holds an element with id `shop.badge.box`, and a `.css` file under `dist/site/` holds the atomic rule of `p=\"2\"`, which the same build without `p=\"2\"` in the library lacks."
// The project is the second clause's
// Spec: k.compiler, clause "Changing any byte of a file under `.keel/` makes `keel check --frozen` report E1005 on that file."
// k.compiler Artifacts: "Derived files (k.derived), written to `.keel/` as views"; the checks run frozen (`keel check --frozen`), the mode in which a differing view is E1005.
// Seed: 1337 (no generated input). Binary runs: 6 (`keel build`, `keel check`, a library file changed, `keel check`; the app-module control: the same three on its own project).
// ASSUMPTIONS (spec silent): "the library's style" is a usage of `p: "2"` in `.keel/styles.json` (the artifact `keel build` writes for style props; the file is named by no spec section), `keel check` reports E1005 at a path
// under `.keel/` and names that file; the change is `p="2"` to `p="1"` in the library's `src/Badge.tsx`, which changes what the build writes. The control moves the same element into the app module `shop`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  BADGE_PATH,
  type Rec,
  SLOW,
  cleanup,
  diags,
  keel,
  library,
  materialize,
  siteTree,
  write,
} from "./library-support.ts";

const stylesOf = (dir: string): unknown => {
  const v: unknown = JSON.parse(readFileSync(join(dir, ".keel/styles.json"), "utf8"));
  return v;
};
const usesP = (styles: unknown, p: string): boolean => {
  if (typeof styles !== "object" || styles === null || !("data" in styles)) return false;
  return JSON.stringify(styles.data).includes(`"p":"${p}"`);
};

let dir = "";
let control = "";
let build: { status: number | null } | undefined;
let clean: Rec[] = [];
let styles: unknown;
let changed: Rec[] = [];
let controlChanged: Rec[] = [];
let controlClean: Rec[] = [];
beforeAll(() => {
  dir = materialize(siteTree());
  build = keel(dir, ["build"]);
  clean = keel(dir, ["check", "--frozen"]).records.filter((x) => x.kind === "diag");
  styles = stylesOf(dir);
  write(dir, { [BADGE_PATH]: readFileSync(join(dir, BADGE_PATH), "utf8").replace('p="2"', 'p="1"') });
  changed = keel(dir, ["check", "--frozen"]).records.filter((x) => x.kind === "diag");

  control = materialize({
    ...siteTree([
      library({
        files: {
          "src/Badge.tsx":
            "import { Box } from '@keel/ui'\nexport default function Badge(props: { id: string }) {\n  return <Box id={`${props.id}.box`} />\n}\n",
        },
      }),
    ]),
    "modules/shop/Own.tsx":
      'import { Box } from \'@keel/ui\'\nexport default function Own() {\n  return <Box id="shop.own" p="2" />\n}\n',
  });
  keel(control, ["build"]);
  controlClean = keel(control, ["check", "--frozen"]).records.filter((x) => x.kind === "diag");
  write(control, {
    "modules/shop/Own.tsx":
      'import { Box } from \'@keel/ui\'\nexport default function Own() {\n  return <Box id="shop.own" p="1" />\n}\n',
  });
  controlChanged = keel(control, ["check", "--frozen"]).records.filter((x) => x.kind === "diag");
}, SLOW);
afterAll(() => {
  cleanup(dir);
  cleanup(control);
});

test(
  "In that project, `keel check` after `keel build` reports no E1005",
  () => {
    expect(build?.status).toBe(0);
    expect(clean.filter((x) => x.code === "E1005")).toEqual([]);
    expect(clean).toEqual([]);
  },
  SLOW,
);

test(
  "In that project, the `.keel/` artifacts `keel build` writes derive from the library's files: `styles.json` holds the library's `p=\"2\"`",
  () => {
    expect(usesP(styles, "2")).toBe(true);
  },
  SLOW,
);

test(
  "In that project, changing a library file after the build and running `keel check` reports E1005 on the artifact derived from it",
  () => {
    const hits = changed.filter((x) => x.code === "E1005");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.map((x) => x.path)).toContain(".keel/styles.json");
  },
  SLOW,
);

test(
  "In that project, an app module's file changed in the same way after the build reports E1005 on the same artifact (the control: a library's file is read as an app's)",
  () => {
    expect(controlClean.filter((x) => x.code === "E1005")).toEqual([]);
    expect(diags({ status: 1, records: controlChanged }, "E1005").map((x) => x.path)).toContain(".keel/styles.json");
  },
  SLOW,
);
