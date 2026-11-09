// Spec: k.module, clause "`keel check` imports a `deps` package's `./tools` export: a rule it registers reports, and a throw is E1159." (rfc:0070)
// Seed 1337. The real binary runs in a subprocess so the check-rule registry starts empty.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BIN = path.join(repo, "packages/cli/src/bin.ts");

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const manifest = (deps: string[]): string =>
  `import { module } from '@keel/compiler'\nexport default module(${JSON.stringify({
    id: "a",
    deps,
    capabilities: [],
    public: { exports: [], routes: [] },
  })})\n`;

const RULE = `import { defineRule } from "@keel/check";
defineRule({
  code: "E2981",
  message: "toolsfx marker found",
  see: "k.module",
  explain: "Fixture rule registered by a ./tools export.",
  check: ({ file }) => {
    const i = file.source.indexOf("TOOLSFX_MARK");
    return i < 0 ? [] : [{ path: file.path, line: 1, col: i + 1 }];
  },
});
`;

/** A project whose module `a` depends on `@keel/std-toolsfx`, whose `./tools` export is `tools`. */
const project = (tools: string | null): string => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-std-tools-"));
  tmps.push(tmp);
  fs.mkdirSync(path.join(tmp, "modules/a"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "modules/a/module.ts"), manifest(["@keel/std-toolsfx"]));
  fs.writeFileSync(path.join(tmp, "modules/a/mark.ts"), "export const mark = 'TOOLSFX_MARK';\n");
  const keel = path.join(tmp, "node_modules/@keel");
  fs.mkdirSync(path.join(keel, "std-toolsfx"), { recursive: true });
  for (const p of ["check", "schema"]) fs.symlinkSync(path.join(repo, "packages", p), path.join(keel, p));
  const exports: Record<string, string> = { ".": "./index.js" };
  if (tools !== null) exports["./tools"] = "./tools.js";
  fs.writeFileSync(
    path.join(keel, "std-toolsfx/package.json"),
    JSON.stringify({ name: "@keel/std-toolsfx", type: "module", exports }),
  );
  fs.writeFileSync(path.join(keel, "std-toolsfx/index.js"), "export {};\n");
  if (tools !== null) fs.writeFileSync(path.join(keel, "std-toolsfx/tools.js"), tools);
  return tmp;
};

const codes = (cwd: string): { code: string; message: string }[] => {
  const r = spawnSync(process.execPath, [BIN, "check", "--format=json"], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, KEEL_AGENT: "1" },
  });
  const out: { code: string; message: string }[] = [];
  for (const line of r.stdout.split("\n")) {
    if (!line.startsWith("{")) continue;
    const v: unknown = JSON.parse(line);
    if (typeof v === "object" && v !== null && Reflect.get(v, "kind") === "diag")
      out.push({ code: String(Reflect.get(v, "code")), message: String(Reflect.get(v, "message")) });
  }
  return out;
};

describe("k.module: keel check loads a deps package's ./tools export", () => {
  it("a rule the ./tools export registers reports", () => {
    const got = codes(project(RULE)).map((d) => d.code);
    expect(got).toContain("E2981");
    expect(got).not.toContain("E1159");
  }, 120_000);

  it("without a ./tools export the rule is absent and nothing fails", () => {
    const got = codes(project(null)).map((d) => d.code);
    expect(got).not.toContain("E2981");
    expect(got).not.toContain("E1159");
  }, 120_000);

  it("a ./tools export that throws is E1159 naming the package", () => {
    const hits = codes(project("throw new Error('boom');\n")).filter((d) => d.code === "E1159");
    expect(hits.length).toBe(1);
    expect(hits[0]?.message).toContain("@keel/std-toolsfx");
    expect(hits[0]?.message).toContain("tools");
  }, 120_000);
});
