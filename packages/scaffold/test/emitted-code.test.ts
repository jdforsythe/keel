import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scaffold } from "../src/index.ts";
import { type Files, apply } from "./helpers.ts";

// Repo root via a workspace link, so this also holds in Stryker's sandbox copy (where relative paths miss the root).
const REPO_ROOT = nodePath.resolve(
  fs.realpathSync(fileURLToPath(new URL("../node_modules/@keel/schema", import.meta.url))),
  "../..",
);
const BIOME = nodePath.join(REPO_ROOT, "node_modules/.bin/biome");
const ROOT_BIOME_CONFIG = nodePath.join(REPO_ROOT, "biome.json");

// Under Stryker the same emitted text is re-checked for every mutant outside the templates. biome's verdict is a pure
// function of (path, text), so a clean verdict is remembered on disk; a mutated template changes the text and misses.
const UNDER_STRYKER = process.env.STRYKER_MUTATOR_WORKER !== undefined;
const CLEAN_DIR = nodePath.join(os.tmpdir(), "keel-scaffold-biome-clean");

function biomeClean(path: string, text: string): string | null {
  const stamp = nodePath.join(CLEAN_DIR, createHash("sha1").update(`${path}\0${text}`).digest("hex"));
  if (UNDER_STRYKER && fs.existsSync(stamp)) return null;
  const run = spawnSync(
    BIOME,
    ["check", "--write", `--config-path=${ROOT_BIOME_CONFIG}`, `--stdin-file-path=${path}`],
    { input: text, encoding: "utf8", cwd: REPO_ROOT },
  );
  if (run.status !== 0 || run.stdout !== text) return `${path}\n${run.stdout}${run.stderr}`;
  if (UNDER_STRYKER) {
    fs.mkdirSync(CLEAN_DIR, { recursive: true });
    fs.writeFileSync(stamp, "");
  }
  return null;
}

function build(workspace: boolean): Files {
  let files: Files = new Map();
  files = apply("project", { name: "shop", workspace }, files);
  files = apply("module", { id: "todos" }, files);
  files = apply("route", { id: "todos.list", path: "/lists/:listId" }, files);
  files = apply("route", { id: "todos.edit", path: "/lists/:listId/todos/:todoId/edit" }, files);
  files = apply("route", { id: "todos.item", path: "/items/:id" }, files);
  files = apply("route", { id: "todos.tagged", path: "/tags/:slug" }, files);
  files = apply("route", { id: "todos.feed", path: "/api/feed/:slug", api: true }, files);
  files = apply("component", { id: "todos/TodoRow" }, files);
  files = apply("store", { id: "todos.board" }, files);
  files = apply("transaction", { id: "todos.board.addCard" }, files);
  return files;
}

describe("emitted code passes the repo's biome config", () => {
  for (const workspace of [true, false]) {
    it(`every .ts/.tsx file of a ${workspace ? "workspace" : "standalone"} project is biome-clean`, () => {
      const files = build(workspace);
      const bad: string[] = [];
      for (const [path, text] of files) {
        if (!/\.tsx?$/.test(path)) continue;
        const verdict = biomeClean(path, text);
        if (verdict !== null) bad.push(verdict);
      }
      expect(bad).toEqual([]);
    });
  }
});

describe("file naming (one export per file, E1752)", () => {
  it("a route's server file is named after its loader export", () => {
    const files = build(true);
    expect(files.get("modules/todos/loadList.server.ts")).toContain("export const loadList = loader(");
    expect(files.has("modules/todos/list.server.ts")).toBe(false);
  });

  it("every emitted .ts/.tsx module exports exactly its file stem (or Props/default for components)", () => {
    for (const [path, text] of build(true)) {
      if (!/^modules\/todos\/[^/]+\.(ts|tsx)$/.test(path) || /(module|routes)\.ts$/.test(path)) continue;
      const stem = (path.split("/").pop() ?? "").split(".")[0] ?? "";
      const names = [...text.matchAll(/^export (?:const|function|default function) (\w+)/gm)].map((m) => m[1]);
      expect(
        names.filter((n) => n !== "Props"),
        path,
      ).toEqual([stem]);
    }
  });
});

describe("route params", () => {
  const contract = (): string => build(true).get("modules/todos/todos.contract.ts") ?? "";

  it("`*Id` params are s.id of the entity, `id` is s.id of the module's entity, others stay strings", () => {
    const text = contract();
    expect(text).toContain(`params: s.object({ listId: s.id("List") }),`);
    expect(text).toContain(`params: s.object({ listId: s.id("List"), todoId: s.id("Todo") }),`);
    expect(text).toContain(`params: s.object({ id: s.id("Todos") }),`);
    expect(text).toContain("params: s.object({ slug: s.string() }),");
  });

  it("imports in the contract file and routes.ts are sorted", () => {
    const imports = (src: string): string[] =>
      (src.match(/^import .*$/gm) ?? []).map((l) => /from "([^"]+)"/.exec(l)?.[1] ?? "");
    expect(imports(contract())).toEqual(["@keel/router/contract", "@keel/schema"]);
    const rel = imports(build(true).get("modules/todos/routes.ts") ?? "").slice(1);
    expect(rel).toEqual([...rel].sort());
  });
});

