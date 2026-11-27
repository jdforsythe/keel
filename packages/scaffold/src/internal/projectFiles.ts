import { deployFiles } from "../deployFiles.ts";
import { homeContractTs } from "../templates/homeContractTs.ts";
import { homePageTsx } from "../templates/homePageTsx.ts";
import { homeRouteTest } from "../templates/homeRouteTest.ts";
import { homeRoutesTs } from "../templates/homeRoutesTs.ts";
import { keelMarkSvg } from "../templates/keelMarkSvg.ts";
import { loaderTs } from "../templates/loaderTs.ts";
import { moduleTs } from "../templates/moduleTs.ts";
import { packageJson } from "../templates/packageJson.ts";
import { tokensTs } from "../templates/tokensTs.ts";
import { topologyTs } from "../templates/topologyTs.ts";
import { tsconfigJson } from "../templates/tsconfigJson.ts";
import { turboJson } from "../templates/turboJson.ts";
import { viteConfigTs } from "../templates/viteConfigTs.ts";
import { GITIGNORE } from "./GITIGNORE.ts";
import { managerOf } from "./managerOf.ts";

/**
 * The files of a new project outside the Keel monorepo (k.scaffold `project`, k.create Files), path -> text, from the
 * templates alone: no parser, no check, so `create-app` writes them without loading either. Root config, tokens,
 * topology, module `app` with the route `app.home` at `/` (its page shows `name`, its test expects it; a loader on
 * `node`), turbo, CI and deploy files; every `@keel/*` at `version`; `packageManager` and yarn's `.yarnrc.yml`; a
 * workspace `member` leaves `turbo.json`, CI, `packageManager` and `.yarnrc.yml` to the root.
 */
export function projectFiles(input: {
  readonly name: string;
  readonly adapter: "client" | "node" | "static";
  readonly version: string;
  readonly packageManager: string | undefined;
  readonly member: boolean;
}): Map<string, string> {
  const { name, adapter, version, member } = input;
  const manager = member ? undefined : input.packageManager;
  const node = adapter === "node";
  const files = new Map<string, string>([
    ["package.json", packageJson(name, false, version, manager)],
    ["tsconfig.json", tsconfigJson(false)],
    ["tokens.ts", tokensTs()],
    ["topology.ts", topologyTs(["app"], adapter)],
    ["vite.config.ts", viteConfigTs()],
    ["public/keel-mark.svg", keelMarkSvg()],
    ["modules/app/module.ts", moduleTs("app")],
    ["modules/app/app.contract.ts", homeContractTs()],
    ["modules/app/routes.ts", homeRoutesTs(node)],
    ["modules/app/HomePage.tsx", homePageTsx(name, managerOf(manager).run)],
    ["modules/app/home.route.test.ts", homeRouteTest(name, node)],
    [".gitignore", GITIGNORE],
    [".keel/.gitkeep", ""],
  ]);
  if (node) files.set("modules/app/loadHome.server.ts", loaderTs("loadHome", "app", "app.home", false));
  if (!member) files.set("turbo.json", turboJson(["app"]));
  if (manager?.startsWith("yarn@") === true) files.set(".yarnrc.yml", "nodeLinker: node-modules\n");
  for (const [p, v] of deployFiles({ web: { modules: ["app"], adapter } }, { ci: !member, packageManager: manager }))
    files.set(p, v);
  return files;
}
