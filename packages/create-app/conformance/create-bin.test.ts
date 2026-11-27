// The `create-app` bin as a child process (see create-bin-support.ts). Seed 1337 (the property over project names and folders; every other case an example).
// Spec: k.create, clause "With standard input an open pipe that nothing writes and no terminal, `create-app shop` in an empty folder exits 0 and writes `shop/`."
// Spec: k.create, clause "`create-app` with no argument, in an empty folder `shop`, writes the project into it, named `shop`."
// Spec: k.create, clause "The default project's files are exactly the `client` row, with one `.claude/skills/<name>/SKILL.md` per skill `keel docs` lists."
// Spec: k.create, clause "`--adapter static` writes the same paths with `adapter: \"static\"` in `topology.ts`; `--adapter node` adds exactly `modules/app/loadHome.server.ts`, `deploy/web/Dockerfile` and `deploy/compose.yaml`."
// Spec: k.create, clause "For each adapter the tree equals, byte for byte, the one `keel scaffold project` writes with that adapter from a `@keel/cli` of create's version and the same `npm_config_user_agent`."
// Spec: k.create, clause "Every `@keel/*` entry of an app's `package.json` is create's version with no range, and `engines.node` is `>=22.15`."
// Spec: k.create, clause "A `client` or `static` project has no file named `*.server.ts`, no `deploy/` folder, and no file outside `AGENTS.md` and `.claude/` holding `KEEL_SECRET`, `createApp` or `identity`."
// Spec: k.create, clause "`--library @acme/charts` writes the `library` files at the folder's root with `.gitignore` and the agent files, and `package.json` names `@acme/charts`."
// Spec: k.create, clause "In a folder holding `notes.txt`, `create-app` reports E1360, exits 1 and writes nothing; in one holding only `.git` and `.DS_Store` it writes the project."
// Spec: k.create, clause "With `--existing`, a folder holding `README.md` gets the project and its `README.md` unchanged, and one holding `package.json` gets E1361 naming `package.json` and nothing written."
// Spec: k.create, clause "Run by a user whom file modes bind (not root), with `--existing` and an empty read-only `public/`, `create-app` reports E1365 naming `public/keel-mark.svg` and leaves the folder as it was."
// Spec: k.create, clause "A folder `My Site` is E1352 whose message holds `--name my-site`; `--name vite` and `--library charts` are each E1352, nothing written."
// Spec: k.create, clause "With `npm_config_user_agent` `npm/10.9.0 node/v22.15.0`, `package.json` has `packageManager: \"npm@10.9.0\"`, the CI workflow runs `npm ci`, and the next records are `npm install` and `npx --no keel dev`, `check`, `test`, `build`."
// Spec: k.create, clause "Below a folder whose `pnpm-workspace.yaml` lists `apps/*`, `create-app apps/b` writes no `turbo.json`, CI workflow or `packageManager`, and its install record has `dir` `../..`; `create-app tools/b` there reports W1364 and writes the project."
// Spec: k.create, clause "With `node_modules/@keel/cli` at another version above the target, `create-app` reports E1363 naming both versions and writes nothing."
// Spec: k.create, clause "`--adapter node --library @a/b`, a second folder argument and `--nope` are each E1052, exit 2, nothing written."
// Spec: k.create, clause "Run as `node --permission` with reads allowed, writes allowed only in the folder, addons allowed and no child process or worker, `create-app shop` exits 0 and writes the project."
// Spec: k.create, clause "In compact a run prints one `create <path>` line per file, then the `next` lines, then `ok create shop client <n> created`, with no ANSI escape; `--format=json` prints one record per line ending in `summary`; `--dry-run` prints the same records and writes nothing."
// Spec: k.create, clause "`@keel/create-app`'s `skills/<name>/SKILL.md` equal `keel docs <name>` of `@keel/cli` at the same version, byte for byte."
// Spec: k.create, clause "From the packed tarballs, in an empty folder, `client`, `static` and `node` each after its install pass `keel check`, `keel test` and `keel build`, `--library` passes `keel check`, `keel test`, `keel pack` and then `keel pack --check`, and in each `keel docs --sync` writes nothing."
// k.create, Not done "It starts no process (no install, no `git init`), opens no connection, reads no environment value but `npm_config_user_agent`, `KEEL_AGENT` and `CI`, writes only inside the folder and reads outside it only the files Workspace names. The proof of the first two is a run under Node's permission model (Conformance) with writes granted only in the folder and no child process or worker granted (from Node 25, no network either): Node refuses each such call, and a refused call ends the run with a nonzero exit, so its exit 0 is the proof."
// k.create, Rules "E1360 the folder holds files (fix: name a new folder, or add `--existing`)"
// k.create, Rules "E1361 `--existing` and a file the project writes exists (fix: move it aside, or use a new folder)"
// k.create, Rules "E1363 the workspace has `@keel/cli` at another version (fix: `pnpm create @keel/app@<that version>`)"
// k.create, Rules "W1364 the workspace's package globs leave the folder out (fix: add it to them)"
// k.create, Rules "E1365 a write failed; this run's files are removed (fix: free the path or its permission). Names are E1352, flags E1052 (`--adapter` with `--library`, a second folder, an unknown flag), links E1357."
// ASSUMPTIONS and limits (spec silent or untestable, readings asserted):
// - "starts no process", "opens no connection": the spec states one seam, Node's permission model (the permission-model clause: no child process or worker granted). The
//   Node 25 network grant is not named in the spec, so no case withholds it separately; the same run is what a Node 25 permission run without `--allow-net` is. What else can be asserted is
//   asserted: no `node_modules`, no `.git`, no lockfile after a run, and nothing written beside the folder. "reads no environment value but ..." and "reads outside it only the files Workspace names" are untestable from outside (no seam names them).
// - The clause 22 text is cut across two files: the packed-tarball half is tooling/smoke/create.mjs (a smoke, it needs the packed kit). Here each kind is created beside a `node_modules` linked to the repo
//   (create's version and the cli's are both the repo's), then `keel check`, `keel test`, `keel build` (apps) and `keel docs --sync` run over it. For the library the clause runs `keel pack` and then `keel pack --check`, both exit 0 (k.library-pack:
//   `keel pack --check` is E1164 until `keel pack` writes the ledger).
// - E1365 needs a write that fails: the folder holds an empty `public/` with mode 0555 (a user that bypasses file modes, such as root, cannot fail it).
// - compact has no ANSI escape: the output holds no ESC (U+001B) character.
// - `create <path>` lines are sorted by plain string order of the path.
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { testTime } from "@keel/tooling/test-time";
import {
  KEEL_BIN,
  NODE_EXTRA,
  PNPM,
  REPO,
  SEED,
  cleanAll,
  clientSet,
  createVersion,
  entries,
  envOf,
  keel,
  link,
  nodeSet,
  put,
  readJson,
  records,
  run,
  sandbox,
  skillNames,
  skillPaths,
  sorted,
  tree,
} from "./create-bin-support.ts";
import { spawnSync } from "node:child_process";

