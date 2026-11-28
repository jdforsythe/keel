/** `modules/app/routes.ts` of a new project: `app.home` bound to `HomePage` with the project's `name` as the document title, and on `node` to its loader `loadHome`. */
export function homeRoutesTs(node: boolean, name: string): string {
  return [
    `import { manifest } from "@keel/router";`,
    `import HomePage from "./HomePage.tsx";`,
    `import { app } from "./app.contract.ts";`,
    ...(node ? [`import { loadHome } from "./loadHome.server.ts";`] : []),
    "",
    "export const routes = manifest(app, {",
    `  "app.home": {`,
    "    component: HomePage,",
    `    title: () => "${name}",`,
    ...(node ? ["    loader: loadHome,"] : []),
    "  },",
    "});",
    "",
  ].join("\n");
}
