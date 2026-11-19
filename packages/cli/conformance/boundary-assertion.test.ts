// Spec: k.boundary, Conformance "A page importing `./x.server.ts?raw` or `?url`, a plain file calling `loader`, or one importing `node:path` fails `vite build` with one E1007 naming the chain; `keel build` stops at `keel check`."
// Spec: k.boundary, Assertion "After bundling, a browser build fails with E1007, writes nothing for its deployable and exits 1 when its graph from any entry, dynamic imports and emitted files included, holds a server-only file (any query), a Node built-in (`node:` or a name Node lists), or a file calling `loader`, `action` or `guard` from `@keel/router`, unless the build is a `client` deployable's and the file's module one it lists. Message: `server code in browser build: <reason>: <entry> -> <a> -> <file>`, each step a project-relative path or package specifier. It holds when an import gets around the stubs."
// Spec: k.boundary, Rules "E1007 server code in a browser build (names the chain) · E1008 a stub of a server-only export called · E1009 `guard` from `@keel/router` called outside a `*.guard.*` or `*.server.*` file (fix: none)."
// Seed 1337 (no random input: each import that gets around the stubs is enumerated). `vite build` with `KEEL_DEPLOYABLE` over a temp project, as `keel build` runs it per deployable; `keel build` and `keel check` over the same files.
// Each case builds its own fixture: the node fixture of boundary-support.ts plus one change. Output is read as the build prints it; the E1007 message is `server code in browser build: <reason>: <entry> -> <a> -> <file>`.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  CANARY,
  SLOW,
  type Tree,
  cleanup,
  clientTree,
  filesUnder,
  keelRun,
  linesWith,
  materialize,
  nodeTree,
  viteBuild,
  withFiles,
} from "./boundary-support.ts";

const PAGE = nodeTree("node")["modules/a/Page.tsx"] ?? "";
/** `Page.tsx` with `imports` first and `stmt` run at its top level. */
const page = (imports: string, stmt: string): string =>
  `${imports}\n${PAGE}\nReflect.set(globalThis, 'extra', ${stmt})\n`;
const RAW_TYPES = "declare module '*?raw' {\n  const src: string\n  export default src\n}\n";
const NOTES = `export const notes = '${CANARY.notes}'\n`;

const STEPS = /server code in browser build: (server-only file|node built-in|handler): (.+)$/;
const chainOf = (line: string): string[] => (STEPS.exec(line)?.[2] ?? "").split(" -> ");

/** Builds `files` for `deployable` in a fresh project, runs `fn`, removes it. */
async function inProject<T>(files: Tree, fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = materialize(files);
  try {
    return await fn(dir);
  } finally {
    cleanup(dir);
  }
}

const withNotes = (importLine: string, use: string): Tree =>
  withFiles(nodeTree("node"), {
    "modules/a/notes.server.ts": NOTES,
    "modules/a/raw.d.ts": RAW_TYPES,
    "modules/a/Page.tsx": page(importLine, use),
  });

