// Spec: k.server-deps, the first two Conformance clauses, each quoted whole:
// 1. "In a project with `node` deployables `x` (modules `['a']`) and `y` (modules `['b']`), where `modules/a/module.ts` lists `'@acme/store'` in `deps` and `node_modules/@acme/store/module.ts` holds `env: ['ACME_STORE_URL']`, `deploy/compose.yaml` passes `ACME_STORE_URL: ${ACME_STORE_URL:?}` to `x` and holds no `ACME_STORE_URL` for `y`."
// 2. "In that project, `env: ['NOTES_URL']` in `modules/b/module.ts` makes `deploy/compose.yaml` pass `NOTES_URL: ${NOTES_URL:?}` to `y` only; `env: ['notes_url']`, `env: ['KEEL_SECRET']` and `env: ['KEEL_PEER_X']` there are each one E1167 at the entry."
// Environment: "A module manifest (k.module), a library's root `module.ts` included (k.library), may hold `env`: an array of string literals, the environment variables its server code reads. A `node` deployable needs the `env` names of each module its `modules` list and of each library those modules' manifests list, transitively. `deploy/compose.yaml` passes each name a deployable needs from the environment, required (`NAME: ${NAME:?}`), once per service, after the k.deploy keys and sorted, and no generated file holds a value. The names are read by server code only: no browser build holds one (k.bundle Environment)."
// Rules: "E1167 an `env` entry that is not a string literal matching `[A-Z][A-Z0-9_]*`, or that is a key `DeployEnv` parses (`PORT`, `KEEL_SECRET`, `KEEL_ORIGIN`, `KEEL_DATABASE_URL`, `KEEL_ALLOW_ORIGINS`) or begins with `KEEL_PEER_`, at the entry"
// Seed: 1337 (every property; the compose cases read one built project).
// Binary runs: 3 (`keel build` of the clause-1 project; `keel build` of the richer project; `keel check` of that project with three refused entries). The E1167 property runs `check()` in process.
// Library fixture: `@acme/store` (library-support.ts `dataLibrary`), a made-up data battery; no stdlib package name appears in any fixture or case.
// ASSUMPTIONS (spec silent): compose layout is `services:` then a two-space `<name>:` header per service with `NAME: value` lines indented below it; "at the entry" is the entry's line and a column from its first
// character to its last (a quoted literal from opening to closing quote); E1167's message text is not stated, so only its presence is asserted; `deploy/x/Dockerfile`, `deploy/y/Dockerfile` and `.github/workflows/ci.yml` hold no `env` name
// ("no generated file holds a value", and `DeployEnv` values are set where the image runs); "once per service" is read as: a name two libraries (or a library and the module) hold appears once in a service.
// "no browser build holds one" is asserted in k.bundle's conformance (bundle-env.test.ts), not here.
import { check } from "@keel/check";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  SEED,
  SLOW,
  type Tree,
  built,
  cleanup,
  dataLibrary,
  envManifestSrc,
  filesUnder,
  isDeployKey,
  diags,
  keel,
  materialize,
  quoted,
  serverDepsProject,
  serviceEnv,
  serviceNames,
  STORE,
  STORE_ENV,
  textAt,
  write,
} from "./library-support.ts";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const CLAUSE_1 =
  "In a project with `node` deployables `x` (modules `['a']`) and `y` (modules `['b']`), where `modules/a/module.ts` lists `'@acme/store'` in `deps` and `node_modules/@acme/store/module.ts` holds `env: ['ACME_STORE_URL']`, `deploy/compose.yaml` passes `ACME_STORE_URL: ${ACME_STORE_URL:?}` to `x` and holds no `ACME_STORE_URL` for `y`";
const CLAUSE_2 =
  "In that project, `env: ['NOTES_URL']` in `modules/b/module.ts` makes `deploy/compose.yaml` pass `NOTES_URL: ${NOTES_URL:?}` to `y` only; `env: ['notes_url']`, `env: ['KEEL_SECRET']` and `env: ['KEEL_PEER_X']` there are each one E1167 at the entry";

const required = (n: string): string => `\${${n}:?}`;
/** Generated files (relative paths) other than `deploy/compose.yaml`: Dockerfiles and the CI workflow. */
const otherGenerated = (dir: string): string[] =>
  filesUnder(dir)
    .map((f) => relative(dir, f))
    .filter((r) => (r.startsWith("deploy/") && r !== "deploy/compose.yaml") || r.startsWith(".github/"));

