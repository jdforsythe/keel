// _generated: from packages/std-tauri/package.json and packages/std-capacitor/package.json; run pnpm generate.
type Versions = Readonly<Record<string, string>>;
type Packages = { dependencies: Versions; plugins: Versions; identity: Versions; devDependencies: Versions };

/**
 * What an app declaring each native shell lists beside the shell's std package (std.tauri, std.capacitor App packages),
 * at the versions the std package declares: `dependencies` kept as an app writes them, `plugins` (k.shell Plugins) and,
 * with `identity.ts`, `identity` in `dependencies` at exactly these versions, `devDependencies` the CLI and platforms.
 */
export const SHELL_PACKAGES: Readonly<Record<"capacitor" | "tauri", Packages>> = {
  capacitor: {
    dependencies: {
      "@capacitor/core": "8.6.0",
    },
    plugins: {
      "@capacitor/app": "8.1.2",
      "@capacitor/preferences": "8.0.1",
    },
    identity: {
      "@capacitor/browser": "8.0.5",
    },
    devDependencies: {
      "@capacitor/android": "8.6.2",
      "@capacitor/cli": "8.6.2",
      "@capacitor/ios": "8.6.2",
    },
  },
  tauri: {
    dependencies: {},
    plugins: {},
    identity: {},
    devDependencies: {
      "@tauri-apps/cli": "2.12.4",
    },
  },
};