describe("k.boundary: a page importing a server-only file with a query fails `vite build` with one E1007 naming the chain", () => {
  for (const query of ["?raw", "?url", "?inline"]) {
    test(`\`import src from './notes.server.ts${query}'\` in \`Page.tsx\`: exit 1, one E1007 of reason \`server-only file\`, a chain ending \`modules/a/Page.tsx -> modules/a/notes.server.ts${query}\`, nothing written`, async () => {
      await inProject(withNotes(`import src from './notes.server.ts${query}'`, "src"), (dir) => {
        const r = viteBuild(dir, "api");
        expect(r.status, r.out).toBe(1);
        expect(r.out).toContain("E1007");
        const hits = linesWith(r.out, "E1007");
        expect(hits).toHaveLength(1);
        expect(hits[0]).toContain("server code in browser build: server-only file: ");
        const chain = chainOf(hits[0] ?? "");
        expect(chain.slice(-2)).toEqual(["modules/a/Page.tsx", `modules/a/notes.server.ts${query}`]);
        expect(chain.length).toBeGreaterThanOrEqual(3);
        expect(existsSync(join(dir, "dist", "api"))).toBe(false);
        expect(filesUnder(join(dir, "dist"))).toEqual([]);
      });
    });
  }

  test("a dynamic `import('./notes.server.ts?raw')` is the same E1007: dynamic imports are in the graph", async () => {
    await inProject(withNotes("", "() => import('./notes.server.ts?raw')"), (dir) => {
      const r = viteBuild(dir, "api");
      expect(r.status, r.out).toBe(1);
      const hits = linesWith(r.out, "E1007");
      expect(hits).toHaveLength(1);
      expect(chainOf(hits[0] ?? "").slice(-2)).toEqual(["modules/a/Page.tsx", "modules/a/notes.server.ts?raw"]);
    });
  });

  test("`keel build` of the `?raw` fixture stops at `keel check`: exit 1, E1004, no `dist/` and no `.keel/`", async () => {
    await inProject(withNotes("import src from './notes.server.ts?raw'", "src"), (dir) => {
      const r = keelRun(dir, ["build"]);
      expect(r.status, r.out).toBe(1);
      expect(linesWith(r.out, '"E1004"').length).toBeGreaterThan(0);
      expect(existsSync(join(dir, "dist"))).toBe(false);
      expect(existsSync(join(dir, ".keel"))).toBe(false);
    });
  });
});

describe("k.boundary: a plain file calling `loader` in a browser build is one E1007 of reason `handler`", () => {
  const plain = (): Tree =>
    withFiles(nodeTree("node"), {
      "modules/a/loadPlain.ts": `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { Out } from './Out.schema.ts'\nimport { Params } from './Params.schema.ts'\nimport { Search } from './Search.schema.ts'\nexport const loadPlain = loader({ output: Out, params: Params, search: Search }, async () => {\n  Reflect.set(globalThis, 'plainRan', '${CANARY.plain}')\n  return ok({ title: 'p' })\n})\n`,
      "modules/a/routes.ts": (nodeTree("node")["modules/a/routes.ts"] ?? "")
        .replace("import { load } from './load.server.ts'", "import { loadPlain } from './loadPlain.ts'")
        .replace("loader: load,", "loader: loadPlain,"),
    });

  test("`routes.ts` naming `loadPlain` from `loadPlain.ts`: `vite build` exits 1 with one E1007 whose chain runs through `modules/a/routes.ts` to `modules/a/loadPlain.ts`, and the canary is in no emitted file", async () => {
    await inProject(plain(), (dir) => {
      const r = viteBuild(dir, "api");
      expect(r.status, r.out).toBe(1);
      const hits = linesWith(r.out, "E1007");
      expect(hits).toHaveLength(1);
      expect(hits[0]).toContain("server code in browser build: handler: ");
      expect(chainOf(hits[0] ?? "").slice(-2)).toEqual(["modules/a/routes.ts", "modules/a/loadPlain.ts"]);
      expect(filesUnder(join(dir, "dist", "api"))).toEqual([]);
    });
  });

  test("`keel build` of the same files stops with E1551, exit 1, and writes no `dist/` and no `.keel/`", async () => {
    await inProject(plain(), (dir) => {
      const r = keelRun(dir, ["build"]);
      expect(r.status, r.out).toBe(1);
      expect(linesWith(r.out, '"E1551"').length).toBeGreaterThan(0);
      expect(existsSync(join(dir, "dist"))).toBe(false);
      expect(existsSync(join(dir, ".keel"))).toBe(false);
    });
  });
});

describe("k.boundary: a plain file calling `loader`, `action` or `guard` from `@keel/router` is the same E1007, whichever it calls", () => {
  const calls = {
    loader: "loader({ output: s.object({}) }, async () => ok({}))",
    action: "action({ input: s.object({}) }, async () => ok(null))",
    guard: "guard({ redirect: 'a.home' }, async () => ok(null))",
  } as const;
  for (const [ctor, call] of Object.entries(calls)) {
    test(`\`${ctor}\` called in \`modules/a/plain.ts\`, imported by \`Page.tsx\`, fails with reason \`handler\` and a chain ending \`modules/a/Page.tsx -> modules/a/plain.ts\``, async () => {
      const files = withFiles(nodeTree("node"), {
        "modules/a/plain.ts": `import { ${ctor} } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nexport const plain = ${call}\n`,
        "modules/a/Page.tsx": page("import { plain } from './plain.ts'", "plain"),
      });
      await inProject(files, (dir) => {
        const r = viteBuild(dir, "api");
        expect(r.status, r.out).toBe(1);
        const hits = linesWith(r.out, "E1007");
        expect(hits).toHaveLength(1);
        expect(hits[0]).toContain("server code in browser build: handler: ");
        expect(chainOf(hits[0] ?? "").slice(-2)).toEqual(["modules/a/Page.tsx", "modules/a/plain.ts"]);
      });
    });
  }
});

