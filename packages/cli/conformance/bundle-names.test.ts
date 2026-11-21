// Spec: k.bundle, Conformance "`keys.server.json` and `copy.server.txt?raw` imported by a page fail `vite build` with one E1007 `server-only file` each, and are E1004 in `keel check`; a file on disk `Notes.SERVER.ts` is stubbed."
// Spec: k.bundle, Conformance "An import `./notes.Server.ts` of `notes.server.ts` is one E1010 in `keel check`, and on a case-insensitive file system `vite build` ships no canary."
// Spec: k.bundle, Names "A file is server-only by its name on disk, matched case-insensitively, whatever its extension: `notes.Server.ts`, `keys.server.json`, `copy.server.txt`, `logo.guard.svg`."
// Spec: k.bundle, Names "A server-only file named `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts` or `.cts` gets a stub. Any other (data, styles, text, an image) gets none: in a browser build's graph, with or without a query, it fails the build with E1007 reason `server-only file`; named from client-reachable code it is E1004."
// Spec: k.bundle, Names "A specifier whose path differs in case from the file's name on disk is E1010, in `keel check` and in every build, on any file system."
// Seed 1337 (no random input: each non-JS file kind is enumerated). `vite build` with `KEEL_DEPLOYABLE=api` over a temp project and the real `keel check`.
// Case: the real binary's `keel check` reports E1010 on every file system (it compares the specifier with the names it lists). The build half depends on the disk. The test reads whether the temp project's file system folds case (does `notes.Server.ts` open?). On a folding disk (macOS) the build resolves the specifier, so it must report E1010 and ship no canary. On a case-sensitive disk (Linux CI) the specifier does not resolve, so the build must fail and ship no canary; E1010 is then not asserted of the build. Both branches assert exit 1 and no canary, which holds on either disk.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { filesHolding, filesUnder, keelRun, linesWith, viteBuild } from "./boundary-support.ts";
import {
  ALIVE,
  CANARY_COPY,
  CANARY_KEYS,
  CANARY_NOTES,
  ROUTES,
  bare,
  chainOf,
  inProject,
  nodeWith,
  page,
  reasonOf,
} from "./bundle-support.ts";

const TSCONFIG_JSON = JSON.stringify({
  compilerOptions: {
    jsx: "react-jsx",
    jsxImportSource: "@keel/runtime-dom",
    module: "esnext",
    moduleResolution: "bundler",
    target: "es2022",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
  },
});

const keysOf = <T extends object>(o: T): (keyof T)[] => {
  const out: (keyof T)[] = [];
  for (const k in o) out.push(k);
  return out;
};
const KINDS = {
  "keys.server.json": {
    file: "lib/keys.server.json",
    body: `{ "key": "${CANARY_KEYS}" }\n`,
    imports: "import keys from '../../lib/keys.server.json'",
    stmt: "keys",
    step: "lib/keys.server.json",
    canary: CANARY_KEYS,
  },
  "copy.server.txt?raw": {
    file: "lib/copy.server.txt",
    body: `${CANARY_COPY}\n`,
    imports: "import copy from '../../lib/copy.server.txt?raw'",
    stmt: "copy",
    step: "lib/copy.server.txt?raw",
    canary: CANARY_COPY,
  },
  "notes.server.md?raw": {
    file: "lib/notes.server.md",
    body: `# ${CANARY_COPY}\n`,
    imports: "import md from '../../lib/notes.server.md?raw'",
    stmt: "md",
    step: "lib/notes.server.md?raw",
    canary: CANARY_COPY,
  },
  "table.server.csv?raw": {
    file: "lib/table.server.csv",
    body: `k\n${CANARY_COPY}\n`,
    imports: "import csv from '../../lib/table.server.csv?raw'",
    stmt: "csv",
    step: "lib/table.server.csv?raw",
    canary: CANARY_COPY,
  },
  "logo.guard.svg?url": {
    file: "lib/logo.guard.svg",
    body: `<svg xmlns="http://www.w3.org/2000/svg"><desc>${CANARY_COPY}</desc></svg>\n`,
    imports: "import logo from '../../lib/logo.guard.svg?url'",
    stmt: "logo",
    step: "lib/logo.guard.svg?url",
    canary: CANARY_COPY,
  },
} as const;
type Kind = keyof typeof KINDS;
const kinds = keysOf(KINDS);

const withKind = (k: Kind) =>
  nodeWith({
    [KINDS[k].file]: KINDS[k].body,
    "tsconfig.json": TSCONFIG_JSON,
    "modules/a/Page.tsx": page(KINDS[k].imports, KINDS[k].stmt),
  });

describe("k.bundle: a non-JS server-only file a page imports fails the build and is E1004 in `keel check`", () => {
  for (const k of kinds) {
    test(`\`${k}\` imported by \`Page.tsx\`: \`vite build\` exits 1 with one E1007 \`server-only file\` whose chain ends \`modules/a/Page.tsx -> ${KINDS[k].step}\`, and nothing is written`, async () => {
      await inProject(withKind(k), (dir) => {
        const r = viteBuild(dir, "api");
        expect(r.status, r.out).toBe(1);
        const hits = linesWith(r.out, "E1007");
        expect(hits, r.out).toHaveLength(1);
        expect(reasonOf(hits[0] ?? "")).toBe("server-only file");
        expect(chainOf(hits[0] ?? "").slice(-2)).toEqual(["modules/a/Page.tsx", KINDS[k].step]);
        expect(existsSync(join(dir, "dist", "api"))).toBe(false);
        expect(filesUnder(join(dir, "dist"))).toEqual([]);
      });
    });

    test(`\`keel check\` of the \`${k}\` fixture reports E1004 at \`modules/a/Page.tsx\` naming \`${KINDS[k].file}\``, async () => {
      await inProject(withKind(k), (dir) => {
        const r = keelRun(dir, ["check"]);
        expect(r.status, r.out).toBe(1);
        const hits = linesWith(r.out, '"E1004"').filter((l) => l.includes(KINDS[k].file));
        expect(hits.length, r.out).toBeGreaterThan(0);
        expect(hits.join("\n")).toContain("modules/a/Page.tsx");
      });
    });
  }
});

