import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The `*.sql` files of `modules/<moduleId>/migrations/` in the app folder (k.data Files): `KEEL_APP_DIR` when set,
 * else the working directory. `<moduleId>` is the part of `name` before the dot. Keys read `./migrations/<file>`, as a
 * given map's do; no folder is no migrations.
 */
export function foundMigrations(name: string): Readonly<Record<string, string>> {
  const app = process.env.KEEL_APP_DIR || process.cwd();
  const dot = name.indexOf(".");
  const dir = join(app, "modules", dot < 0 ? name : name.slice(0, dot), "migrations");
  if (!existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const file of readdirSync(dir).sort())
    if (file.endsWith(".sql")) out[`./migrations/${file}`] = readFileSync(join(dir, file), "utf8");
  return out;
}
