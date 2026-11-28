// Spec: k.cli, clause "Run with `npm_config_user_agent` `pnpm/10.0.0`, `keel check --frozen` in a project with a stale generated deploy file prints its E1005 line naming `pnpm keel check`; with `npm/10.0.0`, `npx --no keel check`; with none, `keel check`; with `--format=json` the record text is the same in each."
// Seed 1337 (recorded; no generated inputs). The real binary over a temp project built once; `deploy/x/Dockerfile` is then changed by one byte.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keel as build, cleanup, materialize, project } from "./compat-support.ts";

const BIN = fileURLToPath(new URL("../src/bin.ts", import.meta.url));

let dir = "";
beforeAll(() => {
  dir = materialize(project());
  if (build(dir, ["build"]).status !== 0) throw new Error("build failed");
  const f = join(dir, "deploy/x/Dockerfile");
  const text = readFileSync(f, "utf8");
  rmSync(f);
  writeFileSync(f, `${text}# stale\n`);
}, testTime(300_000));
afterAll(() => cleanup(dir));

const check = (agent: string | undefined, format: string): string => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (
      v !== undefined &&
      !k.startsWith("VITEST") &&
      k !== "NODE_OPTIONS" &&
      k !== "TEST" &&
      k !== "npm_config_user_agent"
    )
      env[k] = v;
  }
  if (agent !== undefined) env.npm_config_user_agent = agent;
  const r = spawnSync(process.execPath, [BIN, "check", "--frozen", `--format=${format}`], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
  return r.stdout;
};
const e1005 = (out: string): string[] => out.split("\n").filter((l) => l.includes("E1005"));

describe("k.cli Command form, E1005", () => {
  it(
    "`keel check --frozen` with a stale generated deploy file prints its E1005 line naming `pnpm keel check` under pnpm/10.0.0, `npx --no keel check` under npm/10.0.0 and `keel check` with none; json's record text is the same in each",
    () => {
      const pnpm = e1005(check("pnpm/10.0.0 npm/? node/v22.15.0", "compact"));
      const npm = e1005(check("npm/10.0.0 node/v22.15.0", "compact"));
      const none = e1005(check(undefined, "compact"));
      expect(pnpm).toHaveLength(1);
      expect(npm).toHaveLength(1);
      expect(none).toHaveLength(1);
      expect(pnpm[0]).toContain("pnpm keel check");
      expect(npm[0]).toContain("npx --no keel check");
      expect(none[0]).toContain("keel check");
      expect(none[0]).not.toMatch(/(pnpm|yarn|bun run) keel|npx --no keel/);
      const j = [
        check("pnpm/10.0.0 npm/? node/v22.15.0", "json"),
        check("npm/10.0.0 node/v22.15.0", "json"),
        check(undefined, "json"),
      ].map(e1005);
      expect(j[0]).toHaveLength(1);
      expect(j[1]).toEqual(j[0]);
      expect(j[2]).toEqual(j[0]);
    },
    testTime(300_000),
  );
});
