import { GITIGNORE } from "./GITIGNORE.ts";

/**
 * Yarn's own list for a project without zero-installs: its local install state (`.yarn/install-state.gz`), cache and
 * Plug'n'Play files, keeping what a project commits (patches, plugins, releases, sdks, versions).
 */
const YARN = ".pnp.*\n.yarn/*\n!.yarn/patches\n!.yarn/plugins\n!.yarn/releases\n!.yarn/sdks\n!.yarn/versions\n";

/**
 * The derived views every `keel` command rewrites from a project's tree (k.derived Version control), which a project
 * does not commit; `.keel/surface.json` and the deploy files are committed, so a reviewer reads a change to them.
 */
const VIEWS =
  ".keel/a11y.json\n.keel/deps.json\n.keel/ids.json\n.keel/routes.json\n.keel/schemes.json\n.keel/std.json\n.keel/styles.json\n";

/**
 * The host projects a library's `keel test --e2e` writes (k.e2e Libraries), and the `.keel/*.json` artifacts of the
 * `keel build` it runs first, which a library does not commit: it ships `.keel/ledger.json` alone (k.library-pack).
 */
const E2E_HOSTS = ".keel/e2e-host-*/\n.keel/*.json\n!.keel/ledger.json\n";

/**
 * `.gitignore` of a project (which adds `VIEWS`) or, with `library`, a library (which adds `E2E_HOSTS`), whose `packageManager` is
 * `manager` (k.create-manager): yarn's ends with `YARN`.
 */
export function gitignoreOf(manager: string | undefined, library = false): string {
  const own = library ? `${GITIGNORE}${E2E_HOSTS}` : `${GITIGNORE}${VIEWS}`;
  return manager?.startsWith("yarn@") === true ? `${own}${YARN}` : own;
}