// ---- the project of clause 1 ----
let dir1 = "";
let compose1 = "";
let build1: ReturnType<typeof built> = { status: null, out: "" };
beforeAll(() => {
  dir1 = materialize(
    serverDepsProject({
      deployables: { x: ["a"], y: ["b"] },
      modules: [{ id: "a", deps: [STORE] }, { id: "b" }],
      libraries: [dataLibrary()],
    }),
  );
  build1 = built(dir1);
  compose1 = textAt(dir1, "deploy/compose.yaml") ?? "";
}, SLOW);
afterAll(() => cleanup(dir1));

describe(`k.server-deps 1: ${CLAUSE_1}`, () => {
  test("`keel build` of the project exits 0 and writes `deploy/compose.yaml`", () => {
    expect(build1.status, build1.out).toBe(0);
    expect(serviceNames(compose1)).toEqual(expect.arrayContaining(["x", "y"]));
  });

  test("`deploy/compose.yaml` passes `ACME_STORE_URL: ${ACME_STORE_URL:?}` to `x`", () => {
    expect(serviceEnv(compose1, "x")).toContainEqual([STORE_ENV, required(STORE_ENV)]);
  });

  test("`deploy/compose.yaml` holds no `ACME_STORE_URL` for `y`", () => {
    expect(serviceEnv(compose1, "y").map(([n]) => n)).not.toContain(STORE_ENV);
  });

  test("the name is passed once in the whole file, and no generated file but compose holds it", () => {
    expect(compose1.split("\n").filter((l) => l.includes(STORE_ENV))).toHaveLength(1);
    const holding = otherGenerated(dir1).filter((r) => readFileSync(`${dir1}/${r}`, "utf8").includes(STORE_ENV));
    expect(holding).toEqual([]);
  });

  test("no generated file holds a value for the name: its only mention is `NAME: ${NAME:?}`", () => {
    for (const line of compose1.split("\n").filter((l) => l.includes(STORE_ENV))) {
      expect(line.trim()).toBe(`${STORE_ENV}: ${required(STORE_ENV)}`);
    }
  });
});

// ---- the richer project: clause 2 plus the library and sorting laws of Environment ----
// x serves `a` and z serves `a` too; y serves `b`. `a` lists `@acme/store`, which lists `@acme/cache` (transitively listed); both libraries hold `ACME_STORE_URL`.
const CACHE_ENV = ["ACME_STORE_URL", "ACME_CACHE_URL"];
const richTree = (bEnv: string[]): Tree =>
  serverDepsProject({
    deployables: { x: ["a"], y: ["b"], z: ["a"] },
    modules: [
      { id: "a", deps: [STORE], env: quoted(["ZED_URL", "ALPHA_URL"]) },
      { id: "b", env: bEnv },
    ],
    libraries: [
      dataLibrary({ deps: ["@acme/cache"] }),
      dataLibrary({ name: "@acme/cache", id: "cache", env: CACHE_ENV, register: "none" }),
    ],
  });
let dir2 = "";
let compose2 = "";
let build2: ReturnType<typeof built> = { status: null, out: "" };
beforeAll(() => {
  dir2 = materialize(richTree(quoted(["NOTES_URL"])));
  build2 = built(dir2);
  compose2 = textAt(dir2, "deploy/compose.yaml") ?? "";
}, SLOW);
afterAll(() => cleanup(dir2));

const appNames = (service: string): string[] =>
  serviceEnv(compose2, service)
    .map(([n]) => n)
    .filter((n) => !isDeployKey(n));

