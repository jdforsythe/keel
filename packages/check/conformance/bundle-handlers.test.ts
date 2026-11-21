// Spec: k.bundle, Conformance "In a plain file, `R.loader(...)` through `import * as R from '@keel/router'`, `loader` re-exported through `lib/r.ts`, `const L = loader`, and `R.guard(...)`: each one E1551 (E1009 for the guard) in `keel check` and one E1007 `handler` in `vite build`."
// Spec: k.bundle, Handlers "`loader`, `action` and `guard` are the exports of `@keel/router`, known by binding, not by spelling: through a named import (with `as` or not), a namespace import's member (`R.loader`, `R['loader']`), a dynamic `import()`'s, a re-export through any module (`export { loader } from`, `export *`), and any specifier of the package, a subpath too."
// Spec: k.bundle, Handlers "A file uses one when it calls it or reads it as a value (passes, assigns, destructures or re-exports it); a namespace object of the package read other than by a literal member uses all three. A type-only use is none."
// Spec: k.bundle, Handlers "E1551, E1009 and E1007's reason `handler` use this one definition."
// Seed 1337 (no random input: each spelling is enumerated). `check` over in-memory project trees (the type pass is off). The `vite build` half, E1007 `handler`, is packages/cli/conformance/bundle-handlers.test.ts.
// Node `api` lists module `a`; the plain file is `modules/a/plain.ts`, which is no `*.server.*` or `*.guard.*` file, so any use of a handler there is E1551 (loader, action) or E1009 (guard).
// A subpath specifier of `@keel/router` is not enumerated: the spec says a subpath counts but names none.
import { describe, expect, test } from "vitest";
import { diagsOf, file, nodeA } from "./boundary-support.ts";

const HEAD = "import { ok, s } from '@keel/schema'\n";
const LOADER = "{ output: s.object({}) }, async () => ok({})";
const ACTION = "{ input: s.object({}) }, async () => ok(null)";
const GUARD = "{ redirect: 'a.home' }, async () => ok(null)";
const R_TS = file("lib/r.ts", "export { loader, action, guard } from '@keel/router'\n");
const R_NS = file("lib/rns.ts", "export * from '@keel/router'\n");

type Spelling = { readonly body: string; readonly extra?: readonly ReturnType<typeof file>[] };
const spellings = (ctor: "loader" | "action" | "guard", args: string): Record<string, Spelling> => ({
  [`\`R.${ctor}(...)\` through \`import * as R from '@keel/router'\``]: {
    body: `import * as R from '@keel/router'\n${HEAD}export const p = R.${ctor}(${args})\n`,
  },
  [`\`R['${ctor}'](...)\` through a namespace import`]: {
    body: `import * as R from '@keel/router'\n${HEAD}export const p = R['${ctor}'](${args})\n`,
  },
  [`\`${ctor}\` re-exported through \`lib/r.ts\` and called`]: {
    body: `import { ${ctor} } from '../../lib/r.ts'\n${HEAD}export const p = ${ctor}(${args})\n`,
    extra: [R_TS],
  },
  [`\`${ctor}\` re-exported by \`export *\` through \`lib/rns.ts\` and called`]: {
    body: `import { ${ctor} } from '../../lib/rns.ts'\n${HEAD}export const p = ${ctor}(${args})\n`,
    extra: [R_NS],
  },
  [`\`const L = ${ctor}\` then \`L(...)\``]: {
    body: `import { ${ctor} } from '@keel/router'\n${HEAD}const L = ${ctor}\nexport const p = L(${args})\n`,
  },
  [`\`import { ${ctor} as make }\` then \`make(...)\``]: {
    body: `import { ${ctor} as make } from '@keel/router'\n${HEAD}export const p = make(${args})\n`,
  },
  [`\`const { ${ctor} } = R\` destructured from a namespace import`]: {
    body: `import * as R from '@keel/router'\n${HEAD}const { ${ctor} } = R\nexport const p = ${ctor}(${args})\n`,
  },
  [`\`(await import('@keel/router')).${ctor}(...)\` through a dynamic import`]: {
    body: `${HEAD}export const p = (await import('@keel/router')).${ctor}(${args})\n`,
  },
  [`\`${ctor}\` passed as a value to \`Reflect.set\``]: {
    body: `import { ${ctor} } from '@keel/router'\nReflect.set(globalThis, 'h', ${ctor})\n`,
  },
  [`\`${ctor}\` re-exported by \`export { ${ctor} } from '@keel/router'\``]: {
    body: `export { ${ctor} } from '@keel/router'\n`,
  },
});

