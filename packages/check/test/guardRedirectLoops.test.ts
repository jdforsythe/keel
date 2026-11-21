// E1508 static half (k.guards Rules): a guard whose literal `redirect` route has that guard in its chain.
import { check } from "@keel/check";
import { describe, expect, it } from "vitest";

type Files = { path: string; source: string }[];
const GUARD = "import { guard } from '@keel/router'\nimport { ok } from '@keel/schema'\n";
const guardFile = (path: string, name: string, redirect: string): Files[number] => ({
  path,
  source: `${GUARD}export const ${name} = guard({ redirect: ${redirect} }, async () => ok(null))\n`,
});
const routesFile = (imports: string, body: string): Files[number] => ({
  path: "src/routes.ts",
  source: `import { manifest } from '@keel/router'\n${imports}import { app } from './app.contract.ts'\nconst Page = () => null\nexport const routes = manifest(app, {\n${body}})\n`,
});
const e1508 = (files: Files) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1508")
    .map((d) => `${d.path}:${d.line}:${d.col} ${d.message}`);

describe("E1508 guard redirect into its own guard", () => {
  it("the backlog repro: the redirect route sits under the guarded layout", () => {
    expect(
      e1508([
        guardFile("src/auth.guard.ts", "auth", "'app.login'"),
        routesFile(
          "import { auth } from './auth.guard.ts'\n",
          "  'app.shell': { component: Page, guard: auth },\n  'app.login': { component: Page, layout: 'app.shell' },\n",
        ),
      ]),
    ).toEqual(["src/auth.guard.ts:3:39 guard auth redirects to app.login, which auth guards: a redirect loop"]);
  });

  it("the finding cites k.guards", () => {
    const ds = check(
      [
        guardFile("src/auth.guard.ts", "auth", "'app.login'"),
        routesFile(
          "import { auth } from './auth.guard.ts'\n",
          "  'app.shell': { component: Page, guard: auth },\n  'app.login': { component: Page, layout: 'app.shell' },\n",
        ),
      ],
      { types: false },
    ).diagnostics.filter((d) => d.code === "E1508");
    expect(ds.map((d) => d.see)).toEqual(["k.guards"]);
  });

  it("a route guarded directly, two layouts up, an extensionless or .js import, and a local guard", () => {
    const deep =
      "  'a.outer': { component: Page, guard: auth },\n  'a.inner': { component: Page, layout: 'a.outer' },\n  'app.login': { component: Page, layout: 'a.inner' },\n";
    for (const spec of ["./auth.guard", "./auth.guard.js"])
      expect(
        e1508([
          guardFile("src/auth.guard.ts", "auth", "'app.login'"),
          routesFile(`import { auth } from '${spec}'\n`, deep),
        ]),
      ).toHaveLength(1);
    expect(
      e1508([
        guardFile("src/auth.guard.ts", "auth", "'app.login'"),
        routesFile(
          "import { auth as gate } from './auth.guard.ts'\n",
          "  'app.login': { component: Page, guard: gate },\n",
        ),
      ]),
    ).toHaveLength(1);
    const local = routesFile(
      "import { guard } from '@keel/router'\nimport { ok } from '@keel/schema'\nconst g = guard({ redirect: 'app.login' }, async () => ok(null))\n",
      "  'app.login': { component: Page, guard: g },\n",
    );
    expect(e1508([local])).toEqual([
      "src/routes.ts:4:29 guard g redirects to app.login, which g guards: a redirect loop",
    ]);
  });

  it("clean: the redirect route is outside the guard, under another guard, or unknown", () => {
    const g = guardFile("src/auth.guard.ts", "auth", "'app.login'");
    const other = guardFile("src/other.guard.ts", "other", "'app.home'");
    const imports = "import { auth } from './auth.guard.ts'\nimport { other } from './other.guard.ts'\n";
    expect(
      e1508([
        g,
        other,
        routesFile(
          imports,
          "  'app.home': { component: Page, guard: auth },\n  'app.login': { component: Page, guard: other },\n",
        ),
      ]),
    ).toEqual([]);
    expect(e1508([guardFile("src/auth.guard.ts", "auth", "'nowhere'")])).toEqual([]);
  });

  it("only what is statically visible: a computed redirect, a computed guard, or a test file is not read", () => {
    const body = "  'app.login': { component: Page, guard: auth },\n";
    expect(
      e1508([
        guardFile("src/auth.guard.ts", "auth", "`app.${'login'}`"),
        routesFile("import { auth } from './auth.guard.ts'\n", body),
      ]),
    ).toEqual([]);
    expect(
      e1508([
        guardFile("src/auth.guard.ts", "auth", "'app.login'"),
        routesFile(
          "import { auth } from './auth.guard.ts'\n",
          "  'app.login': { component: Page, guard: [auth][0] },\n",
        ),
      ]),
    ).toEqual([]);
    expect(
      e1508([
        guardFile("test/auth.guard.ts", "auth", "'app.login'"),
        { ...routesFile("import { auth } from './auth.guard.ts'\n", body), path: "test/routes.ts" },
      ]),
    ).toEqual([]);
  });

  it("a layout cycle ends the walk without a finding", () => {
    expect(
      e1508([
        guardFile("src/auth.guard.ts", "auth", "'app.login'"),
        routesFile(
          "import { auth } from './auth.guard.ts'\n",
          "  'a.x': { component: Page, layout: 'a.y' },\n  'a.y': { component: Page, layout: 'a.x' },\n  'app.login': { component: Page, layout: 'a.x' },\n  'app.home': { component: Page, guard: auth },\n",
        ),
      ]),
    ).toEqual([]);
  });
});

describe("E1508 guard redirect to an API route", () => {
  it("a literal redirect naming an API entry of a contract is E1508 at the redirect; a page target is clean", () => {
    const c: Files[number] = {
      path: "src/app.contract.ts",
      source:
        "import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const app = contract('app', {\n  'app.api': { method: 'GET', path: '/api/x', output: s.json() },\n  'app.home': { path: '/' },\n  'app.login': { path: '/login' },\n})\n",
    };
    const body =
      "  'app.api': { loader: read },\n  'app.home': { component: Page, guard: auth },\n  'app.login': { component: Page },\n";
    expect(
      e1508([
        guardFile("src/auth.guard.ts", "auth", "'app.api'"),
        c,
        routesFile("import { auth } from './auth.guard.ts'\n", body),
      ]),
    ).toEqual(["src/auth.guard.ts:3:39 guard auth redirects to app.api, an API route; redirect to a page"]);
    expect(
      e1508([
        guardFile("src/auth.guard.ts", "auth", "'app.login'"),
        c,
        routesFile("import { auth } from './auth.guard.ts'\n", body),
      ]),
    ).toEqual([]);
  });
});
