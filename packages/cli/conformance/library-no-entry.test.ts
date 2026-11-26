// k.library-pack, Package: "No check imports a library's entry: `keel check`, `keel build` and every path that registers a package's rules, formats and config (E1159, k.module) import a library only through its `./tools` export, when it declares one, and read its components from source. So a library, linked or installed, with no `./tools` needs no build for the app's `keel check`, `keel dev`, `keel test` or `keel build`; one with `./tools` ships that file as Node imports it (`.js` or `.mjs`, or built from `.ts`), and a declared `./tools` that does not import is E1159 `<name> ./tools <target> does not import; build it`, `<target>` as `exports` writes it (`./tools.js`)."
// k.library-pack, Package: "Whatever a library registers for the check (rules, formats, config) it registers from `./tools`."
// k.library, In an app: "`keel check` and `keel build` import only its `./tools` (k.library-pack), so its rules, formats and config register; its rule codes are held to E1753."
// Seed: 1337 (no generated input: the cases are fixtures through the real binary). Binary runs: each fixture runs `keel check` once and `keel build` once, shared by the cases that read their output;
// the fixtures: an unbuilt library (no `dist/`, no `./tools`), linked and installed; one with a defect in its source; one whose entry throws as it loads; one whose `./tools` is missing, does not import or registers a rule.
// ASSUMPTIONS (spec silent, readings asserted):
//  - "a library whose entry would throw on import" is `index.js` written to throw after it writes a marker file: the marker's absence is the proof it was never imported.
//  - A linked library is `node_modules/@acme/charts` a symbolic link to a folder beside the project (library-support.ts `linkBeside`); an installed one is the folder itself.
import { existsSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import type { Rec, Run } from "./compat-support.ts";
import {
  BADGE_PATH,
  NAME,
  SLOW,
  type Tree,
  atEntryOf,
  cleanup,
  diags,
  keel,
  library,
  linkBeside,
  materialize,
  siteTree,
  toolsRule,
} from "./library-support.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

/** `exports` of a library that is not built: `"."` names a `dist/` that does not exist. */
const UNBUILT = { ".": { keel: "./src/index.ts", types: "./dist/src/index.d.ts", default: "./dist/src/index.js" } };

type Fixture = { dir: string; tree: Tree };
/** The `site` project over `lib`, its library linked (a symbolic link to a folder beside the project) or installed. */
function fixture(lib: Tree, linked: boolean): Fixture {
  const tree = siteTree([lib]);
  const dir = realpathSync(materialize(tree));
  made.push(dir);
  if (linked) made.push(linkBeside(dir));
  return { dir, tree };
}

const clean = (r: Run): Rec[] => r.records.filter((x) => x.kind === "diag");
const shown = (r: Run): string => JSON.stringify(r.records).slice(0, 700);

const BOOM = (marker: string): string =>
  `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "imported");\nthrow new Error("the entry was imported");\n`;

for (const linked of [true, false]) {
  const how = linked ? "linked" : "installed";

  describe(`a ${how} library with no dist/ and no ./tools`, () => {
    let fx: Fixture | undefined;
    let checked: Run | undefined;
    let built: Run | undefined;
    const unbuilt = (): Fixture => {
      if (fx === undefined) fx = fixture(library({ exports: UNBUILT }), linked);
      return fx;
    };
    const check = (): Run => {
      if (checked === undefined) checked = keel(unbuilt().dir, ["check"]);
      return checked;
    };
    const build = (): Run => {
      if (built === undefined) built = keel(unbuilt().dir, ["build"]);
      return built;
    };

    test(
      `No check imports a library's entry: \`keel check\` of an app listing a ${how} library with no \`dist/\` and no \`./tools\` reports no diagnostic`,
      () => {
        expect(existsSync(join(unbuilt().dir, "node_modules", NAME, "dist"))).toBe(false);
        expect(clean(check()), shown(check())).toEqual([]);
        expect(check().status).toBe(0);
      },
      SLOW,
    );

    test(
      `So a library, linked or installed, with no \`./tools\` needs no build for the app's \`keel build\`: it exits 0 and the page holds the library's \`shop.badge.box\` (${how})`,
      () => {
        const r = build();
        expect(r.status, shown(r)).toBe(0);
        expect(readFileSync(join(unbuilt().dir, "dist/site/index.html"), "utf8")).toContain('id="shop.badge.box"');
      },
      SLOW,
    );

    test(
      `Read its components from source: a defect planted in a ${how} unbuilt library's source is one E1805 at \`node_modules/@acme/charts/src/Badge.tsx\`, from \`keel check\` and \`keel build\``,
      () => {
        const bad = fixture(
          library({
            exports: UNBUILT,
            files: { "src/Badge.tsx": "export default function Badge() {\n  return <box />\n}\n" },
          }),
          linked,
        );
        for (const args of [["check"], ["build"]]) {
          const r = keel(bad.dir, args);
          const found = diags(r, "E1805");
          expect(found.length, `${args.join(" ")} ${shown(r)}`).toBe(1);
          expect(found[0]?.path).toBe(BADGE_PATH);
          expect(r.status).toBe(1);
        }
      },
      SLOW,
    );
  });

  describe(`a ${how} library whose entry would throw on import`, () => {
    let state: { fx: Fixture; marker: string; check: Run; build: Run } | undefined;
    const boom = (): NonNullable<typeof state> => {
      if (state === undefined) {
        const marker = join(mkdtempSync(join(realpathSync(tmpdir()), "keel-entry-")), "imported");
        made.push(join(marker, ".."));
        const fx = fixture(library({ files: { "index.js": BOOM(marker) } }), linked);
        state = { fx, marker, check: keel(fx.dir, ["check"]), build: keel(fx.dir, ["build"]) };
      }
      return state;
    };

    test(
      `No check imports a library's entry: \`keel check\` of an app listing a ${how} library whose entry throws as it loads is clean, and the entry is never run`,
      () => {
        const s = boom();
        expect(clean(s.check), shown(s.check)).toEqual([]);
        expect(s.check.status).toBe(0);
        expect(existsSync(s.marker), "the entry was imported by keel check").toBe(false);
      },
      SLOW,
    );

    test(
      `No check imports a library's entry: \`keel build\` of that app exits 0 and never runs the entry`,
      () => {
        const s = boom();
        expect(s.build.status, shown(s.build)).toBe(0);
        expect(existsSync(s.marker), "the entry was imported by keel check or keel build").toBe(false);
      },
      SLOW,
    );
  });

  describe(`a ${how} library declaring ./tools`, () => {
    const at = (tree: Tree, r: Rec): boolean => r.path === "modules/shop/module.ts" && atEntryOf(tree, r, NAME);

    const targets: [string, Tree, string][] = [
      ["a target that does not exist", {}, "./tools.js"],
      ["a target that throws as it loads", { "tools.js": 'throw new Error("tools does not import");\n' }, "./tools.js"],
      ["a target that is a file not built (under dist/)", {}, "./dist/tools.js"],
    ];
    for (const [what, files, target] of targets)
      test(
        `a declared \`./tools\` that does not import is E1159 \`<name> ./tools <target> does not import; build it\`: ${what} is exactly one E1159, at the \`${NAME}\` entry, from \`keel check\` and \`keel build\``,
        () => {
          const fx = fixture(
            library({
              exports: { "./tools": { keel: "./src/tools.ts", default: target } },
              files: { "src/tools.ts": "export {}\n", ...files },
            }),
            linked,
          );
          for (const args of [["check"], ["build"]]) {
            const r = keel(fx.dir, args);
            const found = diags(r, "E1159");
            expect(
              found.map((x) => x.message),
              `${args.join(" ")} ${shown(r)}`,
            ).toEqual([`${NAME} ./tools ${target} does not import; build it`]);
            expect(found.every((x) => at(fx.tree, x))).toBe(true);
            expect(r.status).toBe(1);
          }
        },
        SLOW,
      );

    test(
      `Whatever a library registers for the check it registers from \`./tools\`: a ${how} library whose \`./tools\` registers a rule has it run on the app's files, the entry (which throws) never imported`,
      () => {
        const marker = join(mkdtempSync(join(realpathSync(tmpdir()), "keel-entry-")), "imported");
        made.push(join(marker, ".."));
        const fx = fixture(
          library({
            exports: { "./tools": { keel: "./src/tools.ts", default: "./tools.js" } },
            files: { "src/tools.ts": "export {}\n", "tools.js": toolsRule("E2999"), "index.js": BOOM(marker) },
          }),
          linked,
        );
        const r = keel(fx.dir, ["check"]);
        const found = diags(r, "E2999");
        expect(found.length, shown(r)).toBeGreaterThan(0);
        expect(found.map((x) => x.path)).toContain("modules/shop/Home.tsx");
        expect(existsSync(marker), "the entry was imported").toBe(false);
        expect(diags(r, "E1159")).toEqual([]);
      },
      SLOW,
    );
  });
}

const ENV = ["// @vitest", "environment happy-dom"].join("-");
const TEST = `${ENV}
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { expect, it } from "vitest";
import Wrap from "../modules/shop/Wrap.tsx";

it("finds shop.wrap.box", () => {
  const t = render(Object.assign(Wrap, { Props: s.object({}) }), { props: {}, ctx: createCtx({ mode: "sim", seed: 1337 }) });
  expect(t.find("shop.wrap.box").id).toBe("shop.wrap.box");
  t.dispose();
});
`;

describe("keel test needs no build of a library with no ./tools", () => {
  test(
    "So a library, linked or installed, with no `./tools` needs no build for the app's `keel test`: a test rendering its `Badge` passes with no `dist/`",
    () => {
      const tree = {
        ...siteTree([library({ exports: UNBUILT })]),
        "modules/shop/Wrap.tsx":
          "import { Badge } from '@acme/charts'\nexport default function Wrap() {\n  return <Badge id=\"shop.wrap\" />\n}\n",
        "test/badge.test.ts": TEST,
      };
      const dir = materialize(tree);
      made.push(dir);
      const r = keel(dir, ["test"]);
      expect(r.records.find((x) => x.kind === "summary")?.ok, shown(r)).toBe(true);
      expect(r.status).toBe(0);
    },
    SLOW,
  );
});
