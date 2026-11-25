// k.check, explain and docs "`keel explain <code>` prints at most 120 tokens: the message, the rule's `explain` (or the spec's Rules entry for kernel codes), one fix example, and `see`."
// k.check, Codes "`reportedCodes()` lists every code `keel check` produces: the pipeline's and each registered rule's."
// k.module, Std config "`keel check` (every surface) and `keel build` import each `@keel/std-*` package in an app module's `deps` once, and its `./tools` export"
// Seed 1337 (the case is one project per code; no generated inputs). The real binary runs in a subprocess so the check-rule registry starts empty.
// Not asserted (spec silent): the exact text for a code no rule or spec names (the binary says `is not a known code`).
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

/** A project whose module `a` lists `pkg` in `deps`, with the std package and `@keel/schema` linked from the repo. */
function project(pkg: string): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-explain-std-"));
  tmps.push(tmp);
  fs.mkdirSync(path.join(tmp, "modules/a"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "modules/a/module.ts"),
    `import { module } from '@keel/compiler'\nexport default module(${JSON.stringify({
      id: "a",
      deps: [`@keel/${pkg}`],
      capabilities: [],
      public: { exports: [] },
    })})\n`,
  );
  fs.mkdirSync(path.join(tmp, "node_modules/@keel"), { recursive: true });
  for (const p of [pkg, "schema"])
    fs.symlinkSync(path.join(repo, "packages", p), path.join(tmp, "node_modules/@keel", p));
  return tmp;
}

function explain(cwd: string, code: string): string {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, "explain", code], {
    cwd,
    encoding: "utf8",
    env: { ...env, KEEL_AGENT: "1" },
  });
  return `${r.stdout}${r.stderr}`;
}

describe("k.check: keel explain of a code a registered stdlib rule reports", () => {
  for (const [pkg, code] of [
    ["std-messages", "E2406"],
    ["std-brands", "E2101"],
  ] as const) {
    it(`\`keel explain ${code}\` in a project whose \`deps\` list \`@keel/${pkg}\` prints the rule's explanation, not unknown`, () => {
      const out = explain(project(pkg), code);
      expect(out).toContain(code);
      expect(out).not.toMatch(/not a known code|unknown/i);
      expect(out.length).toBeGreaterThan(code.length + 40);
    }, 120_000);
  }
});