describe("project --workspace", () => {
  const files = (): Files => apply("project", { name: "shop", workspace: true }, new Map());

  it("emits index.html and vitest.config.ts, and no turbo, CI or .keel", () => {
    const f = files();
    expect(f.get("vitest.config.ts")).toContain(`import { keelConfig } from "@keel/tooling/vitest-config";`);
    expect(f.get("vitest.config.ts")).toContain(`environment: "happy-dom"`);
    expect(f.get("vitest.config.ts")).toContain("plugins: [keel()]");
    expect(f.get("index.html")).toContain("/@keel/entry.ts");
    expect([...f.keys()].filter((p) => p === "turbo.json" || p.startsWith(".github") || p.startsWith(".keel"))).toEqual(
      [],
    );
  });

  it("package.json has the keel scripts; tsconfig extends the strict profile", () => {
    const f = files();
    expect(Object.keys(JSON.parse(f.get("package.json") ?? "{}").scripts).sort()).toEqual(["build", "check", "dev", "test"]);
    expect(JSON.parse(f.get("tsconfig.json") ?? "{}").extends).toBe("@keel/compiler/tsconfig.strict.json");
  });

  it("modules added later do not create turbo or CI, and tests go under test/", () => {
    let f = files();
    f = apply("module", { id: "todos" }, f);
    f = apply("route", { id: "todos.list", path: "/lists/:listId" }, f);
    f = apply("component", { id: "todos/TodoRow" }, f);
    f = apply("store", { id: "todos.board" }, f);
    expect([...f.keys()].some((p) => p === "turbo.json" || p.startsWith(".github"))).toBe(false);
    for (const p of ["test/todos.list.route.test.ts", "test/TodoRow.test.tsx", "test/todos.board.store.test.ts"])
      expect(f.has(p), p).toBe(true);
    expect([...f.keys()].filter((p) => p.startsWith("modules/") && /\.test\.tsx?$/.test(p))).toEqual([]);
    expect(f.get("test/TodoRow.test.tsx")).toContain(`from "../modules/todos/TodoRow.tsx"`);
  });

  it("the default (non-workspace) project is unchanged: turbo, CI and no vitest.config.ts", () => {
    const f = apply("project", { name: "shop" }, new Map());
    expect(f.has("turbo.json") && f.has(".github/workflows/ci.yml")).toBe(true);
    expect(f.has("vitest.config.ts") || f.has("index.html")).toBe(false);
  });
});

describe("codemod rename module", () => {
  const start = (): Files => {
    let f = apply("project", { name: "shop", workspace: true }, new Map());
    f = apply("route", { id: "app.home", path: "/home" }, f);
    f = apply("store", { id: "app.cart" }, f);
    f = apply("module", { id: "other" }, f);
    return f;
  };

  it("moves the folder and updates manifest id, route ids, store ids and topology", () => {
    const f = apply("rename", { kind: "module", from: "app", to: "todos" }, start());
    expect([...f.keys()].some((p) => p.startsWith("modules/app/"))).toBe(false);
    expect(f.get("modules/todos/module.ts")).toContain(`id: "todos"`);
    expect(f.get("modules/todos/routes.ts")).toContain(`"todos.home": {`);
    expect(f.get("modules/todos/routes.ts")).not.toContain("app.home");
    expect(f.get("topology.ts")).toContain(`modules: ["todos", "other"]`);
    expect(f.has("test/todos.home.route.test.ts")).toBe(true);
    expect(f.get("test/todos.home.route.test.ts")).toContain(`renderRoute("todos.home"`);
    expect(f.get("test/todos.home.route.test.ts")).toContain(`"../modules/todos/routes.ts"`);
    expect(f.has("test/todos.cart.store.test.ts")).toBe(true);
    expect(f.get("test/todos.cart.store.test.ts")).toContain(`"../modules/todos/cart.store.ts"`);
  });

  it("round-trips byte-identically", () => {
    const a = start();
    const there = apply("rename", { kind: "module", from: "app", to: "todos" }, a);
    const back = apply("rename", { kind: "module", from: "todos", to: "app" }, there);
    expect([...back].sort()).toEqual([...a].sort());
  });

  it("regenerates turbo.json in a standalone project", () => {
    const f = apply(
      "rename",
      { kind: "module", from: "app", to: "todos" },
      apply("project", { name: "shop" }, new Map()),
    );
    expect(f.get("turbo.json")).toContain("modules/todos/**");
    expect(f.get("turbo.json")).not.toContain("modules/app/**");
  });

  it("refuses an unknown source, a taken target and a bad name", () => {
    const f = start();
    for (const [from, to, code] of [
      ["nope", "x", "E1052"],
      ["app", "other", "E1351"],
      ["app", "Bad_Name", "E1352"],
    ] as const) {
      const r = scaffold("rename", { kind: "module", from, to }, f);
      expect(r.ok).toBe(false);
      expect(JSON.stringify(r.ok ? "" : r.error)).toContain(code);
    }
  });
});