const at = (code: string, spelling: Spelling) =>
  diagsOf(nodeA([file("modules/a/plain.ts", spelling.body), ...(spelling.extra ?? [])]), code).filter(
    (d) => d.path === "modules/a/plain.ts",
  );

describe("k.bundle Handlers: a `loader` or `action` used in a plain file is E1551, however it is spelled", () => {
  for (const [ctor, args] of [
    ["loader", LOADER],
    ["action", ACTION],
  ] as const) {
    for (const [name, spelling] of Object.entries(spellings(ctor, args))) {
      test(`${name}: one E1551 at \`modules/a/plain.ts\``, () => {
        expect(at("E1551", spelling)).toHaveLength(1);
        expect(at("E1009", spelling)).toEqual([]);
      });
    }
  }
});

describe("k.bundle Handlers: a `guard` used in a plain file is E1009, however it is spelled", () => {
  for (const [name, spelling] of Object.entries(spellings("guard", GUARD))) {
    test(`${name}: one E1009 at \`modules/a/plain.ts\``, () => {
      expect(at("E1009", spelling)).toHaveLength(1);
      expect(at("E1551", spelling)).toEqual([]);
    });
  }
});

describe("k.bundle Handlers: a re-export and a namespace object", () => {
  test("`modules/a/r.ts` re-exporting `loader` from `@keel/router` is itself one E1551", () => {
    const d = diagsOf(nodeA([file("modules/a/r.ts", "export { loader } from '@keel/router'\n")]), "E1551");
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/a/r.ts");
  });

  test("a namespace object of the package read other than by a literal member uses all three: one E1551 and one E1009", () => {
    for (const body of [
      "import * as R from '@keel/router'\nexport const ns = R\n",
      "import * as R from '@keel/router'\nexport const keys = Object.keys(R)\n",
      "import * as R from '@keel/router'\nexport const pick = (k: string) => Reflect.get(R, k)\n",
      "import * as R from '@keel/router'\nconst name = 'loader'\nexport const h = R[name]\n",
    ]) {
      const s: Spelling = { body };
      expect(at("E1551", s), body).toHaveLength(1);
      expect(at("E1009", s), body).toHaveLength(1);
    }
  });

  test("`export * from '@keel/router'` uses all three: one E1551 and one E1009", () => {
    const s: Spelling = { body: "export * from '@keel/router'\n" };
    expect(at("E1551", s)).toHaveLength(1);
    expect(at("E1009", s)).toHaveLength(1);
  });
});

describe("k.bundle Handlers: what is no use of a handler", () => {
  const none: Record<string, Spelling> = {
    "`import type { loader }` and `typeof loader` in a type position": {
      body: "import type { loader } from '@keel/router'\nexport type L = typeof loader\n",
    },
    "a read of `manifest`, which is not a handler, through a namespace import": {
      body: "import * as R from '@keel/router'\nexport const m = R.manifest\n",
    },
    "`manifest(...)` called through a named import": {
      body: "import { manifest } from '@keel/router'\ndeclare const c: never\nexport const m = manifest(c, {})\n",
    },
    "a plain function named `loader` of the file's own": {
      body: "const loader = (x: number) => x\nexport const p = loader(1)\n",
    },
  };
  for (const [name, spelling] of Object.entries(none)) {
    test(`${name}: no E1551 and no E1009`, () => {
      expect(at("E1551", spelling)).toEqual([]);
      expect(at("E1009", spelling)).toEqual([]);
    });
  }

  test("the same `R.loader(...)` in `modules/a/load.server.ts` and `R.guard(...)` in `modules/a/auth.guard.ts` are neither E1551 nor E1009", () => {
    const files = nodeA([
      file(
        "modules/a/load.server.ts",
        `import * as R from '@keel/router'\n${HEAD}export const l = R.loader(${LOADER})\n`,
      ),
      file("modules/a/auth.guard.ts", `import * as R from '@keel/router'\n${HEAD}export const g = R.guard(${GUARD})\n`),
    ]);
    expect(diagsOf(files, "E1551")).toEqual([]);
    expect(diagsOf(files, "E1009")).toEqual([]);
  });
});
