import { createRequire } from "node:module";
import type { ShellApp } from "@keel/cli";

/** The version text this package's own `package.json` `dependencies` hold for `name`, `""` when it holds none. */
function pinned(name: string): string {
  const pkg: unknown = createRequire(import.meta.url)("@keel/std-capacitor/package.json");
  const version: unknown = Reflect.get(Object(Reflect.get(Object(pkg), "dependencies")), name);
  return typeof version === "string" ? version : "";
}

/**
 * The npm packages a Capacitor app lists in its own `dependencies` (std.capacitor Plugins): `cap sync` installs a
 * native plugin only from there. `@capacitor/preferences` (`storage`) and `@capacitor/app` (launch and return links)
 * always, `@capacitor/browser` only with `identity` (the project has `identity.ts`), each at the version this package
 * pins, so the native half is the one the bundled JavaScript half calls.
 */
export function capacitorPlugins(
  app: ShellApp,
): readonly { readonly plugin: string; readonly version: string; readonly need: string }[] {
  const entry = (plugin: string, need: string) => ({ plugin, version: pinned(plugin), need });
  return [
    entry("@capacitor/preferences", "storage"),
    entry("@capacitor/app", "launch and return links"),
    ...(app.identity ? [entry("@capacitor/browser", "external browser sign-in")] : []),
  ];
}