describe("k.boundary: a Node built-in in a browser build is one E1007 of reason `node built-in`", () => {
  for (const spec of ["node:path", "path"]) {
    test(`\`Page.tsx\` importing \`util.ts\`, which imports \`${spec}\`, fails with a chain ending \`-> modules/a/util.ts -> ${spec}\``, async () => {
      const files = withFiles(nodeTree("node"), {
        "modules/a/util.ts": `import { join } from '${spec}'\nexport const util = (a: string): string => join(a, 'b')\n`,
        "modules/a/Page.tsx": page("import { util } from './util.ts'", "util('a')"),
      });
      await inProject(files, (dir) => {
        const r = viteBuild(dir, "api");
        expect(r.status, r.out).toBe(1);
        const hits = linesWith(r.out, "E1007");
        expect(hits).toHaveLength(1);
        expect(hits[0]).toContain("server code in browser build: node built-in: ");
        expect(chainOf(hits[0] ?? "").slice(-3)).toEqual(["modules/a/Page.tsx", "modules/a/util.ts", spec]);
        expect(filesUnder(join(dir, "dist", "api"))).toEqual([]);
      });
    });
  }
});

describe("k.boundary: the assertion lets a correct project and a `client` deployable's own handlers through", () => {
  test("the unchanged `node` fixture builds with exit 0 and no E1007", async () => {
    await inProject(nodeTree("node"), (dir) => {
      const r = viteBuild(dir, "api");
      expect(r.status, r.out).toBe(0);
      expect(linesWith(r.out, "E1007")).toEqual([]);
    });
  });

  test("a plain file of a module a `client` deployable lists that calls `loader` builds with exit 0 and no E1007", async () => {
    const files = withFiles(clientTree(), {
      "modules/w/plainW.ts":
        "import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { Out } from './Out.schema.ts'\n" +
        "export const plainW = loader({ output: Out }, async () => ok({ title: 'w' }))\n",
      "modules/w/routes.ts": (clientTree()["modules/w/routes.ts"] ?? "").replace(
        "import { loadW } from './loadW.server.ts'",
        "import { plainW as loadW } from './plainW.ts'",
      ),
    });
    await inProject(files, (dir) => {
      const r = viteBuild(dir, "web");
      expect(r.status, r.out).toBe(0);
      expect(linesWith(r.out, "E1007")).toEqual([]);
    });
  });

  test("a file of a module the `client` deployable does not list that calls `loader`, reached from its page, is one E1007 of reason `handler`", async () => {
    const files = withFiles(clientTree(), {
      "modules/a/loadPlain.ts":
        "import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { Out } from './Out.schema.ts'\n" +
        "export const loadPlain = loader({ output: Out }, async () => ok({ title: 'p' }))\n",
      "modules/w/View.tsx": (clientTree()["modules/w/View.tsx"] ?? "").replace(
        "import { routes } from './routes.ts'",
        "import { routes } from './routes.ts'\nimport { loadPlain } from '../a/loadPlain.ts'\nReflect.set(globalThis, 'foreign', loadPlain)",
      ),
    });
    await inProject(files, (dir) => {
      const r = viteBuild(dir, "web");
      expect(r.status, r.out).toBe(1);
      const hits = linesWith(r.out, "E1007");
      expect(hits).toHaveLength(1);
      expect(hits[0]).toContain("server code in browser build: handler: ");
      expect(chainOf(hits[0] ?? "").slice(-2)).toEqual(["modules/w/View.tsx", "modules/a/loadPlain.ts"]);
    });
  });
});
