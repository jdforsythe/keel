import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { libraryKind } from "@keel/compiler/std/libraryKind";
import type { ServeOptions } from "../../types/ServeOptions.ts";
import { e2eError } from "./e2eError.ts";

/** The kernel packages a host project imports that a library does not (k.e2e Libraries). */
const HOST_PACKAGES = ["@keel/compiler", "@keel/router", "@keel/server"] as const;
const PROP = /^[A-Za-z_$][\w$]*$/;

/** The library's `package.json` when `dir` is a library's own folder (k.library-pack Own folder). */
function libraryPackage(dir: string): { readonly name: string } | undefined {
  try {
    const pkg: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    if (typeof pkg !== "object" || pkg === null) return undefined;
    const name: unknown = Reflect.get(pkg, "name");
    return typeof name === "string" && libraryKind(pkg, name) === "library" ? { name } : undefined;
  } catch {
    return undefined;
  }
}

/** A JSX attribute list of `props`, each value its JSON. */
function attributes(props: Readonly<Record<string, unknown>>): string {
  return Object.entries(props)
    .map(([k, v]) => {
      if (!PROP.test(k))
        throw e2eError("E1736", `serve({ props }): ${JSON.stringify(k)} is not a prop name`, { prop: k });
      return `${k}={${JSON.stringify(v)}}`;
    })
    .join(" ");
}

/**
 * The host project of `serve({ page, props })` in a library's own folder (k.e2e Libraries): under `.keel/e2e-host/`,
 * a `topology.ts` of one `client` deployable `web` and one module `host` whose route `/` renders the export of `page`
 * (named as the file, imported from the library by its package name, as an app imports it) with `props`, inside the
 * library's tokens. Returns the host's folder, written fresh; the caller builds and serves it. Outside a library's
 * folder `page` is E1736; `@keel/compiler`, `@keel/router` or `@keel/server` missing from the library's
 * `node_modules` is E1737 naming the first, with the fix.
 */
export function libraryPage(dir: string, options: ServeOptions): string {
  const lib = libraryPackage(dir);
  const page = options.page ?? "";
  if (lib === undefined)
    throw e2eError("E1736", "serve({ page }) runs in a library's own folder; an app serves its own routes", {
      dir,
      page,
    });
  for (const name of HOST_PACKAGES)
    if (!existsSync(join(dir, "node_modules", name, "package.json")))
      throw e2eError(
        "E1737",
        `web did not start: ${name} is not installed in this library's folder; the host page imports it`,
        { deployable: "web", package: name, fix: `+    "${name}": "*",` },
      );
  if (!existsSync(join(dir, page)))
    throw e2eError("E1736", `serve({ page }): ${page} is not a file of this library`, { page });
  const name = basename(page, extname(page));
  const host = join(dir, ".keel", "e2e-host");
  rmSync(host, { recursive: true, force: true });
  const files: Readonly<Record<string, string>> = {
    "package.json": `${JSON.stringify({ name: "keel-e2e-host", private: true, type: "module", dependencies: { [lib.name]: "*" } }, null, 2)}\n`,
    "vite.config.ts":
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [keel()] });\n',
    "tsconfig.json": `${JSON.stringify(
      {
        extends: "@keel/compiler/tsconfig.strict.json",
        compilerOptions: { jsxImportSource: "@keel/runtime-dom", types: ["node", "@keel/compiler/client"] },
        include: ["modules", "topology.ts", "tokens.ts"],
      },
      null,
      2,
    )}\n`,
    "topology.ts":
      'import { topology } from "@keel/server";\n\nexport default topology({ web: { modules: ["host"], adapter: "client" } });\n',
    // The library's own tokens, copied: a host file may not reach outside its project (E1015).
    "tokens.ts": existsSync(join(dir, "tokens.ts"))
      ? readFileSync(join(dir, "tokens.ts"), "utf8")
      : 'import { brandTokens } from "@keel/ui/brand";\n\nexport const tokens = brandTokens;\n',
    "modules/host/module.ts": `import { module } from "@keel/compiler";\n\nexport default module({ id: "host", deps: [${JSON.stringify(lib.name)}], capabilities: [], public: { exports: [] } });\n`,
    "modules/host/host.contract.ts":
      'import { contract } from "@keel/router/contract";\n\nexport const host = contract("host", { "host.page": { path: "/" } });\n',
    "modules/host/HostPage.tsx": `import { ${name} } from ${JSON.stringify(lib.name)};\nimport { Box } from "@keel/ui";\n\nexport default function HostPage() {\n  return (\n    <Box as="main" id="host.main">\n      <${name} ${attributes(options.props ?? {})} />\n    </Box>\n  );\n}\n`,
    "modules/host/routes.ts":
      'import { manifest } from "@keel/router";\nimport HostPage from "./HostPage.tsx";\nimport { host } from "./host.contract.ts";\n\nexport const routes = manifest(host, { "host.page": { component: HostPage } });\n',
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(host, path)), { recursive: true });
    writeFileSync(join(host, path), text);
  }
  // The library as an app installs it: its package name resolves to its own folder.
  mkdirSync(dirname(join(host, "node_modules", lib.name)), { recursive: true });
  symlinkSync(
    relative(dirname(join(host, "node_modules", lib.name)), dir),
    join(host, "node_modules", lib.name),
    "dir",
  );
  return host;
}
