import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The `playwright-core` folder the project's own `node_modules` holds, at `cwd` or a folder above it, as Node's lookup
 * walks; `NODE_PATH` and global folders do not count (a package manager's run sets one).
 */
export function playwrightAt(cwd: string): string | undefined {
  for (let dir = cwd; ; ) {
    const at = join(dir, "node_modules", "playwright-core");
    if (existsSync(join(at, "package.json"))) return at;
    const up = dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}
