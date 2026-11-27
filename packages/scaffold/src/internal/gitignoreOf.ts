import { GITIGNORE } from "./GITIGNORE.ts";

/**
 * Yarn's own list for a project without zero-installs: its local install state (`.yarn/install-state.gz`), cache and
 * Plug'n'Play files, keeping what a project commits (patches, plugins, releases, sdks, versions).
 */
const YARN = ".pnp.*\n.yarn/*\n!.yarn/patches\n!.yarn/plugins\n!.yarn/releases\n!.yarn/sdks\n!.yarn/versions\n";

/** The host projects a library's `keel test --e2e` writes (k.e2e Libraries). */
const E2E_HOSTS = ".keel/e2e-host-*/\n";

/**
 * `.gitignore` of a project or, with `library`, a library (which adds `E2E_HOSTS`), whose `packageManager` is
 * `manager` (k.create-manager): yarn's ends with `YARN`.
 */
export function gitignoreOf(manager: string | undefined, library = false): string {
  const own = library ? `${GITIGNORE}${E2E_HOSTS}` : GITIGNORE;
  return manager?.startsWith("yarn@") === true ? `${own}${YARN}` : own;
}
