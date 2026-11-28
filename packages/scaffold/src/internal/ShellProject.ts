import type { Origins } from "@keel/compiler";

/** What every shell app of a project shares (k.shell Shell target): `package.json` `version` and `name`, the policy for a deployable's declared origins (k.origins), `identity.ts`. */
export type ShellProject = {
  readonly version: string;
  readonly pkg: string;
  readonly policy: ((origins?: Origins) => string) | undefined;
  readonly identity: boolean;
};