describe(`k.server-deps 2: ${CLAUSE_2}`, () => {
  test("`keel build` of the project with `env: ['NOTES_URL']` in `modules/b/module.ts` exits 0", () => {
    expect(build2.status, build2.out).toBe(0);
  });

  test("`env: ['NOTES_URL']` in `modules/b/module.ts` makes `deploy/compose.yaml` pass `NOTES_URL: ${NOTES_URL:?}` to `y`", () => {
    expect(serviceEnv(compose2, "y")).toContainEqual(["NOTES_URL", required("NOTES_URL")]);
  });

  test("`NOTES_URL` is passed to `y` only: `x` and `z`, which do not serve `b`, do not get it", () => {
    expect(appNames("x")).not.toContain("NOTES_URL");
    expect(appNames("z")).not.toContain("NOTES_URL");
    expect(appNames("y")).toEqual(["NOTES_URL"]);
  });

  test("a deployable that does not serve the module does not get the library's name (`y` serves neither `a` nor `@acme/store`)", () => {
    expect(appNames("y")).not.toContain(STORE_ENV);
  });

  test("each deployable serving `a` gets the names of `a`, of `@acme/store` and of `@acme/cache`, which `@acme/store` lists (transitively), each once", () => {
    const want = ["ACME_CACHE_URL", "ACME_STORE_URL", "ALPHA_URL", "ZED_URL"];
    expect([...appNames("x")].sort()).toEqual(want);
    expect([...appNames("z")].sort()).toEqual(want);
  });

  test("two libraries naming one variable pass it once per service, required", () => {
    for (const service of ["x", "z"]) {
      const pairs = serviceEnv(compose2, service).filter(([n]) => n === STORE_ENV);
      expect(pairs).toEqual([[STORE_ENV, required(STORE_ENV)]]);
    }
  });

  test("the names follow the `DeployEnv` keys and are sorted", () => {
    for (const service of ["x", "y", "z"]) {
      const names = serviceEnv(compose2, service).map(([n]) => n);
      const first = names.findIndex((n) => !isDeployKey(n));
      const lastKey = names.map(isDeployKey).lastIndexOf(true);
      expect(lastKey, `${service} lists a DeployEnv key`).toBeGreaterThanOrEqual(0);
      expect(first).toBeGreaterThan(lastKey);
      const own = names.slice(first);
      expect(own).toEqual([...own].sort());
    }
  });

  test("no generated file but compose holds an `env` name, and compose holds each name only as `NAME: ${NAME:?}`", () => {
    const all = ["ACME_STORE_URL", "ACME_CACHE_URL", "ALPHA_URL", "ZED_URL", "NOTES_URL"];
    for (const r of otherGenerated(dir2)) {
      const text = readFileSync(`${dir2}/${r}`, "utf8");
      expect(
        all.filter((n) => text.includes(n)),
        r,
      ).toEqual([]);
    }
    for (const line of compose2.split("\n")) {
      for (const n of all) if (line.includes(n)) expect(line.trim()).toBe(`${n}: ${required(n)}`);
    }
  });

  test(
    "`env: ['notes_url']`, `env: ['KEEL_SECRET']` and `env: ['KEEL_PEER_X']` in `modules/b/module.ts` are each one E1167 at the entry",
    () => {
      const entries = ["notes_url", "KEEL_SECRET", "KEEL_PEER_X"];
      const src = envManifestSrc("b", [], quoted(entries));
      write(dir2, { "modules/b/module.ts": src });
      const r = keel(dir2, ["check"]);
      const hits = diags(r, "E1167");
      expect(hits).toHaveLength(3);
      for (const e of entries) {
        const idx = src.indexOf(`'${e}'`);
        const line = src.slice(0, idx).split("\n").length;
        const col = idx - src.slice(0, idx).lastIndexOf("\n");
        const mine = hits.filter((h) => h.line === line);
        expect(mine, e).toHaveLength(1);
        expect(mine[0]?.path).toBe("modules/b/module.ts");
        expect(mine[0]?.col).toBeGreaterThanOrEqual(col);
        expect(mine[0]?.col).toBeLessThanOrEqual(col + e.length + 1);
      }
      expect(r.status).toBe(1);
    },
    SLOW,
  );
});

// ---- E1167, over the space of entries (in process) ----
const FILE = (host: "app" | "library") =>
  host === "app" ? "modules/b/module.ts" : "node_modules/@acme/store/module.ts";
const DEPLOY_KEYS = ["PORT", "KEEL_SECRET", "KEEL_ORIGIN", "KEEL_DATABASE_URL", "KEEL_ALLOW_ORIGINS"];

/** The app of one module `b` (listing the library when it is the host) and the library, the host's manifest holding `entries`. */
function e1167Files(host: "app" | "library", entries: string[]): { path: string; source: string }[] {
  const lib = dataLibrary();
  const files = Object.entries(lib).map(([path, source]) => ({ path, source }));
  const appManifest = envManifestSrc("b", [STORE], host === "app" ? entries : []);
  const libManifest = envManifestSrc("store", [], host === "library" ? entries : [], {
    exports: ["store"],
    capabilities: ["store.main"],
  });
  return [
    ...files.filter((f) => f.path !== "node_modules/@acme/store/module.ts"),
    { path: "node_modules/@acme/store/module.ts", source: libManifest },
    { path: "modules/b/module.ts", source: appManifest },
  ];
}
function e1167Of(host: "app" | "library", entry: string) {
  const files = e1167Files(host, [entry]);
  const path = FILE(host);
  const source = files.find((f) => f.path === path)?.source ?? "";
  const found = check(files, { types: false }).diagnostics.filter((d) => d.code === "E1167");
  const idx = source.indexOf(entry, source.indexOf("env: ["));
  const line = source.slice(0, idx).split("\n").length;
  const col = idx - source.slice(0, idx).lastIndexOf("\n");
  return { found, path, line, col, width: entry.length };
}

