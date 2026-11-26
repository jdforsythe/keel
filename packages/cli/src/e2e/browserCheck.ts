import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diag } from "../internal/Diag.ts";
import { makeDiag } from "../internal/makeDiag.ts";

/** The `playwright-core` version `@keel/testing` pins as its optional peer (k.e2e Browser). */
function pinned(): string {
  let dir = dirname(fileURLToPath(import.meta.resolve("@keel/testing")));
  for (;;) {
    const file = join(dir, "package.json");
    if (existsSync(file)) {
      const pkg: unknown = JSON.parse(readFileSync(file, "utf8"));
      const peers = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "peerDependencies") : undefined;
      const v = typeof peers === "object" && peers !== null ? Reflect.get(peers, "playwright-core") : undefined;
      if (typeof v === "string") return v;
    }
    const up = dirname(dir);
    if (up === dir) return "1.65.0";
    dir = up;
  }
}

/**
 * The `playwright-core` folder the project's own `node_modules` holds, at `cwd` or a folder above it, as Node's lookup
 * walks; `NODE_PATH` and global folders do not count (a package manager's run sets one).
 */
function installed(cwd: string): string | undefined {
  for (let dir = cwd; ; ) {
    const at = join(dir, "node_modules", "playwright-core");
    if (existsSync(join(at, "package.json"))) return at;
    const up = dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

/**
 * The browser check of `keel test --e2e` (k.e2e Browser), before any file runs: `playwright-core` resolved from the
 * project's folder, then the engine's browser installed. Either missing is one E1734 at `package.json`.
 */
export async function browserCheck(cwd: string, engine: "chromium" | "firefox" | "webkit"): Promise<Diag | undefined> {
  const at = installed(cwd);
  if (at === undefined)
    return makeDiag("E1734", "playwright-core is not installed", {
      path: "package.json",
      line: 1,
      col: 1,
      fix: `+    "playwright-core": "${pinned()}",`,
      see: "k.e2e",
    });
  const mod: unknown = createRequire(import.meta.url)(at);
  // A CommonJS package's names may sit on the namespace or on its `default` only.
  const ns = typeof mod === "object" && mod !== null ? mod : {};
  const fallback: unknown = Reflect.get(ns, "default");
  const type: unknown =
    Reflect.get(ns, engine) ??
    (typeof fallback === "object" && fallback !== null ? Reflect.get(fallback, engine) : undefined);
  const path = typeof type === "object" && type !== null ? Reflect.get(type, "executablePath") : undefined;
  let exe = "";
  try {
    exe = typeof path === "function" ? String(path.call(type)) : "";
  } catch {
    exe = "";
  }
  if (exe !== "" && existsSync(exe)) return undefined;
  return makeDiag("E1734", `the ${engine} browser is not installed: run playwright-core install ${engine}`, {
    path: "package.json",
    line: 1,
    col: 1,
    see: "k.e2e",
  });
}
