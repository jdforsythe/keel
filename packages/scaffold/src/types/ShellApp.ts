/**
 * One `client` deployable's shell as its shell target sees it (k.shell Shell target): the deployable's name, the
 * shell's reverse-DNS `id` and `name`, the app's `package.json` `version` and `name` (`pkg`), the deployable's
 * content security policy for its declared origins (`policy`, k.security, k.origins; undefined when it is not known) and whether the project has
 * `identity.ts`.
 */
export type ShellApp = {
  readonly deployable: string;
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly pkg: string;
  readonly policy: string | undefined;
  readonly identity: boolean;
};
