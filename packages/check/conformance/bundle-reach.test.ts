// Spec: k.bundle, clause "In a `node` fixture whose `lib/notes.server.ts` holds a canary and `lib/w.ts` imports it: a page starting `new Worker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })`, and one importing `../../lib/w.ts?worker`, ship no canary under `dist/<name>/`; `keel check` reports E1004 at `lib/w.ts` naming the chain; a worker importing `notes.server.ts?raw` fails `vite build` with one E1007 whose chain runs through the worker."
// k.bundle, Bundles "Reach (E1004 and E1571) follows `new URL(<literal>, import.meta.url)` and `?worker`, `?sharedworker` and `?url` specifiers as it follows a literal `import()`; a worker file a client entry reaches is a client entry."
// Spec: k.bundle, clause "`keys.server.json` and `copy.server.txt?raw` imported by a page fail `vite build` with one E1007 `server-only file` each, and are E1004 in `keel check`; a file on disk `Notes.SERVER.ts` is stubbed."
// Spec: k.bundle, clause "An import `./notes.Server.ts` of `notes.server.ts` is one E1010 in `keel check`, and on a case-insensitive file system `vite build` ships no canary."
// k.bundle, Rules "E1010 a specifier naming a file in a case other than its name on disk (fix: the name on disk) · E1007 reasons `environment config` and `environment value`, beside k.boundary's."
// Seed 1337 (the properties below). `check` over in-memory project trees (the type pass is off: the rules read syntax and the topology). The build halves of these clauses are in packages/cli/conformance/bundle-*.test.ts.
// Node `api` lists module `a`, `client` `web` lists module `w`. E1004's message is `client code reaches server-only (<chain>)`, a chain past 89 units elided as in k.boundary E1004's message. The E1010 tests need no real disk: the in-memory file list holds the name on disk, so they hold on any file system.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CONTRACT_A, ROUTES_A, diagsOf, file, nodeA, pageOf } from "./boundary-support.ts";
import { SEED } from "./support.ts";

const NOTES = file("lib/notes.server.ts", "export const notes = 'k'\n");
const W = file("lib/w.ts", "import { notes } from './notes.server.ts'\nself.postMessage(notes)\n");
const page = (stmt: string, imports = "") =>
  pageOf(imports, `export const start = () => ${stmt}\nexport default function Page() {\n  return null\n}\n`);

const e1004 = (files: Parameters<typeof diagsOf>[0]) => diagsOf(files, "E1004");

