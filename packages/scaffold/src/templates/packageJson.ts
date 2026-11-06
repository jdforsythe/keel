const KEEL = "^0.0.0";

/** `package.json` of a new project: scripts call `keel`, kernel packages as dependencies. */
export function packageJson(name: string): string {
  const pkg = {
    name,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: { build: "keel build", check: "keel check", dev: "keel dev", test: "keel test" },
    dependencies: Object.fromEntries(
      ["compiler", "ctx", "forms", "reactive", "router", "runtime-dom", "schema", "server", "store", "ui"].map((p) => [
        `@keel/${p}`,
        KEEL,
      ]),
    ),
    devDependencies: {
      "@keel/cli": KEEL,
      "@keel/testing": KEEL,
      typescript: "^5.6",
      vite: "^8.3.6",
      vitest: "^2",
    },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}
