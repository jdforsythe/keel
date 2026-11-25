// Seed 1337 (no generated input: three fixed fixtures). k.library-pack Package: no check imports a library's entry; a
// library is imported only through its `./tools` export, when it declares one. A linked library with no `dist/` and no
// `./tools` checks and builds clean and its source is judged; a declared `./tools` that does not import is E1159
// naming it; an entry that throws on import is never run.
import { afterAll, expect, test } from "vitest";
import {
  LIB,
  NAME,
  SLOW,
  type Tree,
  cleanup,
  diags,
  keel,
  library,
  linkBeside,
  materialize,
  siteTree,
} from "../conformance/library-support.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

/** The `site` project with the library's tree changed by `edit` (a path set to null is removed). */
function app(edit: Record<string, string | null>, linked = false): string {
  const tree: Tree = { ...siteTree() };
  for (const [rel, text] of Object.entries(edit)) {
    const at = `${LIB}/${rel}`;
    if (text === null) delete tree[at];
    else tree[at] = text;
  }
  const dir = materialize(tree);
  made.push(dir);
  if (linked) made.push(linkBeside(dir));
  return dir;
}

const PKG = (exports: Record<string, unknown>): string =>
  JSON.stringify({ name: NAME, version: "1.0.0", type: "module", keel: "library", exports });

test(
  "a linked library with no built entry and no ./tools: keel check and keel build are clean, and its source is judged",
  () => {
    const noDist = {
      "package.json": PKG({ ".": { keel: "./src/index.ts", default: "./dist/src/index.js" } }),
      "index.js": null,
    };
    const dir = app(noDist, true);
    const c = keel(dir, ["check"]);
    expect(
      c.records.filter((r) => r.kind === "diag"),
      JSON.stringify(c.records).slice(0, 600),
    ).toEqual([]);
    expect(keel(dir, ["build"]).status).toBe(0);
    const cast = app(
      {
        ...noDist,
        "src/Badge.tsx":
          "import { Box } from '@keel/ui'\nexport default function Badge(props: { id: string }) {\n  return <Box id={`${props.id}.box`} p={'2' as '2'} />\n}\n",
      },
      true,
    );
    const found = diags(keel(cast, ["check"]), "E1757");
    expect(found.map((d) => d.path)).toEqual([`${LIB}/src/Badge.tsx`]);
  },
  SLOW,
);

test(
  "a declared ./tools that does not import is one E1159 naming the tools file",
  () => {
    const dir = app({
      "package.json": PKG({ ".": { keel: "./src/index.ts", default: "./index.js" }, "./tools": "./dist/tools.js" }),
    });
    const found = diags(keel(dir, ["check"]), "E1159");
    expect(found.map((d) => d.message)).toEqual([`${NAME} ./tools ./dist/tools.js does not import; build it`]);
  },
  SLOW,
);

test(
  "an entry that throws on import is never run by the check",
  () => {
    const dir = app({ "index.js": "throw new Error('the check ran the entry')\n" });
    const c = keel(dir, ["check"]);
    expect(
      c.records.filter((r) => r.kind === "diag"),
      JSON.stringify(c.records).slice(0, 600),
    ).toEqual([]);
    expect(c.status).toBe(0);
  },
  SLOW,
);
