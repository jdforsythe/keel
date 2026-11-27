// Seed 1337 (`SEED`). `createPlan` (k.create) given the skills of the repo's `@keel/cli`: the file set per kind, the tree
// `keel scaffold project` writes byte for byte, the name rule (property), Node's floor (property), the manager table,
// the workspace rule, the folder rules (property: any planned path that exists is E1361), and the next records.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type CreateInput, createPlan } from "../src/create/index.ts";
import { RUNS, SEED } from "./helpers.ts";

const REPO = fileURLToPath(new URL("../../..", import.meta.url));
const SKILL_DIR = join(REPO, "packages/cli/skills");
const NAMES = readdirSync(SKILL_DIR)
  .filter((n) => statSync(join(SKILL_DIR, n)).isDirectory())
  .sort();
const SKILLS = NAMES.map((name) => ({
  name,
  description: "",
  text: readFileSync(join(SKILL_DIR, name, "SKILL.md"), "utf8"),
}));
const CLI_VERSION = String(
  Reflect.get(JSON.parse(readFileSync(join(REPO, "packages/cli/package.json"), "utf8")), "version"),
);
const cfg = { seed: SEED, numRuns: Math.min(RUNS, 40) };

const BASE = [
  ".gitignore",
  ".github/workflows/ci.yml",
  ".keel/.gitkeep",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "modules/app/HomePage.tsx",
  "modules/app/app.contract.ts",
  "modules/app/home.route.test.ts",
  "modules/app/module.ts",
  "modules/app/routes.ts",
  "package.json",
  "public/keel-mark.svg",
  "tokens.ts",
  "topology.ts",
  "tsconfig.json",
  "turbo.json",
  "vite.config.ts",
];
const sorted = (a: readonly string[]): string[] => [...a].sort();
const COPIES = NAMES.map((n) => `.claude/skills/${n}/SKILL.md`);
const CLIENT = sorted([...BASE, ...COPIES]);

type View = {
  ok: boolean;
  files: Map<string, string>;
  records: { kind: string; [k: string]: unknown }[];
  text: string;
};
function plan(over: Partial<CreateInput> = {}): View {
  const r = createPlan({ version: "0.4.2", nodeVersion: "22.15.0", skills: SKILLS, folder: "shop", ...over });
  if (!r.ok) return { ok: false, files: new Map(), records: [], text: JSON.stringify(r.error.data) };
  return { ok: true, files: r.value.files, records: [...r.value.records], text: JSON.stringify(r.value.records) };
}
const pkg = (v: View): Record<string, unknown> => {
  const j: unknown = JSON.parse(v.files.get("package.json") ?? "{}");
  return typeof j === "object" && j !== null ? { ...j } : {};
};
const next = (v: View): string[] => v.records.filter((r) => r.kind === "create.next").map((r) => String(r.command));

describe("createPlan: files per kind", () => {
  it("client and static are the client row with one skill copy per skill; node adds exactly three files", () => {
    expect(sorted([...plan().files.keys()])).toEqual(CLIENT);
    const s = plan({ adapter: "static" });
    expect(sorted([...s.files.keys()])).toEqual(CLIENT);
    expect(s.files.get("topology.ts")).toMatch(/adapter: "static"/);
    const n = plan({ adapter: "node" });
    expect(sorted([...n.files.keys()]).filter((p) => !CLIENT.includes(p))).toEqual([
      "deploy/compose.yaml",
      "deploy/web/Dockerfile",
      "modules/app/loadHome.server.ts",
    ]);
  });

  it(
    "each adapter's tree equals `keel scaffold project`'s byte for byte, for pnpm, npm and yarn",
    () => {
      for (const [agent, adapter] of [
        ["pnpm/9.12.0 node/v22.15.0", "client"],
        ["pnpm/9.12.0 node/v22.15.0", "static"],
        ["pnpm/9.12.0 node/v22.15.0", "node"],
        ["npm/10.9.0 node/v22.15.0", "client"],
        ["yarn/4.5.0 npm/? node/v22.15.0", "client"],
      ] as const) {
        const dir = tempDir("keel-createplan-");
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env))
          if (v !== undefined && !k.startsWith("VITEST") && !k.startsWith("npm_config_") && k !== "NODE_OPTIONS")
            env[k] = v;
        env.npm_config_user_agent = agent;
        const bin = join(REPO, "packages/cli/src/bin.ts");
        const r = spawnSync(process.execPath, [bin, "scaffold", "project", "shop", "--adapter", adapter], {
          cwd: dir,
          encoding: "utf8",
          env,
        });
        expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
        const p = plan({ adapter, userAgent: agent, version: CLI_VERSION, nodeVersion: process.versions.node });
        const walk = (rel: string): string[] =>
          readdirSync(join(dir, "shop", rel)).flatMap((n) => {
            const at = rel === "" ? n : `${rel}/${n}`;
            return statSync(join(dir, "shop", at)).isDirectory() ? walk(at) : [at];
          });
        const written = sorted(walk(""));
        expect(sorted([...p.files.keys()]), `${agent} ${adapter}`).toEqual(written);
        for (const f of written) expect(p.files.get(f), f).toBe(readFileSync(join(dir, "shop", f), "utf8"));
      }
    },
    testTime(120_000),
  );

  it("a library is `library`'s ten files at the root, `.gitignore` and the agent files, with the library block", () => {
    const p = plan({ library: "@acme/charts" });
    expect(p.ok, p.text).toBe(true);
    expect(pkg(p).name).toBe("@acme/charts");
    expect(p.files.has(".gitignore")).toBe(true);
    expect(p.files.get("AGENTS.md")).toContain("This is a Keel library.");
    expect(p.files.get("AGENTS.md")?.indexOf("keel-library:")).toBeLessThan(
      p.files.get("AGENTS.md")?.indexOf("keel-client:") ?? 0,
    );
    expect(next(p).slice(-3)).toEqual(["pnpm keel check", "pnpm keel test", "pnpm keel pack"]);
  });

  it("an app pins each `@keel/*` at create's version (property), engines.node `>=22.15`", () => {
    const version = fc.tuple(fc.nat(30), fc.nat(30), fc.nat(30)).map((t) => t.join("."));
    fc.assert(
      fc.property(version, fc.constantFrom<"client" | "static" | "node">("client", "static", "node"), (v, adapter) => {
        const j = pkg(plan({ version: v, adapter }));
        const entries = (d: unknown): [string, unknown][] =>
          typeof d === "object" && d !== null ? Object.entries(d) : [];
        const keel = [...entries(j.dependencies), ...entries(j.devDependencies)].filter(([k]) =>
          k.startsWith("@keel/"),
        );
        expect(keel.length).toBeGreaterThan(0);
        for (const [, range] of keel) expect(range).toBe(v);
        expect(j.engines).toEqual({ node: ">=22.15" });
      }),
      cfg,
    );
  });
});

