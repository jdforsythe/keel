// Seed 1337 (fast-check seed, recorded in each fc.assert below)
// Spec: k.module, clause "A stdlib module's manifest is validated by the same schema and enforced by the same rules as an app module's."
// k.module, Manifest, "Stdlib modules ship the same manifest (extension point) at the package root; `deps` name the package and its `id` is its prefix."
// Invariant (not a sentence of k.module now): no fix edits a file under `node_modules/`.
// Fixture assumption (spec silent on specifiers): stdlib files are imported as `@keel/std-x/<File>`; app modules by relative path.
// module() on invalid input: the spec only says manifests are validated by ModuleSchema; the implementation throws, asserted here.
import { check } from "@keel/check";
import { module, ModuleSchema } from "@keel/compiler";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED, codesOf, exportFile, has, lowerId, manifestFile, pascal } from "./module-support.ts";
import { CHECK_CASE_BOUND } from "./check-time.ts";

const AUTH = "node_modules/@keel/std-auth";
const MONEY = "node_modules/@keel/std-money";
const auth = (m: {
  exports?: string[];
  deps?: string[];
  capabilities?: string[];
}) => manifestFile({ id: "auth", ...m }, AUTH);
const money = (m: { deps?: string[] }) => manifestFile({ id: "money", ...m }, MONEY);
const orders = (deps: string[]) => manifestFile({ id: "orders", deps });
const importing = (name: string) => ({
  path: "modules/orders/OrderCard.ts",
  source: `import { ${name} } from '@keel/std-auth/${name}'\nexport const OrderCard = ${name}\n`,
});
/** A contract file of page ids `ids` for the module at `root`: `modules/<id>/<id>.contract.ts` for an app module, `contract.ts` at a package root. */
const routesAt = (root: string, ids: string[]) => {
  const base = root.split("/").pop() ?? "";
  const id = base.replace(/^std-/, "");
  const entries = ids.map((r) => `  '${r}': { path: '/${r.replace(/\./g, "/")}' },`).join("\n");
  return {
    path: root.startsWith("modules/") ? `${root}/${id}.contract.ts` : `${root}/contract.ts`,
    source: `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', {\n${entries}\n})\n`,
  };
};

// ---- ModuleSchema and module() on stdlib manifests ----

const stdManifest = fc.record({
  id: lowerId,
  deps: fc.uniqueArray(fc.constantFrom("@keel/std-auth", "@keel/std-money", "@keel/std-ui"), { maxLength: 3 }),
  capabilities: fc.uniqueArray(fc.constantFrom("clock", "random", "net", "storage"), { maxLength: 4 }),
  public: fc.record({
    exports: fc.uniqueArray(pascal, { maxLength: 3 }),
  }),
});

test(
  "ModuleSchema accepts a stdlib manifest with a lowerCamel id and package names in deps",
  () => {
    fc.assert(
      fc.property(stdManifest, (m) => {
        expect(ModuleSchema.parse(m).ok).toBe(true);
      }),
      { seed: SEED, numRuns: 40 },
    );
    expect(
      ModuleSchema.parse({
        id: "auth",
        deps: ["@keel/std-money"],
        capabilities: ["net"],
        public: { exports: ["Session"] },
      }).ok,
    ).toBe(true);
  },
  CHECK_CASE_BOUND,
);

const BASE = {
  id: "auth",
  deps: ["@keel/std-money"],
  capabilities: [],
  public: { exports: [] },
};
const { id: _id, ...NO_ID } = BASE;
const { public: _public, ...NO_PUBLIC } = BASE;
const MALFORMED: Record<string, unknown> = {
  "id is the package name, not lowerCamel": { ...BASE, id: "@keel/std-auth" },
  "id is std-auth, not lowerCamel": { ...BASE, id: "std-auth" },
  "id is missing": NO_ID,
  "public is missing": NO_PUBLIC,
  "deps is not an array": { ...BASE, deps: "@keel/std-money" },
  "deps holds a non-string": { ...BASE, deps: [1] },
};

for (const [why, m] of Object.entries(MALFORMED)) {
  test(
    `ModuleSchema rejects a malformed stdlib manifest: ${why}`,
    () => {
      expect(ModuleSchema.parse(m).ok).toBe(false);
    },
    CHECK_CASE_BOUND,
  );
  test(
    `module() throws on a malformed stdlib manifest: ${why}`,
    () => {
      expect(() => Reflect.apply(module, undefined, [m])).toThrow();
    },
    CHECK_CASE_BOUND,
  );
}