describe("k.bundle Bundles: reach follows a worker the way it follows a literal `import()`", () => {
  const starts: readonly (readonly [string, string, string])[] = [
    [
      "`new Worker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })`",
      "new Worker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })",
      "",
    ],
    [
      "`new SharedWorker(new URL('../../lib/w.ts', import.meta.url))`",
      "new SharedWorker(new URL('../../lib/w.ts', import.meta.url))",
      "",
    ],
    ["`import W from '../../lib/w.ts?worker'`", "new W()", "import W from '../../lib/w.ts?worker'\n"],
    ["`import W from '../../lib/w.ts?sharedworker'`", "new W()", "import W from '../../lib/w.ts?sharedworker'\n"],
    ["`import('../../lib/w.ts?worker')`", "import('../../lib/w.ts?worker')", ""],
  ];
  for (const [name, stmt, imports] of starts) {
    test(`${name} in \`Page.tsx\` makes \`lib/w.ts\` a client entry: one E1004 at \`lib/w.ts\` ending \`(modules/a/Page.tsx -> lib/w.ts -> lib/notes.server.ts)\``, () => {
      const d = e1004(nodeA([ROUTES_A, CONTRACT_A, page(stmt, imports), W, NOTES]));
      expect(d).toHaveLength(1);
      expect(d[0]?.path).toBe("lib/w.ts");
      expect(d[0]?.message.endsWith("(modules/a/Page.tsx -> lib/w.ts -> lib/notes.server.ts)")).toBe(true);
    });
  }

  test("a worker reached through a plain file is the same E1004: `Page.tsx` -> `lib/start.ts` -> `lib/w.ts` -> `lib/notes.server.ts`, its four-file chain past 89 units shown as `(modules/a/Page.tsx -> ... -> lib/notes.server.ts)`", () => {
    const start = file("lib/start.ts", "export const start = () => new Worker(new URL('./w.ts', import.meta.url))\n");
    const d = e1004(
      nodeA([
        ROUTES_A,
        CONTRACT_A,
        pageOf("import { start } from '../../lib/start.ts'\n", "export default () => start()\n"),
        start,
        W,
        NOTES,
      ]),
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("lib/w.ts");
    expect(d[0]?.message).toBe("client code reaches server-only (modules/a/Page.tsx -> ... -> lib/notes.server.ts)");
  });

  test("`new URL('../../lib/keys.server.ts', import.meta.url)` in `Page.tsx` names its file: one E1004 at `Page.tsx`", () => {
    const d = e1004(
      nodeA([
        ROUTES_A,
        CONTRACT_A,
        page("new URL('../../lib/keys.server.ts', import.meta.url)"),
        file("lib/keys.server.ts", "export const k = 1\n"),
      ]),
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/a/Page.tsx");
  });

  test("a worker no client entry names is no E1004: `lib/w.ts` reached by nothing", () => {
    expect(e1004(nodeA([ROUTES_A, CONTRACT_A, pageOf(""), W, NOTES]))).toEqual([]);
  });

  test("a worker that imports only plain files is no E1004", () => {
    const plain = file("lib/w.ts", "import { x } from './x.ts'\nself.postMessage(x)\n");
    const files = nodeA([
      ROUTES_A,
      CONTRACT_A,
      page("new Worker(new URL('../../lib/w.ts', import.meta.url))"),
      plain,
      file("lib/x.ts", "export const x = 1\n"),
    ]);
    expect(e1004(files)).toEqual([]);
  });
});

describe("k.bundle Names: a server-only file of any extension, named from client-reachable code, is E1004", () => {
  const kinds: readonly (readonly [string, string, string])[] = [
    ["lib/keys.server.json", "import keys from '../../lib/keys.server.json'\n", "keys"],
    ["lib/copy.server.txt", "import copy from '../../lib/copy.server.txt?raw'\n", "copy"],
    ["lib/notes.server.md", "import md from '../../lib/notes.server.md?raw'\n", "md"],
    ["lib/logo.guard.svg", "import logo from '../../lib/logo.guard.svg?url'\n", "logo"],
    ["lib/theme.server.css", "import '../../lib/theme.server.css'\n", "0"],
  ];
  for (const [path, imports, use] of kinds) {
    test(`\`${path}\` imported by \`Page.tsx\` is one E1004 at \`modules/a/Page.tsx\` ending \`(modules/a/Page.tsx -> ${path})\``, () => {
      const d = e1004(
        nodeA([
          ROUTES_A,
          CONTRACT_A,
          pageOf(imports, `export default function Page() {\n  return ${use}\n}\n`),
          file(path, "x\n"),
        ]),
      );
      expect(d).toHaveLength(1);
      expect(d[0]?.path).toBe("modules/a/Page.tsx");
      expect(d[0]?.message.endsWith(`(modules/a/Page.tsx -> ${path})`)).toBe(true);
    });
  }

  test("`Notes.SERVER.ts` on disk, imported by `Page.tsx` under that name, is one E1004: the name test is case-insensitive", () => {
    const d = e1004(
      nodeA([
        ROUTES_A,
        CONTRACT_A,
        pageOf("import { n } from '../../lib/Notes.SERVER.ts'\n", "export default function Page() {\n  return n\n}\n"),
        file("lib/Notes.SERVER.ts", "export const n = 1\n"),
      ]),
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/a/Page.tsx");
  });

  test("a non-JS server-only file imported by `routes.ts` is none: `routes.ts` may import server-only files", () => {
    const routes = file(
      "modules/a/routes.ts",
      "import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nimport keys from '../../lib/keys.server.json'\nimport Page from './Page.tsx'\nReflect.set(globalThis, 'k', keys)\nexport const routes = manifest(a, { 'a.show': { component: Page } })\n",
    );
    expect(e1004(nodeA([routes, CONTRACT_A, pageOf(""), file("lib/keys.server.json", "{}\n")]))).toEqual([]);
  });
});

describe("k.bundle Rules: E1010 a specifier naming a file in a case other than its name on disk", () => {
  const files = (specifier: string) =>
    nodeA([
      file(
        "modules/a/routes.ts",
        `import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nimport { notes } from '${specifier}'\nimport Page from './Page.tsx'\nReflect.set(globalThis, 'n', notes)\nexport const routes = manifest(a, { 'a.show': { component: Page } })\n`,
      ),
      CONTRACT_A,
      pageOf(""),
      file("modules/a/notes.server.ts", "export const notes = 'k'\n"),
    ]);

  test("`./notes.Server.ts` of `notes.server.ts` is one E1010 at `modules/a/routes.ts`", () => {
    const d = diagsOf(files("./notes.Server.ts"), "E1010");
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/a/routes.ts");
    expect(d[0]?.message).toContain("notes.server.ts");
  });

  test("`./notes.server.ts`, the name on disk, is no E1010", () => {
    expect(diagsOf(files("./notes.server.ts"), "E1010")).toEqual([]);
  });

  test("property: a specifier of `lib/notes.server.ts` with any characters' case changed, and not the name on disk, is exactly one E1010; the name on disk is none", () => {
    const disk = "lib/notes.server.ts";
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: disk.length, maxLength: disk.length }), (mask) => {
        const spelled = [...disk].map((c, i) => (mask[i] === true ? c.toUpperCase() : c)).join("");
        const sources = [
          file("lib/notes.server.ts", "export const notes = 'k'\n"),
          file(
            "modules/a/routes.ts",
            `import { notes } from '../../${spelled}'\nReflect.set(globalThis, 'n', notes)\nexport const routes = 1\n`,
          ),
        ];
        const d = diagsOf(nodeA(sources), "E1010");
        expect(d).toHaveLength(spelled === disk ? 0 : 1);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("property: a miscased specifier of a plain, not server-only, file is E1010 too", () => {
    const disk = "lib/fmt.ts";
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: disk.length, maxLength: disk.length }), (mask) => {
        const spelled = [...disk].map((c, i) => (mask[i] === true ? c.toUpperCase() : c)).join("");
        const sources = [
          file("lib/fmt.ts", "export const fmt = 1\n"),
          pageOf(`import { fmt } from '../../${spelled}'\n`, "export default function Page() {\n  return fmt\n}\n"),
          ROUTES_A,
          CONTRACT_A,
        ];
        expect(diagsOf(nodeA(sources), "E1010")).toHaveLength(spelled === disk ? 0 : 1);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});
