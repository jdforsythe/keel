// Spec: k.compiler, clause "A `routes.ts` whose graph reaches a `*.server.ts` file importing `node:child_process`, `node:net` and `node:dns` and calling none of their functions at import time evaluates with no E1050; that file calling `execSync('true')` at its top level makes `keel check` report one E1050 whose message starts `node:child_process.execSync` and exit 1, and `new Socket()` of `node:net` there one starting `node:net.Socket`."
// Spec: k.compiler, clause "That `*.server.ts` file importing `./a.node` makes `keel check` report one E1050 at that file and the import's line, and exit 1."
// Spec: k.compiler, clause "That `*.server.ts` file's top level calling `readFileSync(0)`, or `createRequire(import.meta.url)` with a name built at run time naming its sibling `c.cjs`, makes `keel check` report one E1050 and exit 1, and leaves no entry in `node_modules/.cache/keel/derived/`."
// Also states, k.compiler Build-time evaluation: "The rest is refused with E1050: a member or built-in not listed, one Node adds too (a fact that moves on its own, `os.cpus()`; a stat's `atime`, which a read moves), a function at its call or construction (importing is allowed), any other value at its read; a `.node` addon, at its import; an open for writing; a read by a descriptor it did not open; a code file named at run time; `import.meta.resolve`; `WebAssembly` instantiation with imports."
// Also states, k.compiler Rules: "E1050 a read the build-time evaluation cannot observe (Build-time evaluation), its message starting with what it refused: at the import for an addon; else at the refused call's first project-file frame, or unlocated with `at <package>/<path>:<line>` next when that frame is a package's, cut from its start to fit."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case; the `*.server.ts` file of the clauses is `modules/setup/gate.guard.ts`
// (a server-only file of a module only a `node` deployable lists, reached from that module's `routes.ts`; k.boundary).
// ASSUMED: the name of a computed require is the sketch's `['./c', 'cjs'].join('.')` (a bare `c.cjs` names a package, which Node resolves from `node_modules` and finds absent: E1006, not a refusal), and (for a `.json` that must load) an absolute path built the same way.
// k.compiler Rules and Build-time evaluation, as read here: a refusal in a project file (the guard file) is located at that file and the refused call's line; a refusal in a package is unlocated, its message ending `at <package>/<path>:<line>`; every message starts with what it refused (`process.dlopen`), and a computed require or descriptor read asserts only the code and exit.
// The `--format=compact` position of the addon case is `E1050 <path>:<line>:<col> <message>` (docs/OUTPUT.md).
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { cacheEntries, dropCache, e1050, guardFile, pgLike } from "./derived-cache-observed-support.ts";
import { type Tree, brief, cloneTree, dropTree, householdTree, keel, put } from "./derived-support.ts";

const SLOW = fixedTime(600_000);

let house: Tree | undefined;
const made: Tree[] = [];
afterAll(() => {
  for (const t of made) dropTree(t);
});
const copy = (): Tree => {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  const t = cloneTree(house);
  made.push(t);
  return t;
};