afterAll(cleanAll);
const T = testTime(60_000);
const SLOW = testTime(300_000);
const keys = (m: Map<string, string>): string[] => sorted([...m.keys()]);

describe("create-app: it asks nothing", () => {
  it(
    "With standard input an open pipe that nothing writes and no terminal, `create-app shop` in an empty folder exits 0 and writes `shop/`.",
    async () => {
      const cwd = sandbox();
      const r = await run(["shop"], cwd, { stdin: "open" });
      expect(r.status, r.out).toBe(0);
      expect(keys(tree(join(cwd, "shop")))).toEqual(clientSet());
    },
    T,
  );

  it(
    "with standard input a closed pipe, `create-app shop` also exits 0 and writes `shop/`",
    async () => {
      const cwd = sandbox();
      const r = await run(["shop"], cwd, { stdin: "closed" });
      expect(r.status, r.out).toBe(0);
      expect(keys(tree(join(cwd, "shop")))).toEqual(clientSet());
    },
    T,
  );

  it(
    "`create-app` with no argument, in an empty folder `shop`, writes the project into it, named `shop`.",
    async () => {
      const cwd = sandbox();
      const shop = join(cwd, "shop");
      mkdirSync(shop);
      const r = await run([], shop);
      expect(r.status, r.out).toBe(0);
      expect(readJson(tree(shop).get("package.json")).name).toBe("shop");
      expect(keys(tree(shop))).toEqual(clientSet());
    },
    T,
  );
});

