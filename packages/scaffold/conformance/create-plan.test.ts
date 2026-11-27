// k.create `createPlan` over in-memory folders (see create-plan-support.ts for the assumed input and result shapes).
// Spec: k.create, clause "The default project's files are exactly the `client` row, with one `.claude/skills/<name>/SKILL.md` per skill `keel docs` lists."
// Spec: k.create, clause "`--adapter static` writes the same paths with `adapter: \"static\"` in `topology.ts`; `--adapter node` adds exactly `modules/app/loadHome.server.ts`, `deploy/web/Dockerfile` and `deploy/compose.yaml`."
// Spec: k.create, clause "For each adapter the tree equals, byte for byte, the one `keel scaffold project` writes with that adapter from a `@keel/cli` of create's version and the same `npm_config_user_agent`."
// Spec: k.create, clause "Every `@keel/*` entry of an app's `package.json` is create's version with no range, and `engines.node` is `>=22.15`."
// Spec: k.create, clause "A `client` or `static` project has no file named `*.server.ts`, no `deploy/` folder, and no file outside `AGENTS.md` and `.claude/` holding `KEEL_SECRET`, `createApp` or `identity`."
// Spec: k.create, clause "`--library @acme/charts` writes the `library` files at the folder's root with `.gitignore` and the agent files, and `package.json` names `@acme/charts`."
// Spec: k.create, clause "In a folder holding `notes.txt`, `create-app` reports E1360, exits 1 and writes nothing; in one holding only `.git` and `.DS_Store` it writes the project."
// Spec: k.create, clause "With `--existing`, a folder holding `README.md` gets the project and its `README.md` unchanged, and one holding `package.json` gets E1361 naming `package.json`, one also holding `tokens.ts` and `topology.ts` one E1361 whose `paths` are the three; nothing is written."
// Spec: k.create, clause "A folder `My Site` is E1352 whose message holds `--name my-site`; `--name vite` and `--library charts` are each E1352, nothing written."
// Spec: k.create, clause "`createPlan` given Node 22.14.0 returns E1362 and no file."
// Spec: k.create, clause "With `npm_config_user_agent` `npm/10.9.0 node/v22.15.0`, `package.json` has `packageManager: \"npm@10.9.0\"`, the CI workflow runs `npm ci`, and the next records are `npm install` and `npx --no keel dev`, `check`, `test`, `build`."
// Spec: k.create, clause "With `yarn/4.5.0`, `.yarnrc.yml` holds `nodeLinker: node-modules`; with no user agent, `package.json` has no `packageManager` and the commands are pnpm's."
// Spec: k.create, clause "Below a folder whose `pnpm-workspace.yaml` lists `apps/*`, `create-app apps/b` writes no `turbo.json`, CI workflow or `packageManager`, and its install record has `dir` `../..`; `create-app tools/b` there reports W1364 and writes the project."
// Spec: k.create, clause "With `node_modules/@keel/cli` at another version above the target, `create-app` reports E1363 naming both versions and writes nothing."
// Spec: k.create, clause "`--adapter node --library @a/b`, a second folder argument and `--nope` are each E1052, exit 2, nothing written."
// k.create, Rules "E1360 the folder holds files (fix: name a new folder, or add `--existing`)"
// k.create, Rules "E1361 `--existing` and a file the project writes exists (fix: move it aside, or use a new folder)"
// k.create, Rules "E1362 Node older than 22.15 (fix: install Node 22.15 or later)"
// k.create, Rules "E1363 the workspace has `@keel/cli` at another version (fix: `pnpm create @keel/app@<that version>`)"
// k.create, Rules "W1364 the workspace's package globs leave the folder out (fix: add it to them)"
// k.create, Rules "E1365 a write failed; this run's files are removed (fix: free the path or its permission). Names are E1352, flags E1052 (`--adapter` with `--library`, a second folder, an unknown flag), links E1357."
// Seed 1337 (properties over names, versions, listings, Node versions). Untestable here, tested in packages/create-app/conformance/create-bin.test.ts:
// E1365 (a write failing is the bin's), E1357 (a link is the bin's real path), the standard-input, permission-model and output-format clauses.
// ASSUMPTIONS (spec silent, readings asserted):
// - "the tree equals ... `keel scaffold project`": run with the tmp folder `shop`, the same `npm_config_user_agent`, `version` the cli's, `nodeVersion` the running Node's.
// - An unrecognised manager word (`deno/2.0.0`): the commands are pnpm's (spec says `pnpm` otherwise); `packageManager` for it is not asserted ("`<name>@<version>` from that word" does not say which name).
// - W1364 is a `diag` record whose JSON holds the code; E1363 names both versions in its message.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { testTime } from "@keel/tooling/test-time";
import { cleanup, materialize, readTree, root } from "./keel-cli.ts";
import {
  RUNS,
  SEED,
  VERSION,
  cliVersion,
  clientSet,
  commands,
  json,
  librarySet,
  nodeSet,
  paths,
  plan,
  skillPaths,
  sorted,
} from "./create-plan-support.ts";

