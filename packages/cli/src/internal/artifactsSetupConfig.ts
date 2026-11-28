import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type UserConfig, searchForWorkspaceRoot } from "vite";

/**
 * The setup that reads the project's `.keel/a11y.json` and `tokens.ts` for each test file (k.a11y Artifacts): the
 * project's own `@keel/testing`, so the setup and the test's harness are one module, else the one beside this CLI.
 */
const artifactsSetup = (root: string): string => {
  try {
    return createRequire(join(root, "package.json")).resolve("@keel/testing/setup");
  } catch {
    return fileURLToPath(import.meta.resolve("@keel/testing/setup"));
  }
};

/**
 * The Vite overrides `keel test` runs vitest with: `@keel/testing/setup` after the project's own setup files (Vite's
 * config merge joins the lists), and Vite's file rule extended by exactly the folder that setup file lives in, which
 * a linked `@keel/testing` puts outside the project. The rule stays strict; the folders it allows are the project's
 * own (its `server.fs.allow`, else the workspace root Vite finds) and that one folder. `a11y`, the bytes of the
 * derived `a11y.json` of the tree under test (k.derived Readers), is provided to each test process as `keel.a11y`.
 */
export function artifactsSetupConfig(root: string, a11y?: string): UserConfig {
  const setup = artifactsSetup(root);
  return {
    test: { setupFiles: [setup], ...(a11y === undefined ? {} : { provide: { "keel.a11y": a11y } }) },
    plugins: [
      {
        name: "keel:test-setup-allow",
        config: (config) => ({
          server: {
            fs: {
              allow:
                config.server?.fs?.allow === undefined
                  ? [searchForWorkspaceRoot(root), dirname(setup)]
                  : [dirname(setup)],
            },
          },
        }),
      },
    ],
  };
}
