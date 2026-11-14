/**
 * How `keel build --target` looks at the machine before any work (k.shell Build 2): `run` a tool and read its output
 * (stdout and stderr joined; undefined when the command is not found), whether a path `exists`, and the OS `platform`
 * (`process.platform`).
 */
export type Probe = {
  readonly run: (cmd: string, args: readonly string[]) => { readonly code: number; readonly out: string } | undefined;
  readonly exists: (path: string) => boolean;
  readonly platform: string;
};
