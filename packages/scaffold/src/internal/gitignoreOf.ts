import { GITIGNORE } from "./GITIGNORE.ts";

/**
 * Yarn's own list for a project without zero-installs: its local install state (`.yarn/install-state.gz`), cache and
 * Plug'n'Play files, keeping what a project commits (patches, plugins, releases, sdks, versions).
 */
const YARN = ".pnp.*\n.yarn/*\n!.yarn/patches\n!.yarn/plugins\n!.yarn/releases\n!.yarn/sdks\n!.yarn/versions\n";

/** `.gitignore` of a project or a library whose `packageManager` is `manager` (k.create-manager): yarn's adds `YARN`. */
export function gitignoreOf(manager: string | undefined): string {
  return manager?.startsWith("yarn@") === true ? `${GITIGNORE}${YARN}` : GITIGNORE;
}