describe("create-app: files per kind", () => {
  it(
    "The default project's files are exactly the `client` row, with one `.claude/skills/<name>/SKILL.md` per skill `keel docs` lists.",
    async () => {
      const cwd = sandbox();
      const r = await run(["shop"], cwd);
      expect(r.status, r.out).toBe(0);
      expect(keys(tree(join(cwd, "shop")))).toEqual(clientSet());
      expect(skillPaths().length).toBe(skillNames().length);
      expect(skillNames().length).toBeGreaterThan(0);
    },
    T,
  );

  it(
    '`--adapter static` writes the same paths with `adapter: "static"` in `topology.ts`; `--adapter node` adds exactly `modules/app/loadHome.server.ts`, `deploy/web/Dockerfile` and `deploy/compose.yaml`.',
    async () => {
      const cwd = sandbox();
      const s = await run(["site", "--adapter", "static"], cwd);
      expect(s.status, s.out).toBe(0);
      const site = tree(join(cwd, "site"));
      expect(keys(site)).toEqual(clientSet());
      expect(site.get("topology.ts")).toMatch(/adapter:\s*['"]static['"]/);
      const n = await run(["web", "--adapter", "node"], cwd);
      expect(n.status, n.out).toBe(0);
      const web = tree(join(cwd, "web"));
      expect(keys(web)).toEqual(nodeSet());
      expect(keys(web).filter((p) => !clientSet().includes(p))).toEqual(sorted(NODE_EXTRA));
    },
    T,
  );

  it(
    "For each adapter the tree equals, byte for byte, the one `keel scaffold project` writes with that adapter from a `@keel/cli` of create's version and the same `npm_config_user_agent`.",
    async () => {
      for (const adapter of ["client", "static", "node"]) {
        const cwd = sandbox();
        const made = await run(["shop", "--adapter", adapter], cwd);
        expect(made.status, made.out).toBe(0);
        const other = sandbox();
        link(other);
        const env = envOf(PNPM);
        const r = spawnSync(
          process.execPath,
          [KEEL_BIN, "scaffold", "project", "shop", "--adapter", adapter, "--format=json"],
          {
            cwd: other,
            encoding: "utf8",
            env,
          },
        );
        expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
        const a = tree(join(cwd, "shop"));
        const b = tree(join(other, "shop"));
        expect(keys(a), adapter).toEqual(keys(b));
        for (const [p, text] of a) expect(text, `${adapter} ${p}`).toBe(b.get(p));
      }
    },
    SLOW,
  );

  it(
    "Every `@keel/*` entry of an app's `package.json` is create's version with no range, and `engines.node` is `>=22.15`.",
    async () => {
      const cwd = sandbox();
      const r = await run(["shop"], cwd);
      expect(r.status, r.out).toBe(0);
      const pkg = readJson(tree(join(cwd, "shop")).get("package.json"));
      let seen = 0;
      for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
        const deps = pkg[field];
        if (typeof deps !== "object" || deps === null) continue;
        for (const [k, range] of Object.entries(deps)) {
          if (!k.startsWith("@keel/")) continue;
          seen += 1;
          expect(range, `${field} ${k}`).toBe(createVersion());
        }
      }
      expect(seen).toBeGreaterThan(0);
      const engines = pkg.engines;
      expect(typeof engines === "object" && engines !== null ? Reflect.get(engines, "node") : undefined).toBe(
        ">=22.15",
      );
    },
    T,
  );

  it(
    "A `client` or `static` project has no file named `*.server.ts`, no `deploy/` folder, and no file outside `AGENTS.md` and `.claude/` holding `KEEL_SECRET`, `createApp` or `identity`.",
    async () => {
      const cwd = sandbox();
      for (const adapter of ["client", "static"]) {
        const r = await run([adapter, "--adapter", adapter], cwd);
        expect(r.status, r.out).toBe(0);
        for (const [p, text] of tree(join(cwd, adapter))) {
          expect(p, p).not.toMatch(/\.server\.ts$/);
          expect(p.startsWith("deploy/"), p).toBe(false);
          if (p === "AGENTS.md" || p.startsWith(".claude/")) continue;
          for (const w of ["KEEL_SECRET", "createApp", "identity"]) expect(text, `${p} ${w}`).not.toContain(w);
        }
      }
    },
    T,
  );

  it(
    "`--library @acme/charts` writes the `library` files at the folder's root with `.gitignore` and the agent files, and `package.json` names `@acme/charts`.",
    async () => {
      const cwd = sandbox();
      const r = await run(["charts", "--library", "@acme/charts"], cwd);
      expect(r.status, r.out).toBe(0);
      const t = tree(join(cwd, "charts"));
      const lib = [
        "package.json",
        "module.ts",
        "src/index.ts",
        "src/Example.tsx",
        "test/Example.test.ts",
        "tokens.ts",
        "tsconfig.json",
        "tsconfig.build.json",
        "vitest.config.ts",
        "README.md",
      ];
      expect(keys(t)).toEqual(sorted([...lib, ".gitignore", "AGENTS.md", "CLAUDE.md", ...skillPaths()]));
      expect(readJson(t.get("package.json")).name).toBe("@acme/charts");
      expect(t.get("AGENTS.md")).toContain("keel-library");
    },
    T,
  );

  it(
    "`@keel/create-app`'s `skills/<name>/SKILL.md` equal `keel docs <name>` of `@keel/cli` at the same version, byte for byte.",
    async () => {
      // the shipped copies (`prepack`'s `skills/` in the package) and the copies written into a project
      const shipped = join(REPO, "packages/create-app/skills");
      expect(
        existsSync(shipped),
        "packages/create-app/skills is absent: it is copied from packages/cli/skills by prepack",
      ).toBe(true);
      expect(readdirSync(shipped).sort()).toEqual(skillNames());
      const dir = sandbox();
      link(dir);
      put(
        dir,
        "package.json",
        `${JSON.stringify({ name: "x", version: "0.0.0", dependencies: { "@keel/cli": "*" } })}\n`,
      );
      const cwd = sandbox();
      const r = await run(["shop"], cwd);
      expect(r.status, r.out).toBe(0);
      const written = tree(join(cwd, "shop"));
      for (const n of skillNames()) {
        const doc = keel(dir, ["docs", n]).records.find((x) => x.kind === "docs.skill");
        expect(typeof doc?.text, n).toBe("string");
        expect(readFileSync(join(shipped, n, "SKILL.md"), "utf8"), n).toBe(doc?.text);
        expect(written.get(`.claude/skills/${n}/SKILL.md`), n).toBe(doc?.text);
      }
    },
    T,
  );
});

describe("create-app: the folder", () => {
  it(
    "In a folder holding `notes.txt`, `create-app` reports E1360, exits 1 and writes nothing; in one holding only `.git` and `.DS_Store` it writes the project.",
    async () => {
      const cwd = sandbox();
      put(cwd, "shop/notes.txt", "keep\n");
      const before = entries(join(cwd, "shop"));
      const r = await run(["shop"], cwd);
      expect(r.status).toBe(1);
      expect(r.out).toContain("E1360");
      expect(r.out).toContain("--existing");
      expect(entries(join(cwd, "shop"))).toEqual(before);
      const ok = sandbox();
      mkdirSync(join(ok, "shop/.git"), { recursive: true });
      put(ok, "shop/.DS_Store", "x");
      const g = await run(["shop"], ok);
      expect(g.status, g.out).toBe(0);
      expect(keys(tree(join(ok, "shop"))).filter((p) => p !== ".DS_Store")).toEqual(clientSet());
    },
    T,
  );

  it(
    "With `--existing`, a folder holding `README.md` gets the project and its `README.md` unchanged, and one holding `package.json` gets E1361 naming `package.json` and nothing written.",
    async () => {
      const cwd = sandbox();
      put(cwd, "shop/README.md", "mine\n");
      const r = await run(["shop", "--existing"], cwd);
      expect(r.status, r.out).toBe(0);
      const t = tree(join(cwd, "shop"));
      expect(t.get("README.md")).toBe("mine\n");
      expect(keys(t).filter((p) => p !== "README.md")).toEqual(clientSet());
      const other = sandbox();
      put(other, "shop/package.json", '{"name":"mine"}\n');
      const before = entries(join(other, "shop"));
      const bad = await run(["shop", "--existing"], other);
      expect(bad.status).toBe(1);
      expect(bad.out).toContain("E1361");
      expect(bad.out).toContain("package.json");
      expect(entries(join(other, "shop"))).toEqual(before);
      expect(tree(join(other, "shop")).get("package.json")).toBe('{"name":"mine"}\n');
    },
    T,
  );

  it(
    "Run by a user whom file modes bind (not root), with `--existing` and an empty read-only `public/`, `create-app` reports E1365 naming `public/keel-mark.svg` and leaves the folder as it was.",
    async () => {
      const cwd = sandbox();
      const shop = join(cwd, "shop");
      mkdirSync(join(shop, "public"), { recursive: true });
      chmodSync(join(shop, "public"), 0o555);
      const before = entries(shop);
      try {
        const r = await run(["shop", "--existing"], cwd);
        expect(r.status).toBe(1);
        expect(r.out).toContain("E1365");
        expect(r.out).toContain("public/keel-mark.svg");
        expect(entries(shop)).toEqual(before);
      } finally {
        chmodSync(join(shop, "public"), 0o755);
      }
    },
    T,
  );

  it(
    "E1357: a write a link carries out of the folder is refused, naming nothing written outside (Writes are judged as k.scaffold Links says)",
    async () => {
      // k.create Rules: "links E1357"; k.scaffold Links: a target whose nearest existing ancestor's real path is outside the root refuses the whole set.
      const cwd = sandbox();
      const outside = join(cwd, "outside");
      mkdirSync(outside);
      mkdirSync(join(cwd, "shop"));
      symlinkSync(outside, join(cwd, "shop/public"));
      const r = await run(["shop", "--existing"], cwd);
      expect(r.status).toBe(1);
      expect(r.out).toContain("E1357");
      expect(entries(outside)).toEqual([]);
      expect(entries(join(cwd, "shop"))).toEqual(["public"]);
    },
    T,
  );

  it(
    "Names: a folder `My Site` is E1352 whose message holds `--name my-site`; `--name vite` and `--library charts` are each E1352, nothing written.",
    async () => {
      const cwd = sandbox();
      const a = await run(["My Site"], cwd);
      expect(a.status).toBe(1);
      expect(a.out).toContain("E1352");
      expect(a.out).toContain("--name my-site");
      const b = await run(["shop", "--name", "vite"], cwd);
      expect(b.status).toBe(1);
      expect(b.out).toContain("E1352");
      const c = await run(["lib", "--library", "charts"], cwd);
      expect(c.status).toBe(1);
      expect(c.out).toContain("E1352");
      expect(entries(cwd)).toEqual([]);
    },
    T,
  );

  it(
    "A project name or folder is accepted exactly when it fits `[a-z][a-z0-9-]*` of at most 64 characters, else E1352 and nothing written (property).",
    async () => {
      const names = fc.oneof(
        fc
          .stringMatching(/^[a-z][a-z0-9-]{0,20}$/)
          .filter((n) => !["vite", "vitest", "typescript", "react"].includes(n)),
        fc.stringMatching(/^[A-Z][a-zA-Z0-9]{0,10}$/),
        fc.stringMatching(/^[0-9][a-z0-9]{0,10}$/),
      );
      const samples = fc.sample(names, { seed: SEED, numRuns: 8 });
      for (const name of samples) {
        const cwd = sandbox();
        const fits = /^[a-z][a-z0-9-]*$/.test(name);
        const asFolder = await run([name], cwd);
        expect(asFolder.status, `${name} ${asFolder.out}`).toBe(fits ? 0 : 1);
        if (!fits) {
          expect(asFolder.out).toContain("E1352");
          expect(entries(cwd)).toEqual([]);
        } else {
          expect(readJson(tree(join(cwd, name)).get("package.json")).name).toBe(name);
        }
        const dir2 = sandbox();
        const asName = await run(["proj", "--name", name], dir2);
        expect(asName.status, `${name} ${asName.out}`).toBe(fits ? 0 : 1);
      }
    },
    SLOW,
  );
});

describe("create-app: package manager and workspace", () => {
  it(
    'With `npm_config_user_agent` `npm/10.9.0 node/v22.15.0` the bin writes `packageManager: "npm@10.9.0"` and prints `next npm install` (the plan\'s share is in create-plan.test.ts).',
    async () => {
      // Clause 14 text is `With npm_config_user_agent npm/10.9.0 ...`; the bin reads the variable and nothing else of the environment.
      const cwd = sandbox();
      const r = await run(["shop", "--format=compact"], cwd, { userAgent: "npm/10.9.0 node/v22.15.0" });
      expect(r.status, r.out).toBe(0);
      const t = tree(join(cwd, "shop"));
      expect(readJson(t.get("package.json")).packageManager).toBe("npm@10.9.0");
      expect(t.get(".github/workflows/ci.yml")).toContain("npm ci");
      expect(r.stdout.split("\n")).toContain("next npm install");
      expect(r.stdout.split("\n")).toContain("next npx --no keel dev");
    },
    T,
  );

  it(
    "Below a folder whose `pnpm-workspace.yaml` lists `apps/*`, `create-app apps/b` writes no `turbo.json`, CI workflow or `packageManager`, and its install record has `dir` `../..`; `create-app tools/b` there reports W1364 and writes the project.",
    async () => {
      const cwd = sandbox();
      put(cwd, "pnpm-workspace.yaml", "packages:\n  - apps/*\n");
      const r = await run(["apps/b"], cwd);
      expect(r.status, r.out).toBe(0);
      const t = tree(join(cwd, "apps/b"));
      expect(t.has("turbo.json")).toBe(false);
      expect(keys(t).some((p) => p.startsWith(".github/"))).toBe(false);
      expect(readJson(t.get("package.json"))).not.toHaveProperty("packageManager");
      expect(r.stdout.split("\n")).toContain("next pnpm install (in ../..)");
      const j = await run(["apps/c", "--format=json"], cwd);
      const install = records(j.stdout).find((x) => x.kind === "create.next" && x.command === "pnpm install");
      expect(install?.dir).toBe("../..");
      const o = await run(["tools/b"], cwd);
      expect(o.status, o.out).toBe(0);
      expect(o.out).toContain("W1364");
      expect(tree(join(cwd, "tools/b")).has("package.json")).toBe(true);
    },
    T,
  );

  it(
    "With `node_modules/@keel/cli` at another version above the target, `create-app` reports E1363 naming both versions and writes nothing.",
    async () => {
      const cwd = sandbox();
      put(cwd, "node_modules/@keel/cli/package.json", `${JSON.stringify({ name: "@keel/cli", version: "9.8.7" })}\n`);
      const before = entries(cwd);
      const r = await run(["shop"], cwd);
      expect(r.status).toBe(1);
      expect(r.out).toContain("E1363");
      expect(r.out).toContain("9.8.7");
      expect(r.out).toContain(createVersion());
      expect(r.out).toContain("pnpm create @keel/app@9.8.7");
      expect(entries(cwd)).toEqual(before);
    },
    T,
  );
});

describe("create-app: usage errors", () => {
  it(
    "`--adapter node --library @a/b`, a second folder argument and `--nope` are each E1052, exit 2, nothing written.",
    async () => {
      for (const args of [
        ["x", "--adapter", "node", "--library", "@a/b"],
        ["one", "two"],
        ["x", "--nope"],
      ]) {
        const cwd = sandbox();
        const r = await run(args, cwd);
        expect(r.status, args.join(" ")).toBe(2);
        expect(r.out, args.join(" ")).toContain("E1052");
        expect(entries(cwd), args.join(" ")).toEqual([]);
      }
    },
    T,
  );
});

describe("create-app: what it does not do", () => {
  it(
    "Run as `node --permission` with reads allowed, writes allowed only in the folder, addons allowed and no child process or worker, `create-app shop` exits 0 and writes the project.",
    async () => {
      const cwd = realpathSync(sandbox());
      const shop = join(cwd, "shop");
      // Node's `--allow-fs-write=<path>` grants that path alone; the folder's contents are granted by `<path>/*`. The folder is not made yet, so both are given.
      const grant = [
        "--permission",
        "--allow-fs-read=*",
        `--allow-fs-write=${shop}`,
        `--allow-fs-write=${shop}/*`,
        "--allow-addons",
      ];
      // The grant is as tight as the clause says: the same flags refuse a write beside the folder and a child process.
      const probe = spawnSync(
        process.execPath,
        [
          ...grant,
          "-e",
          `const fs=require("node:fs");const cp=require("node:child_process");const code=(f)=>{try{f();return "allowed"}catch(e){return e.code}};` +
            `console.log(JSON.stringify([code(()=>fs.writeFileSync(${JSON.stringify(join(cwd, "beside.txt"))},"x")),code(()=>cp.spawnSync("true"))]));`,
        ],
        { encoding: "utf8", cwd },
      );
      expect(probe.stdout.trim(), probe.stderr).toBe(JSON.stringify(["ERR_ACCESS_DENIED", "ERR_ACCESS_DENIED"]));
      const r = await run(["shop"], cwd, { nodeArgs: grant });
      expect(r.status, r.out).toBe(0);
      expect(keys(tree(shop))).toEqual(clientSet());
      expect(entries(cwd).filter((p) => !p.startsWith("shop"))).toEqual([]);
    },
    T,
  );

  it(
    "It starts no process (no install, no `git init`), opens no connection, reads no environment value but `npm_config_user_agent`, `KEEL_AGENT` and `CI`, writes only inside the folder and reads outside it only the files Workspace names: nothing but the project is on disk after a run.",
    async () => {
      const cwd = sandbox();
      const r = await run(["shop"], cwd);
      expect(r.status, r.out).toBe(0);
      expect(entries(cwd).filter((p) => p !== "shop" && !p.startsWith("shop/"))).toEqual([]);
      const names = entries(join(cwd, "shop"));
      for (const bad of [
        "node_modules/",
        ".git/",
        "pnpm-lock.yaml",
        "package-lock.json",
        "yarn.lock",
        "bun.lock",
        "bun.lockb",
      ]) {
        expect(names, bad).not.toContain(bad);
      }
    },
    T,
  );
});

describe("create-app: output", () => {
  const compactLines = (s: string): string[] => s.split("\n").filter((l) => l !== "");

  it(
    "In compact a run prints one `create <path>` line per file, then the `next` lines, then `ok create shop client <n> created`, with no ANSI escape; `--format=json` prints one record per line ending in `summary`; `--dry-run` prints the same records and writes nothing.",
    async () => {
      const cwd = sandbox();
      const r = await run(["shop", "--format=compact"], cwd);
      expect(r.status, r.out).toBe(0);
      expect(r.out).not.toContain(String.fromCharCode(27));
      const written = keys(tree(join(cwd, "shop")));
      const lines = compactLines(r.stdout);
      expect(lines.slice(0, written.length)).toEqual(written.map((p) => `create ${p}`));
      const rest = lines.slice(written.length);
      expect(rest.at(-1)).toBe(`ok create shop client ${written.length} created`);
      const next = rest.slice(0, -1);
      expect(next.length).toBeGreaterThan(0);
      expect(next.every((l) => l.startsWith("next "))).toBe(true);
      expect(next).toContain("next cd shop");
      expect(next.indexOf("next pnpm install")).toBeGreaterThan(next.indexOf("next cd shop"));
      expect(next.indexOf("next pnpm keel dev")).toBeGreaterThan(next.indexOf("next pnpm install"));

      const jcwd = sandbox();
      const j = await run(["shop", "--format=json"], jcwd);
      expect(j.status, j.out).toBe(0);
      const recs = records(j.stdout);
      const rawLines = j.stdout.split("\n").filter((l) => l.trim() !== "");
      expect(recs.length).toBe(rawLines.length);
      expect(recs.at(-1)?.kind).toBe("summary");
      expect(recs.filter((x) => x.kind === "scaffold.edit").length).toBe(written.length);
      expect(
        recs
          .slice(0, -1)
          .map((x) => x.kind)
          .filter((k, i, a) => a.indexOf(k) === i),
      ).toEqual(["scaffold.edit", "create.next"]);

      const dcwd = sandbox();
      const d = await run(["shop", "--dry-run", "--format=json"], dcwd);
      expect(d.status, d.out).toBe(0);
      expect(entries(dcwd)).toEqual([]);
      const dr = records(d.stdout);
      expect(dr.slice(0, -1)).toEqual(recs.slice(0, -1));
      expect(dr.at(-1)?.kind).toBe("summary");
      const dc = await run(["shop", "--dry-run", "--format=compact"], dcwd);
      expect(entries(dcwd)).toEqual([]);
      const dlines = compactLines(dc.stdout);
      expect(dlines.slice(0, -1)).toEqual(lines.slice(0, -1));
      expect(dlines.at(-1)).toMatch(/^ok create --dry-run /);
    },
    T,
  );
});

describe("create-app: a fresh project", () => {
  const checks = (proj: string, kind: "app" | "library"): void => {
    const check = keel(proj, ["check"]);
    expect(check.status, check.out.slice(-600)).toBe(0);
    const test = keel(proj, ["test"]);
    expect(test.status, test.out.slice(-600)).toBe(0);
    if (kind === "app") {
      const build = keel(proj, ["build"]);
      expect(build.status, build.out.slice(-600)).toBe(0);
    } else {
      const pack = keel(proj, ["pack"]);
      expect(pack.status, pack.out.slice(-600)).toBe(0);
      const verify = keel(proj, ["pack", "--check"]);
      expect(verify.status, verify.out.slice(-600)).toBe(0);
    }
    const before = tree(proj);
    const sync = keel(proj, ["docs", "--sync"]);
    expect(sync.status, sync.out.slice(-600)).toBe(0);
    const after = tree(proj);
    for (const [p, text] of before) expect(after.get(p), p).toBe(text);
    expect(keys(after).filter((p) => !before.has(p) && !p.startsWith("dist/") && !p.startsWith(".keel/"))).toEqual([]);
  };
  const kinds: [string, string[]][] = [
    ["client", []],
    ["static", ["--adapter", "static"]],
    ["node", ["--adapter", "node"]],
  ];
  for (const [kind, flags] of kinds) {
    it(
      `From the packed tarballs, in an empty folder, \`client\`, \`static\` and \`node\` each after its install pass \`keel check\`, \`keel test\` and \`keel build\`, \`--library\` passes \`keel check\`, \`keel test\`, \`keel pack\` and then \`keel pack --check\`, and in each \`keel docs --sync\` writes nothing: the ${kind} project`,
      async () => {
        const cwd = sandbox();
        link(cwd);
        const r = await run(["shop", ...flags], cwd);
        expect(r.status, r.out).toBe(0);
        checks(join(cwd, "shop"), "app");
      },
      SLOW,
    );
  }
  it(
    "the library project, with its own install resolved from the same links",
    async () => {
      const cwd = sandbox();
      link(cwd);
      const r = await run(["charts", "--library", "@acme/charts"], cwd);
      expect(r.status, r.out).toBe(0);
      checks(join(cwd, "charts"), "library");
    },
    SLOW,
  );
});
