// Shared helper (not a test file): the plugins k.shell Plugins says a Capacitor app must list, at the versions
// std.capacitor Plugins gives (`@keel/std-capacitor`'s own `dependencies`). Without `identity.ts`: preferences and app.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const pinned = (name: string): string => {
  const pkg: unknown = JSON.parse(readFileSync(join(REPO, "packages", "std-capacitor", "package.json"), "utf8"));
  const deps: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "dependencies") : undefined;
  const v: unknown = typeof deps === "object" && deps !== null ? Reflect.get(deps, name) : undefined;
  if (typeof v !== "string") throw new Error(`@keel/std-capacitor does not pin ${name}`);
  return v;
};

/** `dependencies` of an app declaring `capacitor` with no `identity.ts`. */
export const capacitorDeps = (): Record<string, string> => ({
  "@keel/std-capacitor": "workspace:*",
  "@capacitor/preferences": pinned("@capacitor/preferences"),
  "@capacitor/app": pinned("@capacitor/app"),
});