test(
  "module() returns a valid stdlib manifest unchanged in id, deps, and public surface",
  () => {
    fc.assert(
      fc.property(stdManifest, (m) => {
        const out = module(m);
        expect(out.id).toBe(m.id);
        expect(out.deps).toEqual(m.deps);
        expect(out.public).toEqual(m.public);
        expect(ModuleSchema.parse(out).ok).toBe(true);
      }),
      { seed: SEED, numRuns: 30 },
    );
  },
  CHECK_CASE_BOUND,
);

// ---- the same rules on a stdlib module ----

test(
  "E1151: a non-public export of a stdlib module (id auth) imported by an app module is reported; public is clean",
  () => {
    fc.assert(
      fc.property(pascal, (name) => {
        const mk = (exports: string[]) => [
          auth({ exports }),
          exportFile(AUTH, name),
          orders(["@keel/std-auth"]),
          importing(name),
        ];
        expect(has(mk([]), "E1151")).toBe(true);
        expect(has(mk([name]), "E1151")).toBe(false);
      }),
      { seed: SEED, numRuns: 20 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "E1152: importing a stdlib module absent from deps is reported even when the export is public",
  () => {
    fc.assert(
      fc.property(pascal, (name) => {
        expect(has([auth({ exports: [name] }), exportFile(AUTH, name), orders([]), importing(name)], "E1152")).toBe(
          true,
        );
        expect(
          has(
            [auth({ exports: [name] }), exportFile(AUTH, name), orders(["@keel/std-auth"]), importing(name)],
            "E1152",
          ),
        ).toBe(false);
      }),
      { seed: SEED, numRuns: 20 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "E1154: a stdlib public export that does not exist is reported; the file present clears it",
  () => {
    fc.assert(
      fc.property(pascal, (name) => {
        expect(has([auth({ exports: [name] })], "E1154")).toBe(true);
        expect(has([auth({ exports: [name] }), exportFile(AUTH, name)], "E1154")).toBe(false);
      }),
      { seed: SEED, numRuns: 20 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "E1153: stdlib modules auth and money listing each other in deps produce exactly one E1153 naming both",
  () => {
    const d = codesOf([auth({ deps: ["@keel/std-money"] }), money({ deps: ["@keel/std-auth"] })], "E1153");
    expect(d.length).toBe(1);
    expect(d[0]?.message).toContain("auth");
    expect(d[0]?.message).toContain("money");
    expect(has([auth({ deps: ["@keel/std-money"] }), money({})], "E1153")).toBe(false);
  },
  CHECK_CASE_BOUND,
);

const STORE = (storeId: string) => ({
  path: `${AUTH}/session.ts`,
  source: `import { store } from '@keel/store'\nexport const session = store({} as never, {}, { id: '${storeId}' })\n`,
});
const TX = (name: string) => ({
  path: `${AUTH}/signIn.ts`,
  source: `import { transaction } from '@keel/store'\nimport { session } from './session.ts'\nexport const signIn = transaction(session, '${name}', {} as never, (state) => state)\n`,
});
const ERR = (code: string) => ({
  path: `${AUTH}/Denied.ts`,
  source: `import { s } from '@keel/schema'\nexport const Denied = s.error('${code}', s.object({}))\n`,
});

test(
  "E1155: a stdlib route login without the auth. prefix is reported; auth.login is clean",
  () => {
    const d = codesOf([auth({}), routesAt(AUTH, ["login"])], "E1155");
    expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d[0]?.path).toBe(`${AUTH}/contract.ts`);
    expect(has([auth({}), routesAt(AUTH, ["auth.login"])], "E1155")).toBe(false);
  },
  CHECK_CASE_BOUND,
);

test(
  "E1155: a stdlib store id, transaction name, and error code without the auth. prefix are reported; prefixed are clean",
  () => {
    fc.assert(
      fc.property(lowerId, (name) => {
        for (const mk of [STORE, TX, ERR]) {
          expect(has([auth({}), mk(`${name}x.${name}`)], "E1155")).toBe(true);
          expect(has([auth({}), mk(`auth.${name}`)], "E1155")).toBe(false);
        }
      }),
      { seed: SEED, numRuns: 20 },
    );
  },
  CHECK_CASE_BOUND,
);

const RUN = `import type { Ctx } from '@keel/ctx'\nexport const Run = (ctx: Ctx) => ctx.clock.now()\n`;

test(
  "E1156: a stdlib file using ctx.clock.now() without clock in capabilities is reported; with it, clean",
  () => {
    const run = { path: `${AUTH}/Run.ts`, source: RUN };
    const d = codesOf([auth({ capabilities: [] }), run], "E1156");
    expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d[0]?.path).toBe(`${AUTH}/Run.ts`);
    expect(has([auth({ capabilities: ["clock"] }), run], "E1156")).toBe(false);
  },
  CHECK_CASE_BOUND,
);

test(
  "importing a stdlib module's `./contract` needs `deps` only: absent is E1152, listed is none and no E1151",
  () => {
    const mk = (deps: string[]) => [
      auth({}),
      routesAt(AUTH, ["auth.login"]),
      orders(deps),
      {
        path: "modules/orders/Back.ts",
        source: `import { auth } from '@keel/std-auth/contract'\nexport const Back = auth.href('auth.login')\n`,
      },
    ];
    expect(has(mk([]), "E1152")).toBe(true);
    expect(has(mk(["@keel/std-auth"]), "E1152")).toBe(false);
    expect(has(mk(["@keel/std-auth"]), "E1151")).toBe(false);
  },
  CHECK_CASE_BOUND,
);

// ---- app / stdlib parity ----

type Kind = "app" | "std";
const NO_TYPES = { types: false } as const;
const where = (kind: Kind, x: string) => (kind === "app" ? `modules/${x}` : `node_modules/@keel/std-${x}`);
const ref = (kind: Kind, x: string) => (kind === "app" ? x : `@keel/std-${x}`);
const spec = (kind: Kind, x: string, name: string) =>
  kind === "app" ? `../${x}/${name}.ts` : `@keel/std-${x}/${name}`;
const mfile = (kind: Kind, m: Parameters<typeof manifestFile>[0]) => manifestFile(m, where(kind, m.id));
const consumer = (kind: Kind, deps: string[], body: string): Files => [
  manifestFile({ id: "app", deps: deps.map((d) => ref(kind, d)) }),
  { path: "modules/app/Use.ts", source: body },
];
const importer = (kind: Kind, x: string, name: string) =>
  `import { ${name} } from '${spec(kind, x, name)}'\nexport const Use = ${name}\n`;

const SCENARIOS: Record<string, (kind: Kind, x: string) => Files> = {
  E1151: (k, x) => [
    mfile(k, { id: x }),
    exportFile(where(k, x), "Secret"),
    ...consumer(k, [x], importer(k, x, "Secret")),
  ],
  E1152: (k, x) => [
    mfile(k, { id: x, exports: ["Pub"] }),
    exportFile(where(k, x), "Pub"),
    ...consumer(k, [], importer(k, x, "Pub")),
  ],
  E1153: (k, x) => [mfile(k, { id: x, deps: [ref(k, "other")] }), mfile(k, { id: "other", deps: [ref(k, x)] })],
  E1154: (k, x) => [mfile(k, { id: x, exports: ["Ghost"] })],
  E1155: (k, x) => [mfile(k, { id: x }), routesAt(where(k, x), ["show"])],
  E1156: (k, x) => [mfile(k, { id: x }), { path: `${where(k, x)}/Run.ts`, source: RUN }],
};

// The clause names E1151-E1156 only; E1165 (unused `deps`) is not judged for `@keel/std-*` entries (k.module Rules).
const NAMED = new Set(["E1151", "E1152", "E1153", "E1154", "E1155", "E1156"]);
const sortedCodes = (files: Files) =>
  check(files, NO_TYPES)
    .diagnostics.map((d) => d.code)
    .filter((c) => NAMED.has(c))
    .sort();

test(
  "a module as an app module and as a stdlib package yield the same multiset of diagnostic codes for each of E1151-E1156",
  () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(SCENARIOS)), lowerId, (code, x) => {
        const make = SCENARIOS[code];
        if (make === undefined) throw new Error(code);
        const asApp = sortedCodes(make("app", x));
        const asStd = sortedCodes(make("std", x));
        expect(asApp).toContain(code);
        expect(asStd).toEqual(asApp);
      }),
      { seed: SEED, numRuns: 60 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "a diagnostic located under node_modules/ carries no fix, and no fix names a node_modules path",
  () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(SCENARIOS)), lowerId, (code, x) => {
        const make = SCENARIOS[code];
        if (make === undefined) throw new Error(code);
        for (const d of check(make("std", x), NO_TYPES).diagnostics) {
          if (d.path.includes("node_modules/")) expect(d.fix).toBeUndefined();
          if (d.fix !== undefined) expect(d.fix).not.toContain("node_modules/");
        }
      }),
      { seed: SEED, numRuns: 40 },
    );
  },
  CHECK_CASE_BOUND,
);