describe("createPlan: names (property)", () => {
  it("a name is accepted exactly when it is [a-z][a-z0-9-]*, at most 64 long and no dependency; else E1352 with the slug", () => {
    const deps = new Set(["happy-dom", "typescript", "vite", "vitest"]);
    const name = fc.oneof(
      fc.stringMatching(/^[a-z][a-z0-9-]{0,70}$/),
      fc.stringMatching(/^[A-Za-z0-9 _.!-]{1,30}$/),
      fc.constantFrom("vite", "vitest", "typescript", "happy-dom"),
    );
    fc.assert(
      fc.property(name, (n) => {
        const fits = /^[a-z][a-z0-9-]*$/.test(n) && n.length <= 64 && !deps.has(n);
        const p = plan({ name: n });
        expect(p.ok, `${n} ${p.text}`).toBe(fits);
        if (fits) expect(pkg(p).name).toBe(n);
        else {
          expect(p.text).toContain("E1352");
          expect(p.files.size).toBe(0);
          const slug = n.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
          if (!/^[a-z][a-z0-9-]*$/.test(n) && /^[a-z][a-z0-9-]*$/.test(slug) && slug.length <= 40)
            expect(p.text).toContain(`--name ${slug}`);
        }
      }),
      cfg,
    );
  });

  it("the name defaults to the folder's last segment, and for `.` to the real path's", () => {
    expect(pkg(plan({ folder: "a/b/shop" })).name).toBe("shop");
    expect(pkg(plan({ folder: ".", realPath: "/w/site" })).name).toBe("site");
    expect(plan({ folder: "My Site" }).text).toContain("--name my-site");
  });
});

