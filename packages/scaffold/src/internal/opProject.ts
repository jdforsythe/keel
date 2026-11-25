import type { Result } from "@keel/schema";
import { deployFiles } from "../deployFiles.ts";
import { appTestTs } from "../templates/appTestTs.ts";
import { contractTs } from "../templates/contractTs.ts";
import { keelMarkSvg } from "../templates/keelMarkSvg.ts";
import { moduleTs } from "../templates/moduleTs.ts";
import { packageJson } from "../templates/packageJson.ts";
import { routesTs } from "../templates/routesTs.ts";
import { tokensTs } from "../templates/tokensTs.ts";
import { topologyTs } from "../templates/topologyTs.ts";
import { tsconfigJson } from "../templates/tsconfigJson.ts";
import { turboJson } from "../templates/turboJson.ts";
import { viteConfigTs } from "../templates/viteConfigTs.ts";
import { vitestConfigTs } from "../templates/vitestConfigTs.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";

/** `.gitignore` of a project: build and tool output, and recorded user sessions (`.keel/sessions/`). `.keel/` is generated, deterministic and hash-checked (E1005), so it is committed, not ignored. */
const GITIGNORE = "node_modules\ndist\n.turbo\ncoverage\nreports\n.stryker-tmp\n.keel-dev/\n.keel/sessions/\n";

/** `scaffold project <name> [--adapter client|node|static] [--workspace]` (default `client`): root config, tokens, topology, module `app`, generated turbo, CI and deploy files (a `workspace` app, inside the Keel monorepo, gets `vitest.config.ts` and a first test, `test/app.test.ts`, instead, and no turbo, CI, deploy files or `.keel/`); no `index.html`, since Keel writes every document. */
export function opProject(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.project.parse(input);
  if (!r.ok) return badInput("project", r.error);
  const { name, adapter = "client", workspace = false } = r.value;
  if (!/^[a-z][a-z0-9-]*$/.test(name))
    return fail("E1352", "package.json", `project name ${name} must be lowercase letters, digits and dashes`);
  for (const p of ["package.json", "topology.ts", "modules/app/module.ts"])
    if (files.has(p)) return fail("E1351", p, `${p} already exists; this tree already holds a project`);
  const writes: Writes = new Map([
    ["package.json", packageJson(name, workspace)],
    ["tsconfig.json", tsconfigJson(workspace)],
    ["tokens.ts", tokensTs()],
    ["topology.ts", topologyTs(["app"], adapter)],
    ["vite.config.ts", viteConfigTs()],
    ["public/keel-mark.svg", keelMarkSvg()],
    ["modules/app/module.ts", moduleTs("app")],
    ["modules/app/app.contract.ts", contractTs("app")],
    ["modules/app/routes.ts", routesTs("app")],
    [".gitignore", GITIGNORE],
  ]);
  if (workspace) {
    writes.set("vitest.config.ts", vitestConfigTs());
    writes.set("test/app.test.ts", appTestTs());
    return commit(files, writes);
  }
  const deploy = deployFiles({ web: { modules: ["app"], adapter } }, { ci: true });
  writes.set("turbo.json", turboJson(["app"]));
  writes.set(".keel/.gitkeep", "");
  for (const [p, v] of deploy) writes.set(p, v);
  return commit(files, writes, ["turbo.json", ".keel/.gitkeep", ...deploy.keys()]);
}