describe("k.compiler: importing the Node modules and calling none of their functions evaluates", () => {
  test(
    "a `*.server.ts` file importing `node:child_process`, `node:net` and `node:dns` and calling none of their functions at import time evaluates with no E1050",
    () => {
      const t = copy();
      guardFile(
        t,
        'import * as cp from "node:child_process";\nimport * as net from "node:net";\nimport * as dns from "node:dns";\nconst kept = [typeof cp.execSync, typeof net.Socket, typeof dns.lookup];\nvoid kept;',
      );
      const out = keel(t.dir, ["check"]);
      expect(e1050(out), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
    },
    SLOW,
  );

  test(
    "a package's CommonJS code that requires `net` and `events` at its top level and calls none of their functions (as `pg` does) evaluates with no E1050",
    () => {
      const t = copy();
      pgLike(t);
      guardFile(t, 'import { Client } from "pg-like";\nconst kept = typeof Client;\nvoid kept;');
      const out = keel(t.dir, ["check"]);
      expect(e1050(out), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
    },
    SLOW,
  );
});

describe("k.compiler: calling or constructing a function of a refused Node module is E1050", () => {
  test(
    "that file calling `execSync('true')` at its top level makes `keel check` report one E1050 whose message starts `node:child_process.execSync` and exit 1",
    () => {
      const t = copy();
      guardFile(t, 'import { execSync } from "node:child_process";\nexecSync("true");');
      const out = keel(t.dir, ["check"]);
      const found = e1050(out);
      expect(found, brief(out)).toHaveLength(1);
      expect(found[0]?.message.startsWith("node:child_process.execSync")).toBe(true);
      expect(out.status, brief(out)).toBe(1);
    },
    SLOW,
  );

  test(
    "`new Socket()` of `node:net` there makes `keel check` report one E1050 whose message starts `node:net.Socket` and exit 1",
    () => {
      const t = copy();
      guardFile(t, 'import { Socket } from "node:net";\nconst s = new Socket();\nvoid s;');
      const out = keel(t.dir, ["check"]);
      const found = e1050(out);
      expect(found, brief(out)).toHaveLength(1);
      expect(found[0]?.message.startsWith("node:net.Socket")).toBe(true);
      expect(out.status, brief(out)).toBe(1);
    },
    SLOW,
  );

  // One case per module of the list; each is one rule (Build-time evaluation). `call` is harmless where it is refused before it runs.
  describe.each([
    ["node:child_process", 'cp.execSync("true");', "execSync"],
    ["node:cluster", "cp.setupPrimary();", "setupPrimary"],
    ["node:worker_threads", 'new cp.Worker("0", { eval: true });', "Worker"],
    ["node:net", "new cp.Socket();", "Socket"],
    ["node:tls", "cp.createSecureContext();", "createSecureContext"],
    ["node:dgram", 'cp.createSocket("udp4");', "createSocket"],
    ["node:dns", "cp.getServers();", "getServers"],
    ["node:http", "cp.createServer();", "createServer"],
    ["node:https", "new cp.Agent();", "Agent"],
    ["node:http2", "cp.createServer();", "createServer"],
  ] as const)("%s", (module, call, fn) => {
    test(
      `calling or constructing \`${fn}\` of \`${module}\` at the top level is one E1050 whose message starts \`${module}.${fn}\`, exit 1`,
      () => {
        const t = copy();
        guardFile(t, `import * as cp from ${JSON.stringify(module)};\n${call}`);
        const out = keel(t.dir, ["check"]);
        const found = e1050(out);
        expect(found, brief(out)).toHaveLength(1);
        expect(found[0]?.message.startsWith(`${module}.${fn}`), found[0]?.message).toBe(true);
        expect(out.status, brief(out)).toBe(1);
      },
      SLOW,
    );
  });
});

describe("k.compiler: a `.node` addon import is E1050 at the import", () => {
  test(
    "That `*.server.ts` file importing `./a.node` makes `keel check` report one E1050 at that file and the import's line, and exit 1.",
    () => {
      const t = copy();
      put(t.dir, "modules/setup/a.node", "");
      guardFile(t, 'import a from "./a.node";\nconst kept = typeof a;\nvoid kept;');
      const out = keel(t.dir, ["check"]);
      const found = e1050(out);
      expect(found, brief(out)).toHaveLength(1);
      expect(found[0]?.path, brief(out)).toBe("modules/setup/gate.guard.ts");
      expect(found[0]?.line, brief(out)).toBe(1);
      expect(out.status, brief(out)).toBe(1);
      const compact = keel(t.dir, ["check", "--format=compact"]);
      expect(compact.stdout).toMatch(/^E1050 modules\/setup\/gate\.guard\.ts:1:\d+ /m);
    },
    SLOW,
  );

  test(
    "the import of an addon on a later line is located at that line",
    () => {
      const t = copy();
      put(t.dir, "modules/setup/a.node", "");
      guardFile(t, '// first line\n\nimport a from "./a.node";\nconst kept = typeof a;\nvoid kept;');
      const out = keel(t.dir, ["check"]);
      const found = e1050(out);
      expect(found, brief(out)).toHaveLength(1);
      expect(found[0]?.line, brief(out)).toBe(3);
    },
    SLOW,
  );
});

describe("k.compiler: `process.dlopen` and `process.binding` called in a project file are E1050 at that file and line", () => {
  test.each([
    ["dlopen", 'process.dlopen({ exports: {} }, "/nonexistent/a.node");'],
    ["binding", 'process.binding("fs");'],
  ])(
    "`process.%s` called at the top level of the guard file is one E1050 naming it, at that file and the call's line, and exit 1",
    (name, call) => {
      const t = copy();
      guardFile(t, call);
      const out = keel(t.dir, ["check"]);
      const found = e1050(out);
      expect(found, brief(out)).toHaveLength(1);
      expect(found[0]?.message.startsWith(`process.${name}`), found[0]?.message).toBe(true);
      expect(found[0]?.path, brief(out)).toBe("modules/setup/gate.guard.ts");
      expect(found[0]?.line, brief(out)).toBe(1);
      expect(out.status, brief(out)).toBe(1);
    },
    SLOW,
  );
});

describe("k.compiler: a computed require of a file not ending `.json`, and a read by a descriptor the evaluation did not open, are E1050", () => {
  test(
    "That `*.server.ts` file's top level calling `createRequire(import.meta.url)` with a name built at run time naming its sibling `c.cjs` makes `keel check` report one E1050 and exit 1, and leaves no entry in `node_modules/.cache/keel/derived/`.",
    () => {
      const t = copy();
      put(t.dir, "modules/setup/c.cjs", "module.exports = 1;\n");
      dropCache(t.dir);
      guardFile(
        t,
        "import { createRequire } from \"node:module\";\nconst c = createRequire(import.meta.url)(['./c', 'cjs'].join('.'));\nvoid c;",
      );
      const out = keel(t.dir, ["check"]);
      expect(e1050(out), brief(out)).toHaveLength(1);
      expect(out.status, brief(out)).toBe(1);
      expect(cacheEntries(t.dir)).toEqual([]);
    },
    SLOW,
  );

  test(
    "a computed require of the absolute path of `c.cjs`, built at run time, is one E1050 and exit 1",
    () => {
      const t = copy();
      put(t.dir, "modules/setup/c.cjs", "module.exports = 1;\n");
      guardFile(
        t,
        `import { createRequire } from "node:module";\nconst c = createRequire(import.meta.url)([${JSON.stringify(join(t.dir, "modules/setup/c"))}, "cjs"].join("."));\nvoid c;`,
      );
      const out = keel(t.dir, ["check"]);
      expect(e1050(out), brief(out)).toHaveLength(1);
      expect(out.status, brief(out)).toBe(1);
    },
    SLOW,
  );

  test(
    "That `*.server.ts` file's top level calling `readFileSync(0)` makes `keel check` report one E1050 and exit 1, and leaves no entry in `node_modules/.cache/keel/derived/`.",
    () => {
      const t = copy();
      dropCache(t.dir);
      guardFile(t, 'import { readFileSync } from "node:fs";\nconst d = readFileSync(0);\nvoid d;');
      const out = keel(t.dir, ["check"]);
      expect(e1050(out), brief(out)).toHaveLength(1);
      expect(out.status, brief(out)).toBe(1);
      expect(cacheEntries(t.dir)).toEqual([]);
    },
    SLOW,
  );

  test(
    "a `readSync` of descriptor 0, which the evaluation did not open, is one E1050 and exit 1",
    () => {
      const t = copy();
      guardFile(t, 'import { readSync } from "node:fs";\nconst n = readSync(0, Buffer.alloc(1), 0, 1, null);\nvoid n;');
      const out = keel(t.dir, ["check"]);
      expect(e1050(out), brief(out)).toHaveLength(1);
      expect(out.status, brief(out)).toBe(1);
    },
    SLOW,
  );

  test(
    "a computed require of a file ending `.json` is no E1050 (it is observed)",
    () => {
      const t = copy();
      put(t.dir, "modules/setup/m.json", '{"min":1}\n');
      guardFile(
        t,
        `import { createRequire } from "node:module";\nconst m = createRequire(import.meta.url)([${JSON.stringify(join(t.dir, "modules/setup/m"))}, "json"].join("."));\nvoid m;`,
      );
      const out = keel(t.dir, ["check"]);
      expect(e1050(out), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
    },
    SLOW,
  );

  test(
    "a read by a descriptor the evaluation opened is no E1050 (it is observed)",
    () => {
      const t = copy();
      put(t.dir, "modules/setup/m.txt", "1");
      const at = join(t.dir, "modules/setup/m.txt");
      guardFile(
        t,
        `import { closeSync, openSync, readSync } from "node:fs";\nconst fd = openSync(${JSON.stringify(at)}, "r");\nreadSync(fd, Buffer.alloc(1), 0, 1, 0);\ncloseSync(fd);`,
      );
      const out = keel(t.dir, ["check"]);
      expect(e1050(out), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
    },
    SLOW,
  );
});

describe("k.compiler: E1050 in each command that builds", () => {
  test(
    "`keel build` of a project whose evaluation is refused reports E1050 and exits 1",
    () => {
      const t = copy();
      guardFile(t, 'import { execSync } from "node:child_process";\nexecSync("true");');
      const out = keel(t.dir, ["build"]);
      expect(e1050(out), brief(out)).toHaveLength(1);
      expect(out.status, brief(out)).toBe(1);
    },
    SLOW,
  );
});

// UNTESTABLE here: "`vite build` ... is an error" and "`keel dev` prints it and keeps serving" (k.compiler Build-time evaluation) need a vite run and a dev server over this fixture; k.derived clause 18 owns the dev harness.
