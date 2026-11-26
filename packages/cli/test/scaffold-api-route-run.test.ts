// `scaffold project` + `scaffold module orders` + `scaffold route orders.list --api`, written to a temporary
// directory and its generated route test run with `keel test` (k.scaffold, k.api): the test passes in that project.
import { existsSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { expect, it } from "vitest";
import { run } from "../src/index.ts";
import { runEngine } from "../src/internal/runEngine.ts";

type Files = { path: string; source: string }[];
const REPO = repoRoot(import.meta.dirname);

/** Link each dependency of the generated `package.json` into `cwd/node_modules`: a workspace package or the repo's. */
const link = (cwd: string, manifest: string): void => {
  const parsed: unknown = JSON.parse(manifest);
  const deps = (key: string): string[] => {
    const v = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, key) : undefined;
    return typeof v === "object" && v !== null ? Object.keys(v) : [];
  };
  for (const name of [...deps("dependencies"), ...deps("devDependencies")]) {
    const from = [join(REPO, "packages", name.replace(/^@keel\//, "")), join(REPO, "packages/cli/node_modules", name)];
    const at = name.startsWith("@keel/")
      ? from[0]
      : [...from.slice(1), join(REPO, "node_modules", name)].find(existsSync);
    if (at === undefined || !existsSync(at)) continue;
    mkdirSync(dirname(join(cwd, "node_modules", name)), { recursive: true });
    symlinkSync(at, join(cwd, "node_modules", name), "dir");
  }
};

const step = async (args: string[], cwd: string, files: Files): Promise<Files> => {
  const e = await runEngine(args, { cwd, files: files.map((f) => ({ ...f, path: join(cwd, f.path) })) });
  expect(e.result.code).toBe(0);
  const m = new Map(files.map((f) => [f.path, f.source]));
  for (const w of e.writes) {
    const path = w.path.replace(/^shop\//, "");
    if (w.content === null) m.delete(path);
    else m.set(path, w.content);
  }
  return [...m].map(([path, source]) => ({ path, source }));
};

it(
  "the test scaffold route --api generates passes in a scaffolded project",
  async () => {
    let files = await step(["scaffold", "project", "shop"], "/work", []);
    files = await step(["scaffold", "module", "orders"], "/work/shop", files);
    files = await step(["scaffold", "route", "orders.list", "--path", "/api/orders", "--api"], "/work/shop", files);
    expect(files.map((f) => f.path)).toContain("modules/orders/list.route.test.ts");
    const cwd = realpathSync(tempDir("keel-api-route-"));
    try {
      for (const f of files) {
        mkdirSync(dirname(join(cwd, f.path)), { recursive: true });
        writeFileSync(join(cwd, f.path), f.source);
      }
      link(cwd, files.find((f) => f.path === "package.json")?.source ?? "{}");
      const r = await run(["test", "modules/orders/list.route.test.ts"], { cwd, files });
      expect(r.stdout.split("\n").filter((l) => l !== "")).toEqual(["ok test 1 tests, 0 failed, 0 skipped"]);
      expect(r.code).toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  fixedTime(60_000),
);