describe("k.bundle: a server-only file is known by its name on disk, whatever the case", () => {
  const upper = () =>
    nodeWith({
      "lib/Notes.SERVER.ts": `export const notes = '${CANARY_NOTES}'\n`,
      "modules/a/Page.tsx": `${page("import { notes } from '../../lib/Notes.SERVER.ts'", "notes")}Reflect.set(globalThis, 'alive', '${ALIVE}')\n`,
      "modules/a/routes.ts": ROUTES,
    });

  test("a file on disk `Notes.SERVER.ts`, imported by a page component under that name, is stubbed: the build exits 0, its canary is in no file under `dist/api/assets` and the page code is", async () => {
    await inProject(upper(), (dir) => {
      const r = viteBuild(dir, "api");
      expect(r.status, r.out).toBe(0);
      expect(linesWith(r.out, "E1007")).toEqual([]);
      expect(filesHolding(join(dir, "dist", "api", "assets"), ALIVE)).not.toEqual([]);
      expect(filesHolding(join(dir, "dist", "api", "assets"), CANARY_NOTES)).toEqual([]);
    });
  });

  test("a `Notes.SERVER.ts` that a page imports is E1004 in `keel check`; `vite build` exits 0 and its canary is in no browser asset under `dist/api/assets`", async () => {
    const files = {
      ...upper(),
      "modules/a/Page.tsx": page("import { notes } from '../../lib/Notes.SERVER.ts'", "notes"),
    };
    await inProject(files, (dir) => {
      const c = keelRun(dir, ["check"]);
      expect(c.status, c.out).toBe(1);
      expect(linesWith(c.out, '"E1004"').length).toBeGreaterThan(0);
      const b = viteBuild(dir, "api");
      expect(b.status, b.out).toBe(0);
      expect(linesWith(b.out, "E1007")).toEqual([]);
      expect(filesHolding(join(dir, "dist", "api", "assets"), CANARY_NOTES)).toEqual([]);
    });
  });
});

describe("k.bundle: a specifier that differs in case from the file's name on disk is one E1010", () => {
  const miscased = () =>
    nodeWith({
      "modules/a/notes.server.ts": `export const notes = '${CANARY_NOTES}'\n`,
      "modules/a/routes.ts": `import { notes } from './notes.Server.ts'\nReflect.set(globalThis, 'notes', notes)\n${ROUTES}`,
    });

  test("`routes.ts` importing `./notes.Server.ts` of `notes.server.ts`: `keel check` exits 1 with one E1010 at `modules/a/routes.ts`", async () => {
    await inProject(miscased(), (dir) => {
      const r = keelRun(dir, ["check"]);
      expect(r.status, r.out).toBe(1);
      const hits = linesWith(r.out, '"E1010"');
      expect(hits).toHaveLength(1);
      expect(hits[0]).toContain("modules/a/routes.ts");
      expect(hits[0]).toContain("notes.server.ts");
    });
  });

  test("the same specifier in a build: `vite build` exits 1, writes nothing and ships no canary (on a case-folding disk it also reports one E1010)", async () => {
    await inProject(miscased(), (dir) => {
      const folds = existsSync(join(dir, "modules", "a", "notes.Server.ts"));
      const r = viteBuild(dir, "api");
      expect(r.status, r.out).toBe(1);
      expect(filesHolding(join(dir, "dist"), CANARY_NOTES)).toEqual([]);
      if (folds) expect(linesWith(r.out, "E1010")).not.toEqual([]);
    });
  });

  test("a miscased specifier of a plain file is E1010 as well: the rule is about the name, not server code", async () => {
    const files = nodeWith({
      "lib/fmt.ts": "export const fmt = (x: string): string => x\n",
      "modules/a/Page.tsx": page("import { fmt } from '../../lib/Fmt.ts'", "fmt('x')"),
    });
    await inProject(files, (dir) => {
      const r = keelRun(dir, ["check"]);
      expect(r.status, r.out).toBe(1);
      expect(linesWith(r.out, '"E1010"')).toHaveLength(1);
    });
  });

  test("the right-case specifier of the same file is no E1010 and `keel check` exits 0", async () => {
    const files = nodeWith({
      "modules/a/notes.server.ts": `export const notes = '${CANARY_NOTES}'\n`,
      "modules/a/routes.ts": `import { notes } from './notes.server.ts'\nReflect.set(globalThis, 'notes', notes)\n${ROUTES}`,
    });
    await inProject(files, (dir) => {
      const r = keelRun(dir, ["check"]);
      expect(r.status, r.out).toBe(0);
      expect(linesWith(r.out, '"E1010"')).toEqual([]);
    });
  });
});
