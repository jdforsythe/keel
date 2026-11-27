import { managerOf } from "@keel/scaffold/create";
// k.cli Command form: a printed `keel <command>` is in the form of the manager that started the run.
import { describe, expect, it } from "vitest";
import { keelForm } from "../src/internal/keelForm.ts";
import { makeDiag } from "../src/internal/makeDiag.ts";
import { render } from "../src/internal/render.ts";

const opts = { quiet: false, limit: undefined, verbose: false, code: undefined, command: "check" } as const;
const diag = makeDiag("E1005", "generated deploy file missing; keel build writes it from topology.ts", {
  path: "deploy/compose.yaml",
  see: "k.deploy",
});

describe("keel's command form", () => {
  it("names the manager's form from npm_config_user_agent, and keel with none", () => {
    expect(keelForm("pnpm/10.0.0 node/v22")).toBe("pnpm keel");
    expect(keelForm("npm/10.9.0 node/v22")).toBe("npx --no keel");
    expect(keelForm("yarn/1.22.22")).toBe("yarn keel");
    expect(keelForm("bun/1.2.0")).toBe("bun run keel");
    expect(keelForm(undefined)).toBe("keel");
    expect(keelForm("deno/2.0.0")).toBe("keel");
    for (const m of ["pnpm", "npm", "yarn", "bun"]) expect(keelForm(`${m}/1.0.0`)).toBe(managerOf(`${m}@1.0.0`).run);
  });

  it("compact and pretty print the form; json keeps the record's text; @keel/ names are not commands", () => {
    const c = render([diag], { ...opts, mode: "compact", keel: "pnpm keel" });
    expect(c).toContain("pnpm keel build writes it");
    expect(c).toContain("see: pnpm keel docs k.deploy");
    expect(render([diag], { ...opts, mode: "pretty", keel: "npx --no keel" })).toContain("npx --no keel build");
    expect(render([diag], { ...opts, mode: "json", keel: "pnpm keel" })).toContain(
      '"generated deploy file missing; keel build',
    );
    const pkg = makeDiag("E1576", "import @keel/ui/brand, not a keel docs internal path");
    expect(render([pkg], { ...opts, mode: "compact", keel: "pnpm keel" })).toContain(
      "@keel/ui/brand, not a pnpm keel docs",
    );
  });
});
