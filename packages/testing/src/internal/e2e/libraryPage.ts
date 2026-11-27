import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
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
 * `path` resolved against the library's folder `dir`, when it lies in `dir`'s `under` folder and is a file there; else
 * E1736 naming the path as written (k.e2e Libraries).
 */
function inFolder(dir: string, path: string, under: "src" | "test", option: string): string {
  const at = resolve(dir, path);
  const base = resolve(dir, under) + sep;
  if (!at.startsWith(base))
    throw e2eError("E1736", `serve({ ${option} }): ${path} is not a file under the library's ${under}/`, {
      [option]: path,
    });
  if (!existsSync(at))
    throw e2eError("E1736", `serve({ ${option} }): ${path} is not a file of this library`, { [option]: path });
  return at;
}

/**
 * The host project of `serve({ page, props, wrap, tokens })` in a library's own folder (k.e2e Libraries): a new
 * folder `.keel/e2e-host-<random>/` per call, so calls in several files at once never share one,
 * a `topology.ts` of one `client` deployable `web` and one module `host` whose route `/` renders the export of `page`
 * (named as the file, imported from the library by its package name, as an app imports it) with `props`, inside
 * `wrap`'s default export when given, under `tokens`' tokens when given, else the library's. Returns the host's
 * folder; the caller builds and serves it and removes it at dispose. `page` must lie under the library's `src/`,
 * `wrap` and `tokens` under its `test/` (E1736 naming the path). Outside a library's
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
  inFolder(dir, page, "src", "page");
  const wrap = options.wrap === undefined ? undefined : inFolder(dir, options.wrap, "test", "wrap");
  const tokens = options.tokens === undefined ? undefined : inFolder(dir, options.tokens, "test", "tokens");
  const name = basename(page, extname(page));
  const host = join(dir, ".keel", `e2e-host-${randomBytes(6).toString("hex")}`);
  const wrapFile = wrap === undefined ? undefined : basename(wrap);
  const wrapName = wrapFile === undefined ? "" : basename(wrapFile, extname(wrapFile));
  const inner = `<${name} ${attributes(options.props ?? {})} />`;
  const body =
    wrapFile === undefined
      ? `    <Box as="main" id="host.main">\n      ${inner}\n    </Box>`
      : `    <${wrapName}>\n      ${inner}\n    </${wrapName}>`;
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
    // `tokens`, else the library's own, copied: a host file may not reach outside its project (E1015).
    "tokens.ts":
      tokens !== undefined
        ? readFileSync(tokens, "utf8")
        : existsSync(join(dir, "tokens.ts"))
          ? readFileSync(join(dir, "tokens.ts"), "utf8")
          : 'import { brandTokens } from "@keel/ui/brand";\n\nexport const tokens = brandTokens;\n',
    "modules/host/module.ts": `import { module } from "@keel/compiler";\n\nexport default module({ id: "host", deps: [${JSON.stringify(lib.name)}], capabilities: [], public: { exports: [] } });\n`,
    "modules/host/host.contract.ts":
      'import { contract } from "@keel/router/contract";\n\nexport const host = contract("host", { "host.page": { path: "/" } });\n',
    ...(wrap === undefined || wrapFile === undefined
      ? {}
      : { [`modules/host/${wrapFile}`]: readFileSync(wrap, "utf8") }),
    "modules/host/HostPage.tsx": `import { ${name} } from ${JSON.stringify(lib.name)};\n${
      wrapFile === undefined ? 'import { Box } from "@keel/ui";' : `import ${wrapName} from "./${wrapFile}";`
    }\n\nexport default function HostPage() {\n  return (\n${body}\n  );\n}\n`,
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