const allowed = fc
  .stringMatching(/^[A-Z][A-Z0-9_]{0,12}$/)
  .filter((n) => !DEPLOY_KEYS.includes(n) && !n.startsWith("KEEL_PEER_"));
const refusedLiteral = fc.oneof(
  fc.stringMatching(/^[a-z][a-zA-Z0-9_]{0,10}$/), // lower-case first character
  fc.stringMatching(/^[0-9_][A-Z0-9_]{0,8}$/), // not a letter first
  fc.stringMatching(/^[A-Z][A-Z0-9_]{0,5}[-. a-z][A-Z0-9_]{0,5}$/), // a character outside the pattern
  fc.constantFrom(...DEPLOY_KEYS),
  fc.stringMatching(/^[A-Z][A-Z0-9_]{0,8}$/).map((t) => `KEEL_PEER_${t}`),
);
const refusedSource = fc.constantFrom("NAME", "`NOTES_${'URL'}`", "'A' + 'B'", "String('X')", "42", "['X']");

describe("k.server-deps Rules: E1167 an `env` entry that is not a string literal matching `[A-Z][A-Z0-9_]*`, or that is a key `DeployEnv` parses or begins with `KEEL_PEER_`, at the entry", () => {
  for (const host of ["app", "library"] as const) {
    test(`a ${host} manifest's string literal matching \`[A-Z][A-Z0-9_]*\` that is no \`DeployEnv\` key and does not begin with \`KEEL_PEER_\` is no E1167`, () => {
      fc.assert(
        fc.property(allowed, (name) => {
          expect(e1167Of(host, `'${name}'`).found).toEqual([]);
        }),
        { seed: SEED, numRuns: 25 },
      );
    });

    test(`a ${host} manifest's literal outside the pattern, a \`DeployEnv\` key or a \`KEEL_PEER_\` name is one E1167 at the entry`, () => {
      fc.assert(
        fc.property(refusedLiteral, (name) => {
          const r = e1167Of(host, `'${name}'`);
          expect(r.found, name).toHaveLength(1);
          expect(r.found[0]?.path).toBe(r.path);
          expect(r.found[0]?.line).toBe(r.line);
          expect(r.found[0]?.col).toBeGreaterThanOrEqual(r.col);
          expect(r.found[0]?.col).toBeLessThanOrEqual(r.col + r.width);
          expect((r.found[0]?.message ?? "").length).toBeGreaterThan(0);
        }),
        { seed: SEED, numRuns: 40 },
      );
    });

    test(`a ${host} manifest's entry that is not a string literal is one E1167 at the entry`, () => {
      fc.assert(
        fc.property(refusedSource, (entry) => {
          const r = e1167Of(host, entry);
          expect(r.found, entry).toHaveLength(1);
          expect(r.found[0]?.path).toBe(r.path);
          expect(r.found[0]?.line).toBe(r.line);
        }),
        { seed: SEED, numRuns: 12 },
      );
    });
  }

  test("each entry of one `env` is judged alone: one valid and one refused entry give one E1167, at the refused one", () => {
    const files = e1167Files("app", ["'NOTES_URL'", "'notes_url'"]);
    const found = check(files, { types: false }).diagnostics.filter((d) => d.code === "E1167");
    expect(found).toHaveLength(1);
    const src = files.find((f) => f.path === "modules/b/module.ts")?.source ?? "";
    expect(found[0]?.line).toBe(src.split("\n").findIndex((l) => l.includes("'notes_url'")) + 1);
  });
});

describe("k.server-deps point to prove: no stdlib package name appears in the fixture", () => {
  test("every file of the `@acme/store` fixture and of the projects above names no `@keel/std-` package", () => {
    const files = { ...dataLibrary({ bin: true }), ...richTree(quoted(["NOTES_URL"])) };
    for (const [path, text] of Object.entries(files)) expect(text.includes("@keel/std-"), path).toBe(false);
  });
});