const cfg = { seed: SEED, numRuns: RUNS };
const PNPM = "pnpm/9.12.0 node/v22.15.0";
const ua = (m: string, v = "9.9.9"): string => `${m}/${v} node/v22.15.0`;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

const version = fc.tuple(fc.nat(30), fc.nat(30), fc.nat(30)).map(([a, b, c]) => `${a}.${b}.${c}`);
const goodName = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,20}$/)
  .filter((n) => !["vite", "vitest", "typescript", "react"].includes(n));

describe("k.create createPlan: files per kind", () => {
  it("The default project's files are exactly the `client` row, with one `.claude/skills/<name>/SKILL.md` per skill `keel docs` lists.", () => {
    const p = plan();
    expect(p.ok, p.text).toBe(true);
    expect(paths(p)).toEqual(clientSet());
    expect(skillPaths().length).toBeGreaterThan(0);
    for (const s of skillPaths()) expect(p.files.has(s)).toBe(true);
  });

  it('`--adapter static` writes the same paths with `adapter: "static"` in `topology.ts`', () => {
    const p = plan({ adapter: "static" });
    expect(paths(p)).toEqual(clientSet());
    expect(p.files.get("topology.ts")).toMatch(/adapter:\s*['"]static['"]/);
    expect(plan().files.get("topology.ts")).toMatch(/adapter:\s*['"]client['"]/);
  });

  it("`--adapter node` adds exactly `modules/app/loadHome.server.ts`, `deploy/web/Dockerfile` and `deploy/compose.yaml`", () => {
    const p = plan({ adapter: "node" });
    expect(paths(p)).toEqual(nodeSet());
    const extra = paths(p).filter((x) => !clientSet().includes(x));
    expect(extra).toEqual(["deploy/compose.yaml", "deploy/web/Dockerfile", "modules/app/loadHome.server.ts"]);
    expect(p.files.get("topology.ts")).toMatch(/adapter:\s*['"]node['"]/);
  });

  it(
    "For each adapter the tree equals, byte for byte, the one `keel scaffold project` writes with that adapter from a `@keel/cli` of create's version and the same `npm_config_user_agent`.",
    () => {
      const cases: [string, "client" | "node" | "static"][] = [
        [PNPM, "client"],
        [PNPM, "static"],
        [PNPM, "node"],
        [ua("npm", "10.9.0"), "client"],
        [ua("yarn", "4.5.0"), "client"],
      ];
      for (const [agent, adapter] of cases) {
        const dir = materialize(new Map());
        dirs.push(dir);
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (v !== undefined && !k.startsWith("VITEST") && !k.startsWith("npm_config_") && k !== "NODE_OPTIONS")
            env[k] = v;
        }
        env.npm_config_user_agent = agent;
        const r = spawnSync(
          process.execPath,
          [join(root, "packages/cli/src/bin.ts"), "scaffold", "project", "shop", "--adapter", adapter, "--format=json"],
          { cwd: dir, encoding: "utf8", env },
        );
        expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
        const written = readTree(join(dir, "shop"));
        const p = plan({ adapter, userAgent: agent, version: cliVersion(), nodeVersion: process.versions.node });
        expect(p.ok, p.text).toBe(true);
        expect(sorted([...p.files.keys()]), `${agent} ${adapter}`).toEqual(sorted([...written.keys()]));
        for (const [path, text] of written) expect(p.files.get(path), `${agent} ${adapter} ${path}`).toBe(text);
      }
    },
    testTime(120_000),
  );

  it("`--library @acme/charts` writes the `library` files at the folder's root with `.gitignore` and the agent files, and `package.json` names `@acme/charts`.", () => {
    const p = plan({ library: "@acme/charts" });
    expect(p.ok, p.text).toBe(true);
    expect(paths(p)).toEqual(librarySet());
    expect(json(p, "package.json").name).toBe("@acme/charts");
    expect(json(p, "package.json").keel).toBe("library");
    expect(p.files.get("AGENTS.md")).toContain("keel-library");
    expect(p.files.get("CLAUDE.md")).toBe("@AGENTS.md\n");
  });

  it("A `client` or `static` project has no file named `*.server.ts`, no `deploy/` folder, and no file outside `AGENTS.md` and `.claude/` holding `KEEL_SECRET`, `createApp` or `identity`.", () => {
    for (const adapter of ["client", "static"] as const) {
      const p = plan({ adapter });
      expect(p.ok, p.text).toBe(true);
      for (const [path, text] of p.files) {
        expect(path, path).not.toMatch(/\.server\.ts$/);
        expect(path.startsWith("deploy/"), path).toBe(false);
        if (path === "AGENTS.md" || path.startsWith(".claude/")) continue;
        for (const word of ["KEEL_SECRET", "createApp", "identity"])
          expect(text, `${path} ${word}`).not.toContain(word);
      }
    }
  });
});

describe("k.create createPlan: versions", () => {
  it("Every `@keel/*` entry of an app's `package.json` is create's version with no range, and `engines.node` is `>=22.15`.", () => {
    fc.assert(
      fc.property(version, fc.constantFrom<"client" | "static" | "node">("client", "static", "node"), (v, adapter) => {
        const p = plan({ version: v, adapter });
        expect(p.ok, p.text).toBe(true);
        const pkg = json(p, "package.json");
        let seen = 0;
        for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
          const deps = pkg[field];
          if (typeof deps !== "object" || deps === null) continue;
          for (const [k, range] of Object.entries(deps)) {
            if (!k.startsWith("@keel/")) continue;
            seen += 1;
            expect(range, `${field} ${k}`).toBe(v);
          }
        }
        expect(seen).toBeGreaterThan(0);
        const engines = pkg.engines;
        expect(typeof engines === "object" && engines !== null ? Reflect.get(engines, "node") : undefined).toBe(
          ">=22.15",
        );
      }),
      cfg,
    );
  });

  it("A library lists its `@keel/*` at `^<version>` (k.library-pack Scaffold), not the exact version.", () => {
    fc.assert(
      fc.property(version, (v) => {
        const p = plan({ version: v, library: "@acme/charts" });
        expect(p.ok, p.text).toBe(true);
        const pkg = json(p, "package.json");
        for (const field of ["peerDependencies", "devDependencies"]) {
          const deps = pkg[field];
          if (typeof deps !== "object" || deps === null) continue;
          for (const [k, range] of Object.entries(deps)) if (k.startsWith("@keel/")) expect(range, k).toBe(`^${v}`);
        }
      }),
      cfg,
    );
  });
});

/** The `paths` array (relative to the working folder, so `shop/` first: stripped, the spec fixes the three paths, not the prefix) of the E1361 diagnostic found anywhere in the JSON of a refused plan. */
const pathsOf = (text: string): string[] => {
  const find = (v: unknown): string[] | undefined => {
    if (Array.isArray(v)) {
      for (const x of v) {
        const r = find(x);
        if (r) return r;
      }
      return undefined;
    }
    if (typeof v !== "object" || v === null) return undefined;
    for (const [k, x] of Object.entries(v)) {
      if (k === "paths" && Array.isArray(x)) return x.map((v) => String(v).replace(/^shop\//, ""));
      const r = find(x);
      if (r) return r;
    }
    return undefined;
  };
  return find(JSON.parse(text)) ?? [];
};

describe("k.create createPlan: folder", () => {
  it("In a folder holding `notes.txt`, `create-app` reports E1360, exits 1 and writes nothing; in one holding only `.git` and `.DS_Store` it writes the project.", () => {
    fc.assert(
      fc.property(
        fc
          .stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]{0,12}$/)
          .filter((n) => ![".git", ".DS_Store", "Thumbs.db"].includes(n)),
        (entry) => {
          const refused = plan({ listing: [entry] });
          expect(refused.ok).toBe(false);
          expect(refused.text).toContain("E1360");
          expect(refused.text).toContain("--existing");
          expect(refused.files.size).toBe(0);
        },
      ),
      cfg,
    );
    const ok = plan({ listing: [".git/", ".git/HEAD", ".DS_Store", "Thumbs.db"] });
    expect(ok.ok, ok.text).toBe(true);
    expect(paths(ok)).toEqual(clientSet());
    expect(plan({ listing: ["notes.txt"] }).text).toContain("E1360");
  });

  it("With `--existing`, a folder holding `README.md` gets the project and its `README.md` unchanged, and one holding `package.json` gets E1361 naming `package.json`, one also holding `tokens.ts` and `topology.ts` one E1361 whose `paths` are the three; nothing is written.", () => {
    const ok = plan({ existing: true, listing: ["README.md"] });
    expect(ok.ok, ok.text).toBe(true);
    expect(ok.files.has("README.md")).toBe(false);
    expect(paths(ok)).toEqual(clientSet());
    const bad = plan({ existing: true, listing: ["package.json"] });
    expect(bad.ok).toBe(false);
    expect(bad.text).toContain("E1361");
    expect(bad.text).toContain("package.json");
    expect(bad.files.size).toBe(0);
    const three = plan({ existing: true, listing: ["topology.ts", "README.md", "tokens.ts", "package.json"] });
    expect(three.ok).toBe(false);
    expect(three.text).toContain("E1361");
    expect(pathsOf(three.text)).toEqual(["package.json", "tokens.ts", "topology.ts"]);
    expect(three.files.size).toBe(0);
  });

  it("Each file is created only where none is, and never replaced: for any path the plan writes, listing it with `--existing` is E1361 naming it and writes nothing.", () => {
    const writes = clientSet();
    fc.assert(
      fc.property(fc.constantFrom(...writes), fc.array(fc.constantFrom(...writes), { maxLength: 3 }), (hit, more) => {
        const p = plan({ existing: true, listing: [hit, ...more, "README.md"] });
        expect(p.ok).toBe(false);
        expect(p.text).toContain("E1361");
        const hits = [...new Set([hit, ...more])].sort();
        expect(p.text).toContain(hits[0] ?? hit);
        if (hits.length > 1) expect(pathsOf(p.text)).toEqual(hits);
        expect(p.files.size).toBe(0);
      }),
      cfg,
    );
  });
});

describe("k.create createPlan: names", () => {
  it("A folder `My Site` is E1352 whose message holds `--name my-site`; `--name vite` and `--library charts` are each E1352, nothing written.", () => {
    const site = plan({ folder: "My Site" });
    expect(site.ok).toBe(false);
    expect(site.text).toContain("E1352");
    expect(site.text).toContain("--name my-site");
    expect(site.files.size).toBe(0);
    const vite = plan({ name: "vite" });
    expect(vite.ok).toBe(false);
    expect(vite.text).toContain("E1352");
    const lib = plan({ library: "charts" });
    expect(lib.ok).toBe(false);
    expect(lib.text).toContain("E1352");
    expect(vite.files.size + lib.files.size).toBe(0);
  });

  it("The name is `[a-z][a-z0-9-]*`, at most 64 characters: any `--name` is accepted exactly when it fits, else E1352 with the fix `--name <n>`, `n` the name lowercased with each run of other characters one `-`.", () => {
    const anyName = fc.oneof(
      goodName,
      fc.stringMatching(/^[A-Za-z][A-Za-z0-9 _.-]{0,30}$/),
      fc.stringMatching(/^[0-9_ .][A-Za-z0-9 _.-]{0,10}$/),
    );
    fc.assert(
      fc.property(anyName, (name) => {
        const fits =
          /^[a-z][a-z0-9-]*$/.test(name) &&
          name.length <= 64 &&
          !["vite", "vitest", "typescript", "react"].includes(name);
        const p = plan({ name });
        expect(p.ok, `${name} ${p.text}`).toBe(fits);
        if (fits) {
          expect(json(p, "package.json").name).toBe(name);
          return;
        }
        expect(p.text).toContain("E1352");
        expect(p.files.size).toBe(0);
        const slug = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
        if (/^[a-z][a-z0-9-]*$/.test(slug) && slug.length <= 64) expect(p.text).toContain(`--name ${slug}`);
      }),
      cfg,
    );
  });

  it("A name over 64 characters is E1352; 64 is accepted.", () => {
    expect(plan({ name: `a${"b".repeat(63)}` }).ok).toBe(true);
    const long = plan({ name: `a${"b".repeat(64)}` });
    expect(long.ok).toBe(false);
    expect(long.text).toContain("E1352");
  });

  it("The name is the folder's last segment when `--name` is absent, and for `.` the last segment of its real path.", () => {
    fc.assert(
      fc.property(goodName, goodName, (parent, leaf) => {
        const nested = plan({ folder: `${parent}/${leaf}` });
        expect(json(nested, "package.json").name, nested.text).toBe(leaf);
        const dot = plan({ folder: ".", realPath: `/work/${parent}/${leaf}` });
        expect(json(dot, "package.json").name, dot.text).toBe(leaf);
        const named = plan({ folder: leaf, name: parent });
        expect(json(named, "package.json").name).toBe(parent);
      }),
      cfg,
    );
  });

  it("`--library` takes `@<scope>/<base>`, else E1352.", () => {
    for (const bad of [
      "charts",
      "@acme",
      "@acme/",
      "@/charts",
      "@Acme/charts",
      "@acme/Charts",
      "acme/charts",
      "@acme/a/b",
    ]) {
      const p = plan({ library: bad });
      expect(p.ok, bad).toBe(false);
      expect(p.text, bad).toContain("E1352");
      expect(p.files.size, bad).toBe(0);
    }
    expect(plan({ library: "@acme/keel-charts" }).ok).toBe(true);
  });
});

describe("k.create createPlan: Node", () => {
  it("`createPlan` given Node 22.14.0 returns E1362 and no file.", () => {
    const p = plan({ nodeVersion: "22.14.0" });
    expect(p.ok).toBe(false);
    expect(p.text).toContain("E1362");
    expect(p.text).toContain("22.15");
    expect(p.files.size).toBe(0);
  });

  it("A running Node older than 22.15 is E1362 before any other step; 22.15 and later are accepted.", () => {
    fc.assert(
      fc.property(fc.nat(40), fc.nat(40), fc.nat(40), (maj, min, pat) => {
        const older = maj < 22 || (maj === 22 && min < 15);
        // the folder is also non-empty, so a later step would refuse it with E1360: E1362 must come first
        const p = plan({ nodeVersion: `${maj}.${min}.${pat}`, listing: ["notes.txt"], name: "Bad Name" });
        if (older) {
          expect(p.text).toContain("E1362");
          expect(p.text).not.toContain("E1360");
        } else {
          expect(p.text).not.toContain("E1362");
        }
        const ok = plan({ nodeVersion: `${maj}.${min}.${pat}` });
        expect(ok.ok, `${maj}.${min}.${pat}`).toBe(!older);
      }),
      cfg,
    );
  });
});

describe("k.create createPlan: package manager", () => {
  it('With `npm_config_user_agent` `npm/10.9.0 node/v22.15.0`, `package.json` has `packageManager: "npm@10.9.0"`, the CI workflow runs `npm ci`, and the next records are `npm install` and `npx --no keel dev`, `check`, `test`, `build`.', () => {
    const p = plan({ userAgent: "npm/10.9.0 node/v22.15.0" });
    expect(p.ok, p.text).toBe(true);
    expect(json(p, "package.json").packageManager).toBe("npm@10.9.0");
    expect(p.files.get(".github/workflows/ci.yml")).toContain("npm ci");
    expect(p.files.get(".github/workflows/ci.yml")).toContain("package-lock.json");
    const cmds = commands(p);
    expect(cmds).toContain("npm install");
    expect(cmds.slice(cmds.indexOf("npm install") + 1)).toEqual([
      "npx --no keel dev",
      "npx --no keel check",
      "npx --no keel test",
      "npx --no keel build",
    ]);
  });

  it("With `yarn/4.5.0`, `.yarnrc.yml` holds `nodeLinker: node-modules`; with no user agent, `package.json` has no `packageManager` and the commands are pnpm's.", () => {
    const y = plan({ userAgent: "yarn/4.5.0 npm/? node/v22.15.0" });
    expect(y.ok, y.text).toBe(true);
    expect(y.files.get(".yarnrc.yml")).toContain("nodeLinker: node-modules");
    expect(json(y, "package.json").packageManager).toBe("yarn@4.5.0");
    expect(paths(y)).toEqual(sorted([...clientSet(), ".yarnrc.yml"]));
    expect(commands(y)).toContain("yarn install");
    expect(commands(y)).toContain("yarn keel dev");
    const none = plan({});
    expect(json(none, "package.json")).not.toHaveProperty("packageManager");
    expect(commands(none)).toContain("pnpm install");
    expect(commands(none).slice(-4)).toEqual(["pnpm keel dev", "pnpm keel check", "pnpm keel test", "pnpm keel build"]);
  });

  it("Each manager's install, command, CI install and lockfile follow the table; no lockfile is written; an unrecognised manager gets pnpm's.", () => {
    const table: [string, string, string, string, string][] = [
      ["pnpm", "pnpm install", "pnpm keel", "pnpm install --frozen-lockfile", "pnpm-lock.yaml"],
      ["npm", "npm install", "npx --no keel", "npm ci", "package-lock.json"],
      ["yarn", "yarn install", "yarn keel", "yarn install --immutable", "yarn.lock"],
      ["bun", "bun install", "bun run keel", "bun install --frozen-lockfile", "bun.lock"],
    ];
    fc.assert(
      fc.property(fc.constantFrom(...table), version, (row, v) => {
        const [m, install, cmd, ci, lock] = row;
        const p = plan({ userAgent: `${m}/${v} node/v22.15.0` });
        expect(p.ok, p.text).toBe(true);
        expect(json(p, "package.json").packageManager).toBe(`${m}@${v}`);
        const c = commands(p);
        expect(c).toContain(install);
        for (const sub of ["dev", "check", "test", "build"]) expect(c).toContain(`${cmd} ${sub}`);
        const wf = p.files.get(".github/workflows/ci.yml") ?? "";
        expect(wf).toContain(ci);
        expect(wf).toContain(lock);
        for (const l of ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb"])
          expect(p.files.has(l), l).toBe(false);
      }),
      cfg,
    );
    const other = plan({ userAgent: "deno/2.0.0 node/v22.15.0" });
    expect(commands(other)).toContain("pnpm install");
    expect(other.ok).toBe(true);
  });

  it("yarn 1 installs in CI with `--frozen-lockfile`.", () => {
    const p = plan({ userAgent: "yarn/1.22.22 npm/? node/v22.15.0" });
    expect(p.files.get(".github/workflows/ci.yml")).toContain("yarn install --frozen-lockfile");
  });
});

describe("k.create createPlan: workspace", () => {
  const ws = { "pnpm-workspace.yaml": "packages:\n  - apps/*\n" };

  it("Below a folder whose `pnpm-workspace.yaml` lists `apps/*`, `create-app apps/b` writes no `turbo.json`, CI workflow or `packageManager`, and its install record has `dir` `../..`; `create-app tools/b` there reports W1364 and writes the project.", () => {
    const inside = plan({ folder: "apps/b", ancestors: ws, userAgent: PNPM });
    expect(inside.ok, inside.text).toBe(true);
    expect(inside.files.has("turbo.json")).toBe(false);
    expect([...inside.files.keys()].some((f) => f.startsWith(".github/"))).toBe(false);
    expect(json(inside, "package.json")).not.toHaveProperty("packageManager");
    expect(inside.text).not.toContain("W1364");
    const install = inside.records.find((r) => r.kind === "create.next" && r.command === "pnpm install");
    expect(install?.dir).toBe("../..");
    const outside = plan({ folder: "tools/b", ancestors: ws, userAgent: PNPM });
    expect(outside.ok, outside.text).toBe(true);
    expect(outside.text).toContain("W1364");
    expect(outside.files.size).toBeGreaterThan(0);
    expect(outside.files.has("package.json")).toBe(true);
  });

  it("Inside a workspace an app has no `.yarnrc.yml` and drops exactly `turbo.json` and the CI workflow; every other `client` path is kept.", () => {
    const p = plan({ folder: "apps/b", ancestors: ws, userAgent: "yarn/4.5.0 node/v22.15.0" });
    expect(paths(p)).toEqual(sorted(clientSet().filter((f) => f !== "turbo.json" && f !== ".github/workflows/ci.yml")));
  });

  it("The workspace root is found by `pnpm-workspace.yaml` or a `package.json` with `workspaces`, and the folder is judged against the globs `*`, `**` and `!`.", () => {
    const pkg = (w: string[]): Record<string, string> => ({
      "package.json": JSON.stringify({ name: "root", workspaces: w }),
    });
    const cases: [Record<string, string>, string, boolean][] = [
      [pkg(["apps/*"]), "apps/b", true],
      [pkg(["apps/*"]), "tools/b", false],
      [pkg(["packages/**"]), "packages/x/y", true],
      [pkg(["apps/*", "!apps/skip"]), "apps/skip", false],
      [{ "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - '!apps/skip'\n" }, "apps/ok", true],
      [{ "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - '!apps/skip'\n" }, "apps/skip", false],
    ];
    for (const [anc, folder, member] of cases) {
      const p = plan({ folder, ancestors: anc });
      expect(p.ok, `${folder} ${p.text}`).toBe(true);
      expect(p.text.includes("W1364"), `${folder}`).toBe(!member);
      expect(p.files.has("turbo.json"), `${folder} turbo`).toBe(false);
      expect(p.files.size, folder).toBeGreaterThan(0);
    }
  });

  it("With `node_modules/@keel/cli` at another version above the target, `create-app` reports E1363 naming both versions and writes nothing.", () => {
    fc.assert(
      fc.property(version, version, (mine, theirs) => {
        fc.pre(mine !== theirs);
        const p = plan({
          version: mine,
          folder: "shop",
          ancestors: { "node_modules/@keel/cli/package.json": JSON.stringify({ name: "@keel/cli", version: theirs }) },
        });
        expect(p.ok).toBe(false);
        expect(p.text).toContain("E1363");
        expect(p.text).toContain(mine);
        expect(p.text).toContain(theirs);
        expect(p.text).toContain(`@keel/app@${theirs}`);
        expect(p.files.size).toBe(0);
      }),
      cfg,
    );
    const same = plan({
      version: VERSION,
      ancestors: { "node_modules/@keel/cli/package.json": JSON.stringify({ name: "@keel/cli", version: VERSION }) },
    });
    expect(same.ok, same.text).toBe(true);
  });
});

describe("k.create createPlan: flags", () => {
  it("`--adapter node --library @a/b`, a second folder argument and `--nope` are each E1052, exit 2, nothing written (the plan's share: `--adapter` with `--library`).", () => {
    for (const adapter of ["client", "node", "static"] as const) {
      const p = plan({ adapter, library: "@a/b" });
      expect(p.ok, adapter).toBe(false);
      expect(p.text, adapter).toContain("E1052");
      expect(p.files.size).toBe(0);
    }
    expect(plan({ library: "@a/b" }).ok).toBe(true);
  });
});

describe("k.create createPlan: next records", () => {
  it("Each written file is a `scaffold.edit` record (`create <path>`), sorted; then the `create.next` records: `cd <folder>`, `git init`, the install, `keel dev`, `check`, `test`, `build`.", () => {
    const p = plan({ folder: "shop", userAgent: PNPM });
    const edits = p.records.filter((r) => r.kind === "scaffold.edit");
    expect(edits.map((r) => `${r.action} ${r.path}`)).toEqual(clientSet().map((f) => `create ${f}`));
    expect(p.records.slice(0, edits.length)).toEqual(edits);
    expect(commands(p)).toEqual([
      "cd shop",
      "git init",
      "pnpm install",
      "pnpm keel dev",
      "pnpm keel check",
      "pnpm keel test",
      "pnpm keel build",
    ]);
    expect(p.records.slice(edits.length).every((r) => r.kind === "create.next")).toBe(true);
  });

  it("There is no `cd` for `.`, no `git init` when a `.git` is at or above the folder, and a library ends `keel check`, `keel test`, `keel pack`.", () => {
    const dot = plan({ folder: ".", realPath: "/w/shop", userAgent: PNPM });
    expect(commands(dot)[0]).toBe("git init");
    const git = plan({ folder: "shop", gitAbove: true, userAgent: PNPM });
    expect(commands(git)).toEqual([
      "cd shop",
      "pnpm install",
      "pnpm keel dev",
      "pnpm keel check",
      "pnpm keel test",
      "pnpm keel build",
    ]);
    const lib = plan({ library: "@acme/charts", userAgent: PNPM });
    expect(commands(lib).slice(-3)).toEqual(["pnpm keel check", "pnpm keel test", "pnpm keel pack"]);
  });

  it("No printed command fetches a package the project's install did not: no `npx` without `--no`, no `dlx`, no `create`, no `add`.", () => {
    for (const m of ["pnpm", "npm", "yarn", "bun"]) {
      for (const extra of [{}, { library: "@acme/charts" }]) {
        const p = plan({ userAgent: ua(m), ...extra });
        for (const c of commands(p)) {
          expect(c, c).not.toMatch(/\bdlx\b|\bcreate\b|\badd\b|\bbunx\b/);
          if (c.startsWith("npx")) expect(c).toContain("--no");
        }
      }
    }
  });
});

describe("k.create createPlan: rule codes and their fixes", () => {
  it("E1360 the folder holds files (fix: name a new folder, or add `--existing`)", () => {
    const p = plan({ listing: ["notes.txt"] });
    expect(p.text).toContain("E1360");
    expect(p.text).toMatch(/new folder/);
    expect(p.text).toContain("--existing");
    expect(p.files.size).toBe(0);
  });

  it("E1361 `--existing` and a file the project writes exists (fix: move it aside, or use a new folder)", () => {
    const p = plan({ existing: true, listing: ["tokens.ts"] });
    expect(p.text).toContain("E1361");
    expect(p.text).toContain("tokens.ts");
    expect(p.text).toMatch(/move it aside/);
    expect(p.text).toMatch(/new folder/);
  });

  it("E1362 Node older than 22.15 (fix: install Node 22.15 or later)", () => {
    const p = plan({ nodeVersion: "20.11.0" });
    expect(p.text).toContain("E1362");
    expect(p.text).toMatch(/Node 22\.15 or later/);
  });

  it("E1363 the workspace has `@keel/cli` at another version (fix: `pnpm create @keel/app@<that version>`)", () => {
    const p = plan({
      version: "0.4.2",
      ancestors: { "node_modules/@keel/cli/package.json": JSON.stringify({ name: "@keel/cli", version: "0.3.9" }) },
    });
    expect(p.text).toContain("E1363");
    expect(p.text).toContain("pnpm create @keel/app@0.3.9");
  });

  it("W1364 the workspace's package globs leave the folder out (fix: add it to them)", () => {
    const p = plan({ folder: "tools/b", ancestors: { "pnpm-workspace.yaml": "packages:\n  - apps/*\n" } });
    expect(p.ok).toBe(true);
    expect(p.text).toContain("W1364");
    expect(p.text).toMatch(/add it to/i);
  });

  it("E1365, E1352, E1052 and E1357: the write failure and the link refusal belong to the bin (create-bin.test.ts); the name and flag codes are asserted above.", () => {
    // Untestable on a pure plan: a write failing and a link carrying a write out of the folder need a file system.
    expect(plan({ name: "Bad Name" }).text).toContain("E1352");
    expect(plan({ adapter: "node", library: "@a/b" }).text).toContain("E1052");
  });
});
