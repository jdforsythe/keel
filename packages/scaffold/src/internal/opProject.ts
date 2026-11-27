import type { Result } from "@keel/schema";
import { deployFiles } from "../deployFiles.ts";
import { appTestTs } from "../templates/appTestTs.ts";
import { contractTs } from "../templates/contractTs.ts";
import { homePageTsx } from "../templates/homePageTsx.ts";
import { homeRouteTest } from "../templates/homeRouteTest.ts";
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
import { GITIGNORE } from "./GITIGNORE.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { opRoute } from "./opRoute.ts";

/**
 * `scaffold project <name> [--adapter client|node|static] [--workspace]` (default `client`): root config, tokens,
 * topology, module `app` with the route `app.home` at `/` (its page shows the name, its test expects it; a loader on
 * `node` alone), generated turbo, CI and deploy files; no `index.html`, since Keel writes every document. `version` is
 * the creating tool's, every `@keel/*` entry's exact version; `packageManager` (`<name>@<version>`) goes into
 * `package.json`, the CI workflow installs with it, and yarn's gets `.yarnrc.yml`; a `member` of a workspace (k.create
 * Workspace) leaves `turbo.json`, the CI workflow, `packageManager` and `.yarnrc.yml` to the root. A `workspace` app,
 * inside the Keel monorepo, gets `vitest.config.ts` and a first test, `test/app.test.ts`, instead, and no route, turbo,
 * CI, deploy files or `.keel/`.
 */
export function opProject(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.project.parse(input);
  if (!r.ok) return badInput("project", r.error);
  const { name, adapter = "client", workspace = false, version = "0.0.0", member = false } = r.value;
  const manager = member || workspace ? undefined : r.value.packageManager;
  if (!/^[a-z][a-z0-9-]*$/.test(name))
    return fail("E1352", "package.json", `project name ${name} must be lowercase letters, digits and dashes`);
  for (const p of ["package.json", "topology.ts", "modules/app/module.ts"])
    if (files.has(p)) return fail("E1351", p, `${p} already exists; this tree already holds a project`);
  const writes: Writes = new Map([
    ["package.json", packageJson(name, workspace, version, manager)],
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
  const deploy = deployFiles({ web: { modules: ["app"], adapter } }, { ci: !member, packageManager: manager });
  if (!member) writes.set("turbo.json", turboJson(["app"]));
  if (manager?.startsWith("yarn@") === true) writes.set(".yarnrc.yml", "nodeLinker: node-modules\n");
  writes.set(".keel/.gitkeep", "");
  for (const [p, v] of deploy) writes.set(p, v);
  const generated = ["turbo.json", ".keel/.gitkeep", ...deploy.keys()];
  const base = commit(files, writes, generated);
  if (!base.ok) return base;
  const home = opRoute(
    { id: "app.home", path: "/", ...(adapter === "node" ? {} : { "no-loader": true }) },
    base.value.files,
  );
  if (!home.ok) return home;
  for (const [p, v] of home.value.files) if (files.get(p) !== v) writes.set(p, v);
  writes.set("modules/app/HomePage.tsx", homePageTsx(name));
  writes.set("modules/app/home.route.test.ts", homeRouteTest(name, adapter === "node"));
  return commit(files, writes, generated);
}