describe("createPlan: Node, folder and workspace", () => {
  it("Node older than 22.15 is E1362 before any other refusal (property)", () => {
    fc.assert(
      fc.property(fc.nat(40), fc.nat(40), (maj, min) => {
        const old = maj < 22 || (maj === 22 && min < 15);
        const p = plan({ nodeVersion: `${maj}.${min}.0`, listing: ["x"], name: "Bad" });
        expect(p.text.includes("E1362")).toBe(old);
      }),
      cfg,
    );
  });

  it("with `existing`, any planned path that exists is E1361 naming it and plans nothing; an existing README.md is kept (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CLIENT.filter((f) => f !== "README.md")), (hit) => {
        const p = plan({ existing: true, listing: ["README.md", hit] });
        expect(p.ok).toBe(false);
        expect(p.text).toContain("E1361");
        expect(p.text).toContain(hit);
      }),
      cfg,
    );
    expect(plan({ listing: ["notes.txt"] }).text).toContain("E1360");
    expect(plan({ listing: [".git/", ".git/HEAD", ".DS_Store"] }).ok).toBe(true);
    expect(plan({ existing: true, listing: ["modules"] }).text).toContain("E1361");
  });

  it("a workspace member drops turbo, CI, packageManager and .yarnrc.yml; out of the globs is W1364; another @keel/cli is E1363", () => {
    const ws = { "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - '!apps/skip'\n" };
    const m = plan({ folder: "apps/b", ancestors: ws, userAgent: "yarn/4.5.0 node/v22.15.0" });
    expect(sorted([...m.files.keys()])).toEqual(CLIENT.filter((p) => p !== "turbo.json" && !p.startsWith(".github/")));
    expect(m.records.find((r) => r.command === "yarn install")).toEqual({ kind: "create.next", command: "yarn install" });
    expect(plan({ folder: "apps/skip", ancestors: ws }).text).toContain("W1364");
    expect(plan({ folder: "apps/ok", ancestors: ws }).text).not.toContain("W1364");
    const deep = plan({
      folder: "x",
      ancestors: { "../package.json": JSON.stringify({ workspaces: { packages: ["*/x"] } }) },
    });
    expect(deep.text).not.toContain("W1364");
    expect(next(deep)).toContain("pnpm install");
    const cli = { "../node_modules/@keel/cli/package.json": JSON.stringify({ version: "0.3.9" }) };
    expect(plan({ ancestors: cli }).text).toContain("pnpm create @keel/app@0.3.9");
    expect(plan({ ancestors: cli, userAgent: "npm/10.0.0" }).text).toContain("npm create @keel/app@0.3.9");
  });

  it("the next records: cd (quoted when it must be), git init unless a .git is above, the install, the four commands", () => {
    expect(next(plan({ folder: "my dir/shop", name: "shop", gitAbove: true }))).toEqual([
      "cd 'my dir/shop'",
      "pnpm install",
      "pnpm keel dev",
      "pnpm keel check",
      "pnpm keel test",
      "pnpm keel build",
    ]);
    expect(next(plan({ userAgent: "bun/1.2.0" })).slice(2)).toEqual([
      "bun install",
      "bun run keel dev",
      "bun run keel check",
      "bun run keel test",
      "bun run keel build",
    ]);
  });
});

describe("createPlan: no template residue", () => {
  // A `${...}` that is neither GitHub's `${{ }}` nor a shell variable (`${KEEL_SECRET:?}`) is a template literal that
  // reached the file unsubstituted (a single-quoted line in a template).
  const RESIDUE = /\$\{(?!\{)(?![A-Z_][A-Z0-9_]*(?::[?-][^}]*)?\})/;
  it("no file but TypeScript (where `${` is the language's) of any kind, for any manager, in or out of a workspace, holds `${` residue", () => {
    const ws = { "pnpm-workspace.yaml": "packages:\n  - apps/*\n" };
    for (const ua of [undefined, "pnpm/9.12.0", "npm/10.9.0", "yarn/1.22.22", "yarn/4.5.0", "bun/1.2.0"])
      for (const kind of [
        {},
        { adapter: "static" as const },
        { adapter: "node" as const },
        { library: "@acme/charts" },
      ])
        for (const where of [{}, { folder: "apps/b", ancestors: ws }]) {
          const p = plan({ userAgent: ua, ...kind, ...where });
          expect(p.ok, p.text).toBe(true);
          for (const [path, text] of p.files)
            if (!path.startsWith(".claude/") && !/\.tsx?$/.test(path))
              expect(RESIDUE.exec(text)?.[0], `${ua} ${path}`).toBeUndefined();
        }
  });
});

describe("createPlan: the workspace from any working folder (property)", () => {
  it("a folder the root's globs take is a member, no W1364, wherever in the workspace create runs", () => {
    const seg = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);
    fc.assert(
      fc.property(
        fc.array(seg, { minLength: 0, maxLength: 3 }),
        seg,
        fc.integer({ min: 0, max: 3 }),
        (top, leaf, up) => {
          const root = `/r/${top.join("/")}`.replace(/\/$/, "");
          const target = `${root}/apps/${leaf}`;
          // the working folder: the root, `apps/`, or a folder below the root elsewhere
          const cwd = [root, `${root}/apps`, `${root}/x`, `${root}/x/y`][up] ?? root;
          const folder = relativeTo(cwd, target);
          const yaml = relativeTo(cwd, `${root}/pnpm-workspace.yaml`);
          const p = plan({ folder, cwd, ancestors: { [yaml]: "packages:\n  - apps/*\n" } });
          expect(p.ok, p.text).toBe(true);
          expect(p.text, `${cwd} ${folder}`).not.toContain("W1364");
          expect(p.files.has("turbo.json")).toBe(false);
          expect(next(p)).toContain("pnpm install");
        },
      ),
      cfg,
    );
  });
});

function relativeTo(from: string, to: string): string {
  const a = from.split("/").filter((x) => x !== "");
  const b = to.split("/").filter((x) => x !== "");
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return [...a.slice(i).map(() => ".."), ...b.slice(i)].join("/") || ".";
}
